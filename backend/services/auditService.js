import mongoose from "mongoose";
import CONSTANTS from "../configs/constants.js"
import FinancialAuditLog from "../models/HRModals/FinancialAuditLogModel.js"

const AuditLogSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: CONSTANTS.HR_AUDIT_EVENTS,
      required: true,
      index: true
    },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "FinalizedEmployee", default: null, index: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, ref: "FinalizedEmployee", default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, versionKey: false }
);

AuditLogSchema.index({ eventType: 1, timestamp: -1 });
AuditLogSchema.index({ actorId: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);

export class AuditService {
  static async log(payload, options = {}) {
    const { type = "normal", session = null } = options;
    try {
      if (type === "financial") {
        await FinancialAuditLog.create([payload], { session });
        return;
      }
      await AuditLog.create(payload);
    } catch (error) {
      if (type === "financial") throw error;
      console.error("❌ Audit log error:", error.message);
    }
  }

  static async getUserLogs(userId, limit = 100) {
    return AuditLog.find({ actorId: userId }).sort({ timestamp: -1 }).limit(limit).lean();
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