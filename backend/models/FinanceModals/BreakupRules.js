import mongoose from "mongoose";

const MirrorSchema = new mongoose.Schema({
  instanceId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineInstance" },
  summaryId: { type: mongoose.Schema.Types.ObjectId, ref: "Summary" },
  definitionId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineDefinition" },
  debitOrCredit: { type: String, enum: ["debit", "credit"], required: true },
  isReflectOnly: { type: Boolean, default: false }, // if its a true balancing entry - false.
  fallback: { type: String, enum: ["capital", "none"], default: "none" },
}, { _id: false });

const SplitSchema = new mongoose.Schema({
  componentName: { type: String, required: true },
  type: {
      type: String,
    enum: [
      "base",
      "deduction",
      "tax",
      "commission",
      "income",
      "receivable",
      "payable",
      "principal",
      "expense"
    ],
      required: true
    },
  // Core wiring
  definitionId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineDefinition", required: true },
  summaryId: { type: mongoose.Schema.Types.ObjectId, ref: "Summary", required: true },
  instanceId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineInstance" },

  // Accounting
  debitOrCredit: { type: String, enum: ["debit", "credit"], required: true },
  percentage: { type: Number, default: 0 },
  fixedAmount: { type: Number, default: 0 },

  // Flags
  isActual: { type: Boolean, default: false },
  perTransaction: { type: Boolean, default: false },
  periodicity: { type: String, enum: ["none", "yearly", "biannual", "quarterly"], default: "none" },

  // Tax
  slabStart: { type: Number },
  slabEnd: { type: Number },
  fixedTax: { type: Number },
  additionalTaxPercentage: { type: Number },

  mirrors: [MirrorSchema],
}, { _id: false });

// 🔒 prevent duplicate splits in one rule
SplitSchema.index({ componentName: 1, summaryId: 1, definitionId: 1 }, { unique: true, sparse: true });

const BreakupRuleSchema = new mongoose.Schema({
  transactionType: { type: String, required: true },
  incrementType: { type: String, enum: ["fixed", "percentage", "both"], default: "both" },
  category: { type: String, enum: ["business", "order", "tax"], default: "business" }, 
  splits: [SplitSchema],
}, { timestamps: true });

export default mongoose.model("BreakupRules", BreakupRuleSchema);
