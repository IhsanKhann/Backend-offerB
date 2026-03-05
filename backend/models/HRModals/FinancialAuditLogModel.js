// models/FinanceModals/AuditLogModel.js
// Addresses F-18 — PRD §H: financial mutation audit trail
//
// IMMUTABILITY ENFORCEMENT (v2.1 §6):
//   - No update or delete routes may be registered for AuditLog.
//   - No cascade deletion may remove AuditLog records.
//   - No API endpoint exists to modify audit logs.
//   - If a financial mutation succeeds and the audit write fails,
//     the entire MongoDB transaction MUST rollback.
import mongoose from "mongoose";

const { Schema, Types: { ObjectId } } = mongoose;

const FINANCIAL_AUDIT_EVENTS = [
  "JOURNAL_POSTED",
  "BALANCE_UPDATED",
  "COMMISSION_REPORT_CREATED",
  "COMMISSION_SETTLED",
  "EXPENSE_REPORT_CREATED",
  "EXPENSE_PAID",
  "SALARY_BREAKUP_CREATED"
];

const AuditLogSchema = new Schema(
  {
    eventType: {
      type: String,
      enum: FINANCIAL_AUDIT_EVENTS,
      required: true,
      index: true
    },

    actorId: {
      type: Schema.Types.ObjectId,
      ref: "FinalizedEmployee",
      required: false,   // system-initiated mutations may have no actor
      index: true
    },

    entityId: {
      type: Schema.Types.ObjectId,
      index: true
    },

    entityType: {
      type: String,        // e.g. "Transaction", "CommissionReport", "ExpenseReport"
      index: true
    },

    /**
     * Integer minor-unit balances captured AT THE TIME of write.
     * Allows offline ledger reconciliation without replaying all events.
     */
    balanceBefore: { type: Number },  // integer (paise/cents)
    balanceAfter:  { type: Number },  // integer (paise/cents)

    currency: { type: String, default: "PKR" },

    meta: { type: Schema.Types.Mixed, default: {} },

    createdAt: { type: Date, default: Date.now, index: true }
  },
  {
    // versionKey disabled — audit records are immutable; no __v needed
    versionKey: false
  }
);

// Performance indexes
AuditLogSchema.index({ event: 1, createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ entityId: 1, entityType: 1 });

// ------------------------------------------------------------------
// IMMUTABILITY GUARD — block any update/delete via pre-hooks
// These guards defend against accidental programmatic modification.
// ------------------------------------------------------------------
const immutableError = () => {
  throw new Error("AuditLog records are immutable and cannot be modified or deleted.");
};

AuditLogSchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], immutableError);
AuditLogSchema.pre(["deleteOne", "deleteMany", "findOneAndDelete"], immutableError);

const AuditLog =
  mongoose.models.FinancialAuditLog ||
  mongoose.model("FinancialAuditLog", AuditLogSchema);

export { FINANCIAL_AUDIT_EVENTS };
export default AuditLog;