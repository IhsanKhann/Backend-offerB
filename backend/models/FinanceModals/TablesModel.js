import mongoose from "mongoose";

const RuleSchema = new mongoose.Schema({
  ruleId: { type: Number, unique: true }, 
  transactionType: { type: String, required: true }, // e.g. Expense, Commission
  incrementType: { type: String, enum: ["fixed", "percentage", "both"], default: "percentage" },
  splits: [
    {
      fieldName: { type: String },
      fieldLineId: { type: Number, ref: "SummaryFieldLine" },
      percentage: { type: Number }, // e.g. 20%
      fixedAmount: { type: Number }, // optional fixed split
      mirror: { type: Number, ref: "SummaryFieldLine" }
    }
  ]
});

export default mongoose.model("Rule", RuleSchema);
