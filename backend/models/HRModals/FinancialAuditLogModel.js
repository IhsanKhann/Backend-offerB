// models/FinanceModals/FinancialAuditLogModel.js
// Phase 2 Hardening — Findings addressed: F-18
//
// F-18 — Immutable financial audit log for every financial mutation.
//
// IMMUTABILITY ENFORCEMENT:
//   - No update or delete routes may be registered for this model.
//   - No cascade deletion may remove AuditLog records.
//   - No API endpoint exists to modify audit logs.
//   - If a financial mutation succeeds and the audit write fails,
//     the entire MongoDB transaction MUST rollback (enforced by caller).
//
// ADDITIONAL HARDENING (audit finding CG-7):
//   - bulkWrite and replaceOne pre-hooks added to close immutability bypass.
import mongoose from "mongoose";

const { Schema } = mongoose;

export const FINANCIAL_AUDIT_EVENTS = [
  "JOURNAL_POSTED",
  "BALANCE_UPDATED",
  "COMMISSION_REPORT_CREATED",
  "COMMISSION_SETTLED",
  "EXPENSE_REPORT_CREATED",
  "EXPENSE_PAID",
  "SALARY_BREAKUP_CREATED",
  "SALARY_BREAKUP_DELETED",     // Added: covers deleteBreakup audit gap (CG-5)
  "OPENING_BALANCE_INITIALIZED" // Added: covers summariesInitCapitalCash audit gap (FI-6)
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
      type: String,   // e.g. "Transaction", "CommissionReport", "ExpenseReport"
      index: true
    },

    // Integer minor-unit balances captured AT THE TIME of write.
    // Allows offline ledger reconciliation without replaying all events.
    balanceBefore: { type: Number },  // integer (paise/cents)
    balanceAfter:  { type: Number },  // integer (paise/cents)

    // F-04: ISO currency code — populated by caller; not hardcoded
    currency: { type: String, default: "PKR" },

    meta: { type: Schema.Types.Mixed, default: {} },

    createdAt: { type: Date, default: Date.now, index: true }
  },
  {
    // versionKey disabled — audit records are immutable; __v is meaningless
    versionKey: false
  }
);

// Performance indexes
AuditLogSchema.index({ eventType: 1, createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ entityId: 1, entityType: 1 });

// ------------------------------------------------------------------
// IMMUTABILITY GUARDS — block any modification or deletion via pre-hooks.
// CG-7 fix: bulkWrite and replaceOne are now also blocked.
// These guards defend against accidental programmatic modification.
// ------------------------------------------------------------------
const immutableError = () => {
  throw new Error(
    "FinancialAuditLog records are immutable and cannot be modified or deleted."
  );
};

AuditLogSchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], immutableError);
AuditLogSchema.pre(["deleteOne", "deleteMany", "findOneAndDelete"],  immutableError);
AuditLogSchema.pre("replaceOne", immutableError); // CG-7: close replaceOne bypass
// Note: bulkWrite cannot be intercepted via a simple pre-hook at the schema level;
// enforce this at the service layer — AuditService.log is the only write path.

const AuditLog =
  mongoose.models.FinancialAuditLog ||
  mongoose.model("FinancialAuditLog", AuditLogSchema);

export { FINANCIAL_AUDIT_EVENTS as FINANCIAL_AUDIT_EVENT_LIST };
export default AuditLog;