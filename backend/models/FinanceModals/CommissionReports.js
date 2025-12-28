// models/FinanceModels/CommissionReport.js
import mongoose from "mongoose";

// models/FinanceModels/CommissionReport.js
const CommissionReportSchema = new mongoose.Schema({
  periodKey: { type: String, unique: true },
  fromDate: Date,
  toDate: Date,

  commissionAmount: mongoose.Schema.Types.Decimal128,
  expenseAmount: mongoose.Schema.Types.Decimal128,
  netResult: mongoose.Schema.Types.Decimal128,

  resultType: {
    type: String,
    enum: ["profit", "loss", "breakeven"]
  },

  capitalImpactAmount: mongoose.Schema.Types.Decimal128,

  status: {
    type: String,
    enum: ["locked", "settled"],
    default: "locked"
  },

  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "FinalizedEmployee" },
  closedAt: Date,

  settledAt: Date,

  commissionTransactionIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction"
  }],

  commissionLinked: {
    type: Boolean,
    default: false,
  },

  createdAt: { type: Date, default: Date.now }
});


export default mongoose.model("CommissionReport", CommissionReportSchema);
