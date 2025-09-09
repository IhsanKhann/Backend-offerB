import mongoose from "mongoose";

// Mirrors (like other rules)
const MirrorSchema = new mongoose.Schema({
  fieldLineId: { type: Number, ref: "SummaryFieldLine" },
  summaryId: { type: Number, ref: "Summary" },
  debitOrCredit: { type: String, enum: ["debit", "credit"] }
}, { _id: false });

// Each component of the breakup
const SplitSchema = new mongoose.Schema({
  componentName: { type: String, required: true },   // e.g., "Base Salary", "Gratuity"
  type: { type: String, enum: ["allowance", "deduction", "terminal"], required: false }, // optional for future transactions
  fieldLineId: { type: Number, ref: "SummaryFieldLine" },  // maps to summaryfieldline
  summaryId: { type: Number, ref: "Summary" },             // maps to summary
  debitOrCredit: { type: String, enum: ["debit", "credit"], required: true },
  percentage: { type: Number, default: 0 },  // optional, for percentage-based rules
  fixedAmount: { type: Number, default: 0 }, // optional fixed amount
  mirrors: [MirrorSchema]                     // optional mirror entries
}, { _id: false });

const BreakupRuleSchema = new mongoose.Schema({
  transactionType: { type: String, required: true }, // e.g., "Salary", "Bonus"
  incrementType: { type: String, enum: ["fixed", "percentage", "both"], default: "both" },
  splits: [SplitSchema]
}, { timestamps: true });

export default mongoose.model("BreakupRule", BreakupRuleSchema);
