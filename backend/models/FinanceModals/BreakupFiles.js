import mongoose from "mongoose";

const BreakupLineSchema = new mongoose.Schema(
  {
    componentName: { type: String, required: true },

    category: {
      type: String,
      enum: [
        "base",
        "allowance",
        "deduction",
        "tax",
        "commission",
        "income",
        "receivable",
        "expense",
        "principal",
      ],
      required: true,
    },

    amount: { type: Number, required: true, default: 0 }, // ✅ changed from 'value' to 'amount'

    debitOrCredit: {
      type: String,
      enum: ["debit", "credit"],
      required: true,
    },

    summaryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Summary",
    },
    instanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SummaryFieldLineInstance",
    },
    definitionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SummaryFieldLineDefinition",
    },
  },
  { _id: false }
);

const BreakupFileSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true },

    orderType: {
      type: String,
      enum: [
        "retail",
        "wholesale",
        "auction",
        "service",
        "auctionDeposit",
        "return",
      ],
      required: true,
    },

    orderAmount: { type: Number, required: true },
    actualAmount: { type: Number },

    buyerId: { type: String, required: true },
    sellerId: { type: Number, required: true },

    parentBreakupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BreakupFile",
    },

    breakupType: {
      type: String,
      enum: ["parent", "buyer", "seller", "auctionDeposit", "return"],
      required: true,
      default: "parent",
    },

    lines: { type: [BreakupLineSchema], default: [] },
    totalDebit: { type: Number, default: 0 },
    totalCredit: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("BreakupFile", BreakupFileSchema);
