import mongoose from "mongoose";

const accountStatementSchema = new mongoose.Schema({
  sellerId: { type: Number, required: true }, 
  sellerName: { type: String, required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  
  totalAmount: { type: Number, required: true },
  
  orders: [
    {
      orderId: String, // string
      sellerNetReceivable: Number,
      orderDate: Date,
    },
  ],

  // Optional: keep linked breakup files if you want
  breakupIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "BreakupFile" }], // refrence..

  generatedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["pending", "sent", "paid"],
    default: "pending",
  },
  madeAt: Date,
  paidAt: Date,
  referenceId: String,
});

export default mongoose.model("AccountStatementSeller", accountStatementSchema);
