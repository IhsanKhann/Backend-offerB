import mongoose from "mongoose";
const MirrorSchema = new mongoose.Schema({
  instanceId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineInstance" },
  summaryId: { type: mongoose.Schema.Types.ObjectId, ref: "Summary" },
  definitionId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineDefinition" },
  debitOrCredit: { type: String, enum: ["debit", "credit"] },
  fallback: { type: String, enum: ["capital", "none"], default: "none" },
  fieldLineId: { type: Number } // optional, for your resolveInstanceObjectId
});

const SplitSchema = new mongoose.Schema({
  componentName: { type: String, required: true },
  type: { type: String, enum: ["allowance", "deduction", "base"] },
  instanceId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineInstance" },
  summaryId: { type: mongoose.Schema.Types.ObjectId, ref: "Summary" },
  definitionId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineDefinition" },
  debitOrCredit: { type: String, enum: ["debit", "credit"], required: true },
  percentage: { type: Number, default: 0 },
  fixedAmount: { type: Number, default: 0 },
  value: { type: Number, default: 0 }, // optional for legacy DB docs
  fieldLineId: { type: Number }, // optional
  mirrors: [MirrorSchema]
});

const BreakupRuleSchema = new mongoose.Schema({
  transactionType: { type: String, required: true },
  
  incrementType: { type: String, enum: ["fixed", "percentage", "both"], default: "both" },
  splits: [SplitSchema]
}, { timestamps: true });

export default mongoose.model("BreakupRules", BreakupRuleSchema);