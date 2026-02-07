// services/auditService.js

import mongoose from "mongoose";
import CONSTANTS from "../configs/constants.js";

/**
 * ✅ AUDIT SERVICE
 * Logs all security events for compliance and debugging
 */

// Audit Log Schema
const AuditLogSchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: Object.values(CONSTANTS.AUDIT_EVENTS),
    required: true,
    index: true
  },
  
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinalizedEmployee',
    required: true,
    index: true
  },
  
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinalizedEmployee',
    default: null
  },
  
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  ipAddress: String,
  userAgent: String,
  
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for performance
AuditLogSchema.index({ eventType: 1, timestamp: -1 });
AuditLogSchema.index({ actorId: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

export class AuditService {
  
  /**
   * Log an audit event
   */
  static async log(event) {
    try {
      const auditEntry = new AuditLog(event);
      await auditEntry.save();
      
      // Optional: Send to external logging service
      // await this._sendToExternalLog(auditEntry);
      
      return auditEntry;
    } catch (error) {
      console.error('❌ Audit log error:', error);
      // Don't throw - audit failures shouldn't break the app
    }
  }

  /**
   * Get audit logs for a user
   */
  static async getUserLogs(userId, limit = 100) {
    return await AuditLog.find({ actorId: userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Get security violations
   */
  static async getViolations(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return await AuditLog.find({
      eventType: {
        $in: [
          CONSTANTS.AUDIT_EVENTS.PERMISSION_DENIED,
          CONSTANTS.AUDIT_EVENTS.HIERARCHY_VIOLATION,
          CONSTANTS.AUDIT_EVENTS.DEPARTMENT_VIOLATION
        ]
      },
      timestamp: { $gte: since }
    })
      .populate('actorId', 'individualName personalEmail')
      .sort({ timestamp: -1 })
      .lean();
  }
}

export default AuditService;