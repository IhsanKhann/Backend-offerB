import mongoose from "mongoose";

// Mirrors (like other rules)
const MirrorSchema = new mongoose.Schema({
  fieldLineId: { type: Number, ref: "SummaryFieldLine" },
  summaryId: { type: Number, ref: "Summary" },
  debitOrCredit: { type: String, enum: ["debit", "credit"] },
  fallback: { type: String, enum: ["capital", "none"], default: "none" } // NEW
}, { _id: false });

// Each component of the breakup
const SplitSchema = new mongoose.Schema({
  componentName: { type: String, required: true },   // e.g., "Base Salary", "Gratuity"
  type: { type: String, enum: ["allowance", "deduction", "terminal"], required: false },
  fieldLineId: { type: Number, ref: "SummaryFieldLine" },
  summaryId: { type: Number, ref: "Summary" },
  debitOrCredit: { type: String, enum: ["debit", "credit"], required: true },
  percentage: { type: Number, default: 0 },
  fixedAmount: { type: Number, default: 0 },
  mirrors: [MirrorSchema]
}, { _id: false });

const BreakupRuleSchema = new mongoose.Schema({
  transactionType: { type: String, required: true }, 
  incrementType: { type: String, enum: ["fixed", "percentage", "both"], default: "both" },
  splits: [SplitSchema]
}, { timestamps: true });

export default mongoose.model("BreakupRule", BreakupRuleSchema);
