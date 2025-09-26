import mongoose from "mongoose";

const BreakupLineSchema = new mongoose.Schema({
  componentName: { type: String, required: true }, 
  category: { 
  type: String, 
  enum: ["base", "allowance", "deduction", "tax", "commission", "income", "receivable", "expense", "principal"], 
  required: true 
},
  value: { type: Number, required: true, default: 0 },
  debitOrCredit: { type: String, enum: ["debit", "credit"], required: true },
  summaryId: { type: mongoose.Schema.Types.ObjectId, ref: "Summary" },
  instanceId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineInstance" },
  definitionId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineDefinition" },
}, { _id: false });

const BreakupFileSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true }, // 👈 NEW

  orderType: { type: String, enum: ["retail", "wholesale", "auction", "service", "auctionDeposit", "return"], required: true },
  orderAmount: { type: Number, required: true },
  actualAmount: { type: Number },

  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "buyers", required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "sellers", required: true },

  parentBreakupId: { type: mongoose.Schema.Types.ObjectId, ref: "BreakupFile" },

  breakupType: {
    type: String,
    enum: ["parent", "buyer", "seller", "auctionDeposit", "return"],
    required: true,
    default: "parent"
  },

  lines: { type: [BreakupLineSchema], default: [] },
  totalDebit: { type: Number, default: 0 },
  totalCredit: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model("BreakupFile", BreakupFileSchema);
