// server/models/Department.js
const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Department name is required'],
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: [true, 'Department code is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  faculty: {
    type: String,
    required: true
  },
  hodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  annualBudget: {
    type: Number,
    default: 0
  },
  currentBudget: {
    type: Number,
    default: 0
  },
  encumberedAmount: {
    type: Number,
    default: 0
  },
  expendedAmount: {
    type: Number,
    default: 0
  },
  budgetUtilization: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
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

// Update budget utilization before saving
departmentSchema.pre('save', function(next) {
  if (this.annualBudget > 0) {
    this.budgetUtilization = ((this.annualBudget - this.currentBudget) / this.annualBudget) * 100;
  }
  next();
});

module.exports = mongoose.model('Department', departmentSchema);
