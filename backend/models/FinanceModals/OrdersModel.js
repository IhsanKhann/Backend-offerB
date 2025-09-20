import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

const TRANSACTION_TYPES = ['retail', 'wholesale', 'auction', 'service'];
const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];

const OrderSchema = new Schema({
  seller: { type: Types.ObjectId, ref: 'Seller', required: true },
  buyer: { type: Types.ObjectId, ref: 'Buyer', required: true },
  transaction_type: { type: String, enum: TRANSACTION_TYPES, required: true },
  order_total_amount: { type: Number, required: true },
  status: { type: String, enum: ORDER_STATUSES, default: 'pending' },
  placed_at: { type: Date, default: Date.now },
  items: [
    {
      product_id: { type: String },
      name: { type: String },
      quantity: { type: Number, default: 1 },
      unit_price: { type: Number, required: true }
    }
  ]
}, {
  timestamps: { createdAt: 'placed_at', updatedAt: 'updated_at' }
});

const Order = mongoose.model('Order', OrderSchema);

export default Order;
