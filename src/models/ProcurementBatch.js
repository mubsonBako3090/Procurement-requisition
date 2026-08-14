import mongoose from "mongoose";

const RequisitionSnapshotSchema = new mongoose.Schema(
  {
    requisition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Requisition",
      required: true,
    },

    requisitionNumber: {
      type: String,
    },

    estimatedCost: {
      type: Number,
      required: true,
      min: 0,
    },

    finalApprovalAt: {
      type: Date,
    },

    integrityHash: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const ProcurementBatchSchema = new mongoose.Schema(
  {
    batchNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    requisitions: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Requisition",
        },
      ],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "A procurement batch must contain at least one requisition.",
      },
    },

    requisitionSnapshots: {
      type: [RequisitionSnapshotSchema],
      required: true,
      default: [],
    },

    totalEstimatedCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    status: {
      type: String,
      enum: ["draft", "submitted", "cancelled"],
      default: "draft",
      index: true,
    },

    submittedAt: {
      type: Date,
    },

    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    signedAt: {
      type: Date,
    },

    signedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    documentHash: {
      type: String,
      trim: true,
    },

    documentPublicId: {
      type: String,
      trim: true,
    },

    documentResourceType: {
      type: String,
      enum: ["raw"],
    },

    documentSignedAt: {
      type: Date,
    },

    /* Security metadata for the VC signing workflow. */
    signingAuthorizedAt: {
      type: Date,
    },

    signingAuthorizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    signingSignatureVersion: {
      type: Number,
      min: 1,
    },

    signedDocumentCreatedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

ProcurementBatchSchema.index({ createdBy: 1, createdAt: -1 });
ProcurementBatchSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.ProcurementBatch ||
  mongoose.model("ProcurementBatch", ProcurementBatchSchema);
