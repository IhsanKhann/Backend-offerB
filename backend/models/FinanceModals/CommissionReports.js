// models/FinanceModals/CommissionReports.js
// Phase 2 Hardening — Findings addressed: F-10, F-11
//
// F-10 — All Decimal128 monetary fields → integer Number (minor units / paise).
// F-10 — `currency` field added (PRD §I).
// F-11 — `reportType` enum field added (required, default: "MONTHLY").
// F-11 — versionKey: true ENABLES __v for optimistic locking (PRD §G).
import mongoose from "mongoose";

const CommissionReportSchema = new mongoose.Schema(
  {
    // Deterministic idempotency key — format: COMMISSION_YYYY-MM-DD_YYYY-MM-DD
    // UNIQUE index ensures duplicate closes for the same period are rejected (409).
    periodKey: { type: String, unique: true },

    fromDate: Date,
    toDate:   Date,

    // F-10: integer minor units — NOT Decimal128, NOT float
    commissionAmount:    { type: Number },  // integer (paise/cents)
    expenseAmount:       { type: Number },  // integer
    netResult:           { type: Number },  // integer (can be negative)
    capitalImpactAmount: { type: Number },  // integer

    // F-10 / PRD §I: ISO currency code
    currency: { type: String, default: "PKR" },

    // F-11: reportType is required — used as idempotency classification
    // "MONTHLY"  — standard period close
    // "CLEANUP"  — ad-hoc / partial-period close
    reportType: {
      type: String,
      enum: ["MONTHLY", "CLEANUP"],
      required: true,
      default: "MONTHLY"
    },

    resultType: {
      type: String,
      enum: ["profit", "loss", "breakeven"]
    },

    status: {
      type: String,
      enum: ["locked", "settled"],
      default: "locked"
    },

    closedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "FinalizedEmployee" },
    closedAt:  Date,
    settledAt: Date,

    commissionTransactionIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" }
    ],

    commissionLinked: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now }
  },
  {
    // F-11: versionKey: true ENABLES __v for optimistic locking (PRD §G).
    // Leaving it enabled (the default) — explicitly stated here for auditability.
    versionKey: true
  }
);

export default mongoose.model("CommissionReport", CommissionReportSchema);