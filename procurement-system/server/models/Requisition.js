// server/models/Requisition.js
const mongoose = require('mongoose');

const requisitionItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  estimatedUnitCost: {
    type: Number,
    required: true,
    min: 0
  },
  estimatedTotal: {
    type: Number,
    required: true
  },
  specifications: String,
  category: String
});

const attachmentSchema = new mongoose.Schema({
  filename: String,
  fileUrl: String,
  fileType: String,
  fileSize: Number,
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

const approvalHistorySchema = new mongoose.Schema({
  approverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  role: String,
  action: {
    type: String,
    enum: ['submitted', 'approved', 'rejected', 'returned', 'processed']
  },
  comment: String,
  date: {
    type: Date,
    default: Date.now
  }
});

const requisitionSchema = new mongoose.Schema({
  requisitionNumber: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  justification: String,
  requesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  items: [requisitionItemSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  attachments: [attachmentSchema],
  status: {
    type: String,
    enum: [
      'draft',
      'submitted',
      'hod_review',
      'hod_approved',
      'hod_rejected',
      'dean_review',
      'dean_approved',
      'dean_rejected',
      'procurement_processing',
      'tender',
      'order_placed',
      'goods_received',
      'payment_processing',
      'completed',
      'cancelled'
    ],
    default: 'draft'
  },
  currentApprovalLevel: {
    type: String,
    enum: ['hod', 'dean', 'procurement', 'finance', 'vc'],
    default: 'hod'
  },
  approvalHistory: [approvalHistorySchema],
  budgetCheck: {
    beforeSubmission: Number,
    afterDeduction: Number,
    sufficient: Boolean,
    checkedAt: Date
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor'
  },
  purchaseOrderNumber: String,
  tenderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tender'
  },
  goodsReceiptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GoodsReceipt'
  },
  expectedDeliveryDate: Date,
  actualDeliveryDate: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Generate requisition number before saving
requisitionSchema.pre('save', async function(next) {
  if (this.isNew && !this.requisitionNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Requisition').countDocuments();
    this.requisitionNumber = `REQ/${year}/${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Requisition', requisitionSchema);
