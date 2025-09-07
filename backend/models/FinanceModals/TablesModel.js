import mongoose from "mongoose";

const MirrorSchema = new mongoose.Schema({
  fieldLineId: { type: Number, ref: "SummaryFieldLine" },
  summaryId: { type: Number, ref: "Summary" },
  debitOrCredit: { type: String, enum: ["debit", "credit"] }
}, { _id: false });

const SplitSchema = new mongoose.Schema({
  fieldName: { type: String },
  fieldLineId: { type: Number, ref: "SummaryFieldLine" },
  summaryId: { type: Number, ref: "Summary" },
  debitOrCredit: { type: String, enum: ["debit", "credit"] },
  percentage: { type: Number }, // e.g. 20%
  fixedAmount: { type: Number }, // optional fixed split
  mirrors: [MirrorSchema] // <-- embedded subdocuments
}, { _id: false });

const RuleSchema = new mongoose.Schema({
  ruleId: { type: Number, unique: true },
  transactionType: { type: String, required: true }, // e.g. Expense, Commission
  incrementType: { type: String, enum: ["fixed", "percentage", "both"], default: "percentage" },
  splits: [SplitSchema]
});

export default mongoose.model("Rule", RuleSchema);
