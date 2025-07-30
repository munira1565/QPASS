const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  orderId: { type: String, index: true },
  paymentId: String,
  amount: Number,
  currency: String,
  status: { type: String, default: 'success' },
  fullName: String,
  from: String,
  to: String,
  duration: String,
  qrData: String,  // if you want to show QR on receipt
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', paymentSchema);
