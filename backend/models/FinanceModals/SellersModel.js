import mongoose from "mongoose";

const SellerSchema = new mongoose.Schema(
  {
    businessSellerId: {
      type: String,
      required: true,
      unique: true, // prevents duplicates
      index: true,
    },
    name: { type: String, required: true },
    email: { type: String },
  
    totalOrders: { type: Number, default: 0 },
    totalPending: { type: Number, default: 0 }, // not yet paid
    totalPaid: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 }, // pending - paid
    lastPaymentDate: { type: Date },
    lastUpdated: { type: Date, default: Date.now },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Seller", SellerSchema);
