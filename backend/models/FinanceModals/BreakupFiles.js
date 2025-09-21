import mongoose from "mongoose";

const BreakupLineSchema = new mongoose.Schema({
  componentName: { type: String, required: true }, // e.g. "Seller Share", "Commission (Retail)"
  category: { type: String, enum: ["base", "allowance", "deduction", "tax", "commission", "income", "receivable"], required: true },
  value: { type: Number, required: true , default: 0},
  debitOrCredit: { type: String, enum: ["debit", "credit"], required: true },
  summaryId: { type: mongoose.Schema.Types.ObjectId, ref: "Summary" }, // which summary to hit
  instanceId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineInstance" }, // which instance
  definitionId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineDefinition" }, 
}, { _id: false });

const BreakupFileSchema = new mongoose.Schema({
  orderType: { type: String, enum: ["retail", "wholesale", "auction", "service"], required: true },
  orderAmount: { type: Number, required: true },
  actualAmount: { type: Number },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "buyers", required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "sellers", required: true },
  parentBreakupId: { type: mongoose.Schema.Types.ObjectId, ref: "BreakupFile" }, // null for parent
  lines: { type: [BreakupLineSchema], default: [] }, // all splits
  totalDebit: { type: Number, default: 0 },
  totalCredit: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model("BreakupFile", BreakupFileSchema);
