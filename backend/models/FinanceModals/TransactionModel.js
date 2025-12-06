// models/FinanceModals/TransactionModel.js
import mongoose from "mongoose";

const TransactionLineSchema = new mongoose.Schema({
  instanceId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineInstance", required: true },
  summaryId: { type: mongoose.Schema.Types.ObjectId, ref: "Summary", required: true },
  definitionId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineDefinition", required: true },
  debitOrCredit: { type: String, enum: ["debit", "credit"], required: true },
  amount: { type: mongoose.Schema.Types.Decimal128, required: true },
  description: { type: String },
  isReflection: { type: Boolean, default: false }
});

const TransactionSchema = new mongoose.Schema({
  transactionId: { type: Number, unique: true },
  date: { type: Date, default: Date.now },
  description: { type: String },
  type: { type: String, enum: ["salary","purchase","sale","journal","transfer"], default:"journal" },
  amount: { type: mongoose.Schema.Types.Decimal128, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  status: { type: String, enum: ["draft","posted","cancelled"], default:"posted" },

  totalDebits: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  totalCredits: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  isBalanced: { type: Boolean, default: false },

  lines: [TransactionLineSchema]
});

// Pre-save hook calculates totals for all lines, including reflections if needed
TransactionSchema.pre("save", function(next) {
  let debitSum = 0;
  let creditSum = 0;

  this.lines.forEach(line => {
    const amt = parseFloat(line.amount.toString());
    if (line.debitOrCredit === "debit") debitSum += amt;
    if (line.debitOrCredit === "credit") creditSum += amt;
  });

  this.totalDebits = mongoose.Types.Decimal128.fromString(debitSum.toFixed(2));
  this.totalCredits = mongoose.Types.Decimal128.fromString(creditSum.toFixed(2));
  this.isBalanced = Math.abs(debitSum - creditSum) < 0.01;

  next();
});

export default mongoose.model("Transaction", TransactionSchema);
