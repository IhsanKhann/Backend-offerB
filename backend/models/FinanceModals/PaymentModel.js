import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

const TRANSACTION_TYPES = ['retail', 'wholesale', 'auction', 'service'];
const PAYMENT_STATUSES = ['pending', 'successful', 'failed'];

const PaymentSchema = new Schema({
  order: { type: Types.ObjectId, ref: 'Order', required: true },
  seller: { type: Types.ObjectId, ref: 'Seller', required: true },
  buyer: { type: Types.ObjectId, ref: 'Buyer', required: true },
  transaction_type: { type: String, enum: TRANSACTION_TYPES, required: true },
  amount: { type: Number, required: true },
  payment_method: { type: String },
  payment_date: { type: Date, default: Date.now },
  status: { type: String, enum: PAYMENT_STATUSES, default: 'pending' }
}, {
  timestamps: true
});

const Payment = mongoose.model('Payment', PaymentSchema);

export default Payment;
