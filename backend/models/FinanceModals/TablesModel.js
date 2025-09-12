import mongoose from "mongoose";

const MirrorSchema = new mongoose.Schema({
  instanceId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineInstance" },
  summaryId: { type: mongoose.Schema.Types.ObjectId, ref: "Summary" },
  definitionId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineDefinition" },
  debitOrCredit: { type: String, enum: ["debit", "credit"] }
}, { _id: false });

const SplitSchema = new mongoose.Schema({
  fieldName: { type: String },
  instanceId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineInstance" },
  summaryId: { type: mongoose.Schema.Types.ObjectId, ref: "Summary" },
  definitionId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineDefinition" },
  debitOrCredit: { type: String, enum: ["debit", "credit"] },
  percentage: { type: Number },
  fixedAmount: { type: Number },
  mirrors: [MirrorSchema]
}, { _id: false });

const RuleSchema = new mongoose.Schema({
  ruleId: { type: Number, unique: true },
  transactionType: { type: String, required: true },
  incrementType: { type: String, enum: ["fixed", "percentage", "both"], default: "percentage" },
  splits: [SplitSchema]
});

export default mongoose.model("Rule", RuleSchema);
