// models/FinanceModels/ExpenseReport.js
import mongoose from "mongoose";

const ExpenseReportSchema = new mongoose.Schema({
  periodKey: { type: String, unique: true }, // e.g. 2025-03-01_2025-03-31
  fromDate: Date,
  toDate: Date,

  totalAmount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true
  },

  transactionIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction"
  }],

  status: {
    type: String,
    enum: ["calculated", "paid"],
    default: "calculated"
  },
  
  // calculated means the report is only created
  // paid means the report is created and the expenses are paid.

  paidAt: Date,
  linkedCommissionReport: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CommissionReport"
  },

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("ExpenseReport", ExpenseReportSchema);
