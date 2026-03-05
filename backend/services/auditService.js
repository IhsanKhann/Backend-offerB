// services/auditService.js
// Phase 2 Hardening — Findings addressed: F-18, CG-3, CG-4
//
// KEY CHANGES:
//   - financial audit calls now REQUIRE a session when type === "financial".
//     A missing session throws immediately so the caller's transaction rolls back.
//   - Non-financial (HR) audit failures are still swallowed (fire-and-forget),
//     consistent with the original design.
//   - AuditLog schema is defined inline here for the HR audit stream;
//     FinancialAuditLog is the separate immutable model for financial events.
import mongoose from "mongoose";
import CONSTANTS from "../configs/constants.js";
import FinancialAuditLog from "../models/FinanceModals/FinancialAuditLogModel.js";

const AuditLogSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: CONSTANTS.HR_AUDIT_EVENTS,
      required: true,
      index: true
    },
    actorId:   { type: mongoose.Schema.Types.ObjectId, ref: "FinalizedEmployee", default: null, index: true },
    targetId:  { type: mongoose.Schema.Types.ObjectId, ref: "FinalizedEmployee", default: null },
    details:   { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, versionKey: false }
);

AuditLogSchema.index({ eventType: 1, timestamp: -1 });
AuditLogSchema.index({ actorId: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 });

const AuditLog =
  mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);

export class AuditService {
  /**
   * Write an audit entry.
   *
   * For financial events (type: "financial"):
   *   - `session` is REQUIRED. A missing session throws immediately,
   *     propagating the error up to the caller's withTransaction() so
   *     the entire financial mutation rolls back.
   *   - The write is performed inside the caller's session so that
   *     audit failure causes transaction rollback (F-18).
   *
   * For HR events (type: "normal" or omitted):
   *   - `session` is not required; failures are logged but not thrown.
   *
   * @param {object} payload
   * @param {{ type?: "financial"|"normal", session?: ClientSession }} options
   */
  static async log(payload, options = {}) {
    const { type = "normal", session = null } = options;

    if (type === "financial") {
      // CG-3 / CG-4 FIX: session is mandatory for financial audit writes.
      // Without it, the audit can succeed while the parent transaction rolls back,
      // creating an audit record for an event that never happened.
      if (!session) {
        throw new Error(
          "AuditService.log: a MongoDB session is required for financial audit writes. " +
          "Pass { type: 'financial', session } to ensure atomicity."
        );
      }
      // Throws on failure — caller's withTransaction() will abort.
      await FinancialAuditLog.create([payload], { session });
      return;
    }

    // HR / non-financial: fire-and-forget; failures must not block business logic.
    try {
      await AuditLog.create(payload);
    } catch (error) {
      console.error("❌ HR Audit log error:", error.message);
    }
  }

  static async getUserLogs(userId, limit = 100) {
    return AuditLog.find({ actorId: userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }

  static async getViolations(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return AuditLog.find({
      eventType: { $in: ["PERMISSION_DENIED", "HIERARCHY_VIOLATION", "DEPARTMENT_VIOLATION"] },
      timestamp: { $gte: since },
    })
      .populate("actorId", "individualName personalEmail")
      .sort({ timestamp: -1 })
      .lean();
  }

  static async getFinancialLogs(entityId, entityType, limit = 100) {
    return FinancialAuditLog.find({ entityId, entityType })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}

export default AuditService;