import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema({
  transactionId: { type: Number, unique: true },
  date: { type: Date, default: Date.now },
  description: { type: String },
  amount: { type: Number, required: true },

  // The actual debits & credits
  lines: [
    {
      instanceId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineInstance", },
      summaryId: { type: mongoose.Schema.Types.ObjectId, ref: "Summary", },
      definitionId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineDefinition", },
      debitOrCredit: { type: String, enum: ["debit", "credit"], required: true },
      amount: { type: Number, required: true }
    }
  ]
});

export default mongoose.model("Transaction", TransactionSchema);
