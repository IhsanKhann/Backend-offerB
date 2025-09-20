import mongoose from 'mongoose';

const { Schema } = mongoose;

const SellerSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  address: { type: String },
}, {
  timestamps: true // adds createdAt, updatedAt
});

const Seller = mongoose.model('Seller', SellerSchema);

export default Seller;
