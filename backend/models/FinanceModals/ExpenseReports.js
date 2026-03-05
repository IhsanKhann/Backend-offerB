// models/FinanceModals/ExpenseReports.js
// Phase 2 Hardening — Findings addressed: F-12
//
// F-12 — All monetary fields are integer Number (minor units / paise).
// F-12 — `currency` field added (PRD §I).
// FIX  — periodKey uniqueness index enforces idempotency; duplicate report
//         creation for the same period will surface as E11000 / 409.
import mongoose from "mongoose";

const ExpenseReportSchema = new mongoose.Schema(
  {
    // Deterministic idempotency key — format: EXPENSE_YYYY-MM-DD_YYYY-MM-DD
    // UNIQUE index: two concurrent report-generation calls for the same period
    // will both attempt to create with the same periodKey; the second will fail
    // with E11000, preventing double-counting.
    periodKey: { type: String, unique: true },

    fromDate: Date,
    toDate:   Date,

    // F-12: integer minor units — NOT Decimal128, NOT float
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
    // versionKey: true for optimistic locking — must match CommissionReport
    versionKey: true
  }
);

export default mongoose.model("ExpenseReport", ExpenseReportSchema);