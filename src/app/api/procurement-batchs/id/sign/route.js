import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";

import { verifyToken, verifyPassword } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Requisition from "@/models/Requisition";
import ProcurementBatch from "@/models/ProcurementBatch";
import AuditLog from "@/models/AuditLog";
import { getRequisitionIntegrityHash } from "@/services/procurementBatchService";
import { generateBatchPDF } from "@/lib/batchPdf";
import cloudinary from "@/lib/cloudinary";
import { ROLES } from "@/constants/roles";
import { REQUISITION_STATUS } from "@/constants/requisitionOptions";

function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

async function clearAuthorization(batchId) {
  await ProcurementBatch.updateOne(
    { _id: batchId, status: "draft" },
    { $unset: { signingAuthorizedAt: 1, signingAuthorizedBy: 1, signingSignatureVersion: 1 } }
  );
}

export async function POST(request, { params }) {
  const auth = getAuth();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (auth.role !== ROLES.VC) return NextResponse.json({ message: "Only the Vice-Chancellor can sign a procurement batch." }, { status: 403 });
  if (!mongoose.isValidObjectId(params.id)) return NextResponse.json({ message: "Invalid procurement batch ID." }, { status: 400 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "Invalid request body." }, { status: 400 }); }
  if (!body?.currentPassword) return NextResponse.json({ message: "Current password is required to sign." }, { status: 400 });

  await connectDB();

  const vc = await User.findById(auth.sub).select("+passwordHash +signatureCiphertext signatureVersion fullName email role accountStatus");
  if (!vc || vc.role !== ROLES.VC || vc.accountStatus !== "active") return NextResponse.json({ message: "VC account is not authorized." }, { status: 403 });
  if (!vc.signatureCiphertext || !vc.signatureVersion) return NextResponse.json({ message: "Set up your digital signature before signing a procurement batch." }, { status: 400 });

  const passwordOk = await verifyPassword(body.currentPassword, vc.passwordHash);
  if (!passwordOk) {
    await AuditLog.create({ actor: vc._id, action: "procurement_batch.sign_failed", entityType: "ProcurementBatch", entityId: params.id, details: { reason: "invalid_current_password" } });
    return NextResponse.json({ message: "Current password is incorrect." }, { status: 401 });
  }

  // Claim the signing operation before doing expensive PDF generation. This
  // prevents two simultaneous requests from producing two official documents.
  const authorizedAt = new Date();
  const claimed = await ProcurementBatch.findOneAndUpdate(
    { _id: params.id, createdBy: vc._id, status: "draft", signingAuthorizedAt: { $exists: false } },
    { $set: { signingAuthorizedAt: authorizedAt, signingAuthorizedBy: vc._id, signingSignatureVersion: vc.signatureVersion } },
    { new: true }
  );
  if (!claimed) return NextResponse.json({ message: "This batch is no longer available for signing." }, { status: 409 });

  let uploadedPublicId = null;
  try {
    const requisitions = await Requisition.find({ _id: { $in: claimed.requisitions } })
      .populate({ path: "approvalChain.approver", select: "fullName role" })
      .lean();

    if (requisitions.length !== claimed.requisitions.length) throw new Error("Signing stopped because a requisition could not be found.");

    const currentById = new Map(requisitions.map(r => [String(r._id), r]));
    for (const snapshot of claimed.requisitionSnapshots) {
      const requisition = currentById.get(String(snapshot.requisition));
      if (!requisition) throw new Error("Signing stopped because a requisition is missing.");
      if (requisition.status !== REQUISITION_STATUS.APPROVED || requisition.procurementStatus !== "ready" || String(requisition.procurementBatch) !== String(claimed._id)) {
        throw new Error(`${requisition.requisitionNumber || requisition._id} is no longer eligible for signing.`);
      }
      if (getRequisitionIntegrityHash(requisition) !== snapshot.integrityHash) {
        await AuditLog.create({ actor: vc._id, action: "procurement_batch.integrity_failure", entityType: "ProcurementBatch", entityId: claimed._id, details: { requisitionId: requisition._id, requisitionNumber: requisition.requisitionNumber } });
        throw new Error("Signing stopped because a requisition has changed since the batch was created.");
      }
    }

    const signedAt = new Date();
    const batchForPdf = {
      ...claimed.toObject(),
      signedAt,
      signedBy: { _id: vc._id, fullName: vc.fullName, role: vc.role },
      submittedAt: signedAt,
      createdBy: { _id: vc._id, fullName: vc.fullName, role: vc.role },
      requisitions,
    };

    const { buffer, hash } = await generateBatchPDF(batchForPdf, vc.signatureCiphertext);
    const dataUri = `data:application/pdf;base64,${buffer.toString("base64")}`;
    const upload = await cloudinary.uploader.upload(dataUri, {
      folder: "ksu-procurement/procurement-batches",
      public_id: `${claimed.batchNumber}.pdf`,
      resource_type: "raw",
      type: "authenticated",
      access_mode: "authenticated",
      overwrite: false,
    });
    uploadedPublicId = upload.public_id;

    const finalized = await ProcurementBatch.findOneAndUpdate(
      { _id: claimed._id, createdBy: vc._id, status: "draft", signingAuthorizedAt: authorizedAt },
      {
        $set: {
          status: "submitted",
          submittedAt: signedAt,
          submittedBy: vc._id,
          signedAt,
          signedBy: vc._id,
          documentHash: hash,
          documentPublicId: upload.public_id,
          documentResourceType: "raw",
          documentSignedAt: signedAt,
          signedDocumentCreatedAt: signedAt,
        },
      },
      { new: true }
    );

    if (!finalized) {
      await cloudinary.uploader.destroy(upload.public_id, { resource_type: "raw", type: "authenticated" });
      uploadedPublicId = null;
      throw new Error("The batch changed while the signed document was being finalized. No submission was recorded.");
    }

    await AuditLog.create({
      actor: vc._id,
      action: "procurement_batch.signed",
      entityType: "ProcurementBatch",
      entityId: finalized._id,
      details: { batchNumber: finalized.batchNumber, requisitionCount: finalized.requisitions.length, documentHash: hash, signatureVersion: vc.signatureVersion, reauthenticated: true },
    });

    await AuditLog.create({
      actor: vc._id,
      action: "procurement_batch.submitted",
      entityType: "ProcurementBatch",
      entityId: finalized._id,
      details: { batchNumber: finalized.batchNumber, submittedTo: ROLES.PROCUREMENT, documentHash: hash },
    });

    return NextResponse.json({ message: "Procurement batch signed and submitted to Procurement.", batchId: finalized._id, batchNumber: finalized.batchNumber, status: finalized.status, documentHash: hash }, { status: 200 });
  } catch (error) {
    if (uploadedPublicId) {
      try { await cloudinary.uploader.destroy(uploadedPublicId, { resource_type: "raw", type: "authenticated" }); } catch {}
    }
    await clearAuthorization(claimed._id);
    await AuditLog.create({ actor: vc._id, action: "procurement_batch.sign_failed", entityType: "ProcurementBatch", entityId: claimed._id, details: { reason: error.message } });
    return NextResponse.json({ message: error.message || "Failed to sign procurement batch." }, { status: 409 });
  }
}
