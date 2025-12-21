// models/FinanceModels/CommissionReport.js
import mongoose from "mongoose";

const CommissionReportSchema = new mongoose.Schema({
  periodKey: { type: String, unique: true },
  fromDate: Date,
  toDate: Date,

  commissionAmount: mongoose.Schema.Types.Decimal128,
  expenseAmount: mongoose.Schema.Types.Decimal128,

  netResult: mongoose.Schema.Types.Decimal128, // +profit / -loss

  resultType: {
    type: String,
    enum: ["profit", "loss", "breakeven"]
  }, 
  // if expenses = commission => breakeven..

  // if the capital is hit => incase of loss we paid the loss using the capital the amount used is saved in the capitalImpactAmount.
  capitalImpactAmount: mongoose.Schema.Types.Decimal128,

  status: {
    type: String,
    enum: ["locked", "settled"],
    default: "locked"
  },

  settledAt: Date,
  commissionTransactionIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction"
    }],

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("CommissionReport", CommissionReportSchema);
