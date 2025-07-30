const mongoose = require('mongoose');

const appliedUserSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  idProofPath: String,
  passStatus: String, // 'approved' or 'manual_review'
  qrData: String,     // QR code as base64
  passDetails: {
    from: String,
    to: String,
    duration: String,
    validTill: String,
  },
  appliedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('applied-users', appliedUserSchema);
