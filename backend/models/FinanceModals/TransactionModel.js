import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema({
  transactionId: { type: Number, unique: true },
  date: { type: Date, default: Date.now },
  description: { type: String },
  amount: { type: Number, required: true },
  
  // The actual debits & credits
  lines: [
    {
      fieldLineId: { type: Number, ref: "SummaryFieldLine" }, 
      summaryId: { type: Number, ref: "Summary" },            
      debitOrCredit: { type: String, enum: ["debit", "credit"], required: true },
      amount: { type: Number, required: true }
    }
  ]
});

export default mongoose.model("Transaction", TransactionSchema);