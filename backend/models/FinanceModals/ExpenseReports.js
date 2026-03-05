// models/FinanceModals/ExpenseReports.js
// Phase 2 Refactor — Addresses: F-12
//
// Changes from original:
//   F-12 — totalAmount: Decimal128 → integer Number (minor units)
//   F-12 — Added `currency` field (PRD §I)
//   F-12 — Enabled versionKey (optimistic locking) per PRD §G
import mongoose from "mongoose";

const ExpenseReportSchema = new mongoose.Schema(
  {
    // Deterministic period key — format: EXPENSE_YYYY-MM-DD_YYYY-MM-DD
    // Idempotency: unique index prevents duplicate reports for same period (F-07)
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
    // F-12: versionKey enabled for optimistic locking (PRD §G)
   versionKey: false
  }
);

export default mongoose.model("ExpenseReport", ExpenseReportSchema);