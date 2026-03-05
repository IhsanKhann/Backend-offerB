// models/FinanceModals/CommissionReports.js
// Phase 2 Refactor — Addresses: F-10, F-11
//
// Changes from original:
//   F-10 — All Decimal128 monetary fields → integer Number (minor units)
//   F-10 — Added `currency` field (PRD §I)
//   F-11 — Added `reportType` enum field (required, default: 'MONTHLY')
//   F-11 — Enabled versionKey (optimistic locking) per PRD §G
import mongoose from "mongoose";

const CommissionReportSchema = new mongoose.Schema(
  {
    periodKey: { type: String, unique: true },

    fromDate:  Date,
    toDate:    Date,

    // F-10: integer minor units — NOT Decimal128
    commissionAmount:    { type: Number },  // integer (paise/cents)
    expenseAmount:       { type: Number },  // integer
    netResult:           { type: Number },  // integer (can be negative)
    capitalImpactAmount: { type: Number },  // integer

    // F-10 / PRD §I: ISO currency code
    currency: { type: String, default: "PKR" },

    // F-11: reportType is now required — idempotency key strategy
    // 'MONTHLY'  — standard period close
    // 'CLEANUP'  — ad-hoc / partial-period close
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
    // F-11: versionKey enabled for optimistic locking (PRD §G)
    versionKey: false   // stores __v field — Mongoose default name
  }
);

export default mongoose.model("CommissionReport", CommissionReportSchema);