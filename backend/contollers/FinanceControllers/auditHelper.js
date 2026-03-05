// controllers/FinanceControllers/auditHelper.js
// Addresses F-18 — PRD §H: audit injection helper
//
// CRITICAL SEMANTICS:
//   writeAudit() MUST be called inside the same MongoDB session as the
//   parent financial mutation.  If the audit write throws, it propagates
//   upward and aborts the parent transaction — this is intentional.
//   Audit failure is a FATAL error that rolls back the mutation.
import AuditLog from "../../models/FinanceModals/AuditLogModel.js";

/**
 * Write a financial audit entry inside an existing MongoDB session.
 *
 * @param {object} params
 * @param {string}   params.event        - One of FINANCIAL_AUDIT_EVENTS
 * @param {ObjectId} [params.actorId]    - FinalizedEmployee who triggered the action
 * @param {ObjectId} [params.entityId]   - The primary document affected
 * @param {string}   [params.entityType] - Model name of entityId
 * @param {number}   [params.balanceBefore] - Integer minor units
 * @param {number}   [params.balanceAfter]  - Integer minor units
 * @param {string}   [params.currency]   - ISO currency code (default "PKR")
 * @param {object}   [params.meta]       - Any additional context
 * @param {ClientSession} params.session - REQUIRED: the active MongoDB session
 *
 * @throws {Error} on any write failure — caller's transaction will rollback
 */
export const writeAudit = async ({
  event,
  actorId,
  entityId,
  entityType,
  balanceBefore,
  balanceAfter,
  currency = "PKR",
  meta = {},
  session
}) => {
  if (!session) {
    throw new Error(
      "writeAudit: a MongoDB session is required for transactional audit writes."
    );
  }

  // AuditLog.create() with an array + session is the correct pattern
  // for transactional inserts in Mongoose.
  await AuditLog.create(
    [
      {
        event,
        actorId:       actorId   || null,
        entityId:      entityId  || null,
        entityType:    entityType || null,
        balanceBefore: balanceBefore != null ? balanceBefore : undefined,
        balanceAfter:  balanceAfter  != null ? balanceAfter  : undefined,
        currency,
        meta
      }
    ],
    { session }
  );
};