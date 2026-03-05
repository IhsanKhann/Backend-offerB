import mongoose from "mongoose";

const ExpenseReportSchema = new mongoose.Schema(
  {
    periodKey: { type: String, unique: true },

    fromDate: Date,
    toDate:   Date,

    // F-12: integer minor units — NOT Decimal128
    totalAmount: { type: Number, required: true },  // integer (paise/cents)

    // F-12 / PRD §I: ISO currency code
    currency: { type: String, default: "PKR" },

    transactionIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" }
    ],

    status: {
      type: String,
      enum: ["calculated", "paid"],
      default: "calculated"
      // "calculated" — report created, expenses not yet cash-settled
      // "paid"       — expenses cash-settled via payExpensePeriodController
    },

    paidAt: Date,

    linkedCommissionReport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommissionReport"
    },

    createdAt: { type: Date, default: Date.now }
  },
  {
    versionKey: true
  }
);

export default mongoose.model("ExpenseReport", ExpenseReportSchema);