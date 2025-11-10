import mongoose from "mongoose";

const SellerSchema = new mongoose.Schema(
  {
    businessSellerId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true },
    email: { type: String },

    // --- Order Tracking ---
    totalOrders: { type: Number, default: 0 },
    pendingOrders: { type: Number, default: 0 },
    paidOrders: { type: Number, default: 0 },

    // --- Financials (based on seller net receivable) ---
    totalReceivableAmount: { type: Number, default: 0 },
    paidReceivableAmount: { type: Number, default: 0 },
    remainingReceivableAmount: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },

    // --- Other metadata ---
    lastPaymentDate: { type: Date },
    lastUpdated: { type: Date, default: Date.now },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Seller", SellerSchema);
