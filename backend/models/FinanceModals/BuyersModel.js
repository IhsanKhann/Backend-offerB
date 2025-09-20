import mongoose from 'mongoose';

const { Schema } = mongoose;

const BuyerSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  address: { type: String },
}, {
  timestamps: true
});

const Buyer = mongoose.model('Buyer', BuyerSchema);

export default Buyer;
