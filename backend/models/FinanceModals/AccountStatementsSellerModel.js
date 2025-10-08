import mongoose from "mongoose";

const accountStatementSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Seller",
    required: true,
  },
  sellerName: { type: String, required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  totalAmount: { type: Number, required: true },
  orders: [
    {
      orderId: String,
      sellerNetReceivable: Number,
      orderDate: Date,
    },
  ],
  generatedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["pending", "sent", "paid"],
    default: "pending",
  },
  madeAt: Date,
  paidAt: Date,
  referenceId: String, // Returned from business side API
});

export default mongoose.model("AccountStatementSeller", accountStatementSchema);
