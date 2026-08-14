import crypto from "crypto";

import Requisition from "@/models/Requisition";
import ProcurementBatch from "@/models/ProcurementBatch";
import AuditLog from "@/models/AuditLog";

import { REQUISITION_STATUS } from "@/constants/requisitionOptions";
import { ROLES } from "@/constants/roles";

function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = sortObjectKeys(value[key]);
        return result;
      }, {});
  }

  return value;
}

function canonicalRequisition(requisition) {
  const source = requisition.toObject
    ? requisition.toObject({ depopulate: true })
    : requisition;

  return sortObjectKeys({
    _id: String(source._id),
    requisitionNumber: source.requisitionNumber || null,
    requester: source.requester ? String(source.requester) : null,
    requesterRole: source.requesterRole || null,
    collegeId: source.collegeId || null,
    facultyId: source.facultyId || null,
    department: source.department || null,
    category: source.category || null,
    purpose: source.purpose || null,
    urgency: source.urgency || null,
    items: source.items || [],
    estimatedCost: Number(source.estimatedCost || 0),
    status: source.status || null,
    finalApprovalAt: source.finalApprovalAt
      ? new Date(source.finalApprovalAt).toISOString()
      : null,
    procurementStatus: source.procurementStatus || null,
    procurementOfficer: source.procurementOfficer
      ? String(source.procurementOfficer)
      : null,
  });
}

export function getRequisitionIntegrityHash(requisition) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalRequisition(requisition)))
    .digest("hex");
}

function makeBatchNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `PB-${date}-${random}`;
}

function assertVC(user) {
  if (!user || user.role !== ROLES.VC) {
    throw new Error("Only the Vice-Chancellor can manage procurement batches.");
  }
}

function assertProcurementOrVC(user) {
  if (!user || ![ROLES.VC, ROLES.PROCUREMENT].includes(user.role)) {
    throw new Error("You are not authorized to access procurement batches.");
  }
}

function normalizeIds(ids) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
}

export async function createProcurementBatch({ requisitionIds, actor }) {
  assertVC(actor);

  const ids = normalizeIds(requisitionIds);

  if (!ids.length) {
    throw new Error("Select at least one approved requisition.");
  }

  const requisitions = await Requisition.find({
    _id: { $in: ids },
  }).lean(false);

  if (requisitions.length !== ids.length) {
    throw new Error("One or more selected requisitions could not be found.");
  }

  const byId = new Map(requisitions.map((item) => [String(item._id), item]));

  for (const id of ids) {
    const requisition = byId.get(id);

    if (!requisition) {
      throw new Error("One or more selected requisitions could not be found.");
    }

    if (requisition.status !== REQUISITION_STATUS.APPROVED) {
      throw new Error(
        `${requisition.requisitionNumber || id} is not fully approved.`
      );
    }

    if (requisition.procurementStatus !== "ready") {
      throw new Error(
        `${requisition.requisitionNumber || id} is not ready for Procurement.`
      );
    }

    if (requisition.procurementBatch) {
      throw new Error(
        `${requisition.requisitionNumber || id} already belongs to a procurement batch.`
      );
    }

    if (!requisition.finalApprovalAt) {
      throw new Error(
        `${requisition.requisitionNumber || id} has no recorded final approval.`
      );
    }
  }

  const snapshots = requisitions.map((requisition) => ({
    requisition: requisition._id,
    requisitionNumber: requisition.requisitionNumber,
    estimatedCost: Number(requisition.estimatedCost || 0),
    finalApprovalAt: requisition.finalApprovalAt,
    integrityHash: getRequisitionIntegrityHash(requisition),
  }));

  const totalEstimatedCost = snapshots.reduce(
    (sum, item) => sum + Number(item.estimatedCost || 0),
    0
  );

  const batch = await ProcurementBatch.create({
    batchNumber: makeBatchNumber(),
    createdBy: actor.sub,
    requisitions: ids,
    requisitionSnapshots: snapshots,
    totalEstimatedCost,
    status: "draft",
  });

  /*
   * Claim the requisitions atomically. The null/missing condition prevents
   * two concurrent VC requests from putting the same requisition into two
   * different batches.
   */
  const claimResult = await Requisition.updateMany(
    {
      _id: { $in: ids },
      status: REQUISITION_STATUS.APPROVED,
      procurementStatus: "ready",
      procurementBatch: null,
    },
    {
      $set: {
        procurementBatch: batch._id,
        procurementBatchAddedAt: new Date(),
      },
    }
  );

  if (claimResult.modifiedCount !== ids.length) {
    await Requisition.updateMany(
      { procurementBatch: batch._id },
      {
        $unset: {
          procurementBatch: 1,
          procurementBatchAddedAt: 1,
        },
      }
    );

    await ProcurementBatch.deleteOne({ _id: batch._id });

    throw new Error(
      "One or more requisitions were claimed by another batch. Please refresh and try again."
    );
  }

  await AuditLog.create({
    actor: actor.sub,
    action: "procurement_batch.created",
    entityType: "ProcurementBatch",
    entityId: batch._id,
    details: {
      batchNumber: batch.batchNumber,
      requisitionIds: ids,
      totalEstimatedCost,
    },
  });

  return ProcurementBatch.findById(batch._id)
    .populate("createdBy", "fullName email role")
    .populate("requisitions", "requisitionNumber department category purpose estimatedCost status finalApprovalAt procurementStatus")
    .lean();
}

export async function listProcurementBatches({ actor }) {
  assertProcurementOrVC(actor);

  const query =
    actor.role === ROLES.VC
      ? {}
      : { status: "submitted" };

  return ProcurementBatch.find(query)
    .sort({ createdAt: -1 })
    .populate("createdBy", "fullName email role")
    .populate("submittedBy", "fullName email role")
    .lean();
}

export async function getProcurementBatch({ batchId, actor }) {
  assertProcurementOrVC(actor);

  const batch = await ProcurementBatch.findById(batchId)
    .populate("createdBy", "fullName email role")
    .populate("submittedBy", "fullName email role")
    .populate("signedBy", "fullName email role")
    .populate(
      "requisitions",
      "requisitionNumber requester requesterRole department category purpose urgency items estimatedCost status finalApprovalAt procurementStatus procurementOfficer procurementReceivedAt"
    )
    .lean();

  if (!batch) {
    throw new Error("Procurement batch not found.");
  }

  if (actor.role === ROLES.PROCUREMENT && batch.status !== "submitted") {
    throw new Error("This procurement batch has not been submitted to Procurement.");
  }

  return batch;
}

export async function cancelProcurementBatch({ batchId, actor }) {
  assertVC(actor);

  const batch = await ProcurementBatch.findOne({
    _id: batchId,
    createdBy: actor.sub,
  });

  if (!batch) {
    throw new Error("Procurement batch not found.");
  }

  if (batch.status !== "draft") {
    throw new Error("Only draft procurement batches can be cancelled.");
  }

  const result = await Requisition.updateMany(
    {
      _id: { $in: batch.requisitions },
      procurementBatch: batch._id,
    },
    {
      $unset: {
        procurementBatch: 1,
        procurementBatchAddedAt: 1,
      },
    }
  );

  if (result.modifiedCount !== batch.requisitions.length) {
    throw new Error(
      "The batch could not be cancelled safely because one or more requisitions are no longer linked to this batch."
    );
  }

  batch.status = "cancelled";
  await batch.save();

  await AuditLog.create({
    actor: actor.sub,
    action: "procurement_batch.cancelled",
    entityType: "ProcurementBatch",
    entityId: batch._id,
    details: {
      batchNumber: batch.batchNumber,
      requisitionIds: batch.requisitions.map(String),
    },
  });

  return batch.toObject();
}
