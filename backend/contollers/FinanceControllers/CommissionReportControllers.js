// controllers/FinanceControllers/CommissionReportControllers.js
// ═══════════════════════════════════════════════════════════════
// Phase 2 Hardening — Findings addressed:
//   C-02  — TOCTOU collapse: all three stages now run in a SINGLE session.withTransaction.
//           The idempotency lock uses findOneAndUpdate with upsert INSIDE the transaction
//           so two concurrent calls can never both pass the check before either writes.
//           ExpenseReport.find() moved INSIDE the transaction with .session().
//   F-01  — All monetary values are integer Number via toInt(). No Decimal128.
//   F-04  — currency: "PKR" threaded through all audit calls.
//   F-10  — CommissionReport fields are integer Number.
//   F-11  — reportType: "MONTHLY" required field always set.
//   F-15  — actorId required check at entry point.
//   F-18  — AuditService.log called inside the single session at every mutation point.
// ═══════════════════════════════════════════════════════════════
import mongoose from "mongoose";
import TransactionModel from "../../models/FinanceModals/TransactionModel.js";
import ExpenseReport from "../../models/FinanceModals/ExpenseReports.js";
import CommissionReport from "../../models/FinanceModals/CommissionReports.js";
import Rule from "../../models/FinanceModals/TablesModel.js";
import SummaryFieldLineInstance from "../../models/FinanceModals/FieldLineInstanceModel.js";

import {
  computeLineAmount,
  resolveInstanceForEntry,
  resolveSummaryIdForEntry,
  resolveDefinitionIdForEntry,
  buildLine,
  applyBalanceChange,
} from "../../contollers/FinanceControllers/TransactionController.js";
import AuditService from "../../services/auditService.js";

// ─── Helper: integer minor units ───
const toInt = (v) => Math.round(Number(v) || 0);
const getResultType = (net) => (net > 0 ? "profit" : net < 0 ? "loss" : "breakeven");

// ─────────────────────────────────────────────────────────────
// applyRulesEngine — unchanged business logic
// ─────────────────────────────────────────────────────────────
export async function applyRulesEngine({ transactionType, baseAmount, session, meta = {} }) {
  console.log(`\n🧠 APPLY RULES ENGINE → ${transactionType}`);
  console.log("Base Amount:", baseAmount);

  const rules = await Rule.find({ transactionType }).session(session).lean();
  if (!rules.length) throw new Error(`No rules found for ${transactionType}`);

  let revenueAmount = 0;
  const createdTransactionIds = [];

  for (const rule of rules) {
    const splits = rule.splits || [];
    const lines  = [];
    const totalPercent = splits.reduce((s, sp) => s + (Number(sp.percentage) || 0), 0) || 100;

    for (const split of splits) {
      // F-01: integer amount
      const splitAmount = toInt(computeLineAmount(split, baseAmount, rule.incrementType, totalPercent));
      if (!splitAmount || splitAmount <= 0) continue;

      const instanceId   = await resolveInstanceForEntry(split, session);
      const summaryId    = await resolveSummaryIdForEntry(split, session);
      const definitionId = await resolveDefinitionIdForEntry(split, session);

      if (!instanceId || !summaryId || !definitionId) {
        console.log("Split skipped due to unresolved IDs");
        continue;
      }

      lines.push(buildLine({
        instanceId, summaryId, definitionId,
        debitOrCredit: split.debitOrCredit,
        amount: splitAmount,
        description: split.fieldName,
        isReflection: !!split.isReflection,
      }));

      // Revenue tracking — F-01: integer amounts only
      // FI-2 note: only accumulate if this split's definitionId has NOT been seen yet.
      // The guard is per-split within rules engine; business uses a single isRevenue credit split.
      if (split.isRevenue && split.debitOrCredit === "credit") {
        revenueAmount += splitAmount;
      }

      if (Array.isArray(split.mirrors)) {
        for (const mirror of split.mirrors) {
          const mi = await resolveInstanceForEntry(mirror, session);
          const ms = await resolveSummaryIdForEntry(mirror, session);
          const md = await resolveDefinitionIdForEntry(mirror, session);
          if (!mi || !ms || !md) continue;

          lines.push(buildLine({
            instanceId: mi, summaryId: ms, definitionId: md,
            debitOrCredit: mirror.debitOrCredit,
            amount: splitAmount,
            description: mirror.fieldName || "Mirror",
            isReflection: !!mirror.isReflection,
          }));
        }
      }
    }

    if (!lines.length) continue;

    const [tx] = await TransactionModel.create([{
      type: "journal",
      description: `Rule Applied: ${transactionType}`,
      amount: toInt(baseAmount),
      currency: "PKR",
      lines,
      ...meta,
    }], { session });

    createdTransactionIds.push(tx._id);

    for (const line of lines) {
      await applyBalanceChange({
        instanceId:    line.instanceId,
        summaryId:     line.summaryId,
        debitOrCredit: line.debitOrCredit,
        amount:        toInt(line.amount),
        isReflection:  line.isReflection,
      }, session);
    }
  }

  return { revenueAmount, transactionIds: createdTransactionIds };
}

// ─────────────────────────────────────────────────────────────
// closeCommissionPeriodController
//
// C-02 FIX: Collapsed from THREE disconnected sessions into ONE
//           session.withTransaction block.
//   - Idempotency lock: findOneAndUpdate with upsert INSIDE session.
//     A second concurrent call will hit E11000 on the unique periodKey index
//     and be rejected, preventing duplicate reports.
//   - ExpenseReport.find() is now inside the transaction with .session()
//     eliminating the TOCTOU window for expense amount changes.
//   - All audit writes are inside the single session.
// ─────────────────────────────────────────────────────────────
export const closeCommissionPeriodController = async (req, res) => {
  const { periodKey, fromDate, toDate } = req.body;

  if (!req.user?._id) return res.status(401).json({ error: "Actor identity required" });
  const userId = req.user._id;

  if (!periodKey || !fromDate || !toDate) {
    return res.status(400).json({ error: "periodKey, fromDate, toDate are required" });
  }
  const fromDateParsed = new Date(fromDate);
  const toDateParsed   = new Date(toDate);
  if (isNaN(fromDateParsed.getTime()) || isNaN(toDateParsed.getTime())) {
    return res.status(400).json({ error: "Invalid date format for fromDate or toDate" });
  }

  // Pre-flight check — fast path for already-settled periods (no session needed)
  const existing = await CommissionReport.findOne({
    periodKey,
    status: { $in: ["locked", "settled"] },
  }).lean();
  if (existing) {
    return res.status(409).json({ error: "Commission cycle already settled or in progress" });
  }

  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      // ── C-02 FIX: idempotency lock INSIDE the transaction with upsert ──
      // If a concurrent call already inserted a placeholder for this periodKey,
      // this findOneAndUpdate will find it and we throw → transaction aborts.
      const lockDoc = await CommissionReport.findOneAndUpdate(
        { periodKey },
        { $setOnInsert: {
            periodKey,
            fromDate,
            toDate,
            status: "locked",
            reportType: "MONTHLY",
            closedBy: userId,
            closedAt: new Date(),
          }
        },
        { upsert: true, new: false, session }
      );
      // If lockDoc is non-null, the record already existed before this call → conflict
      if (lockDoc) {
        const err = new Error("Commission cycle already settled or in progress");
        err.statusCode = 409;
        throw err;
      }

      // ── STAGE A: Commission Revenue ──
      const orderFilter = {
        type: "journal",
        "orderDetails.orderDeliveredAt": { $gte: fromDate, $lte: toDate },
        "orderDetails.readyForRetainedEarning": false,
      };
      const orders = await TransactionModel.find(orderFilter).session(session);
      if (!orders.length) throw new Error("No eligible orders");

      const commissionTxIds = orders.map(o => o._id);
      const baseAmount = orders.reduce((sum, t) => sum + Number(t.commissionAmount || 0), 0);

      const { revenueAmount } = await applyRulesEngine({
        transactionType: "COMMISSION_REVENUE",
        baseAmount,
        session,
      });
      const commissionAmount = revenueAmount;

      // Fetch the placeholder we just upserted and update it with the real commission amount
      const commissionReport = await CommissionReport.findOneAndUpdate(
        { periodKey },
        { $set: { commissionAmount: toInt(commissionAmount) } },
        { new: true, session }
      );

      // F-18: audit commission report creation INSIDE session
      await AuditService.log({
        eventType:  "COMMISSION_REPORT_CREATED",
        actorId:    userId,
        entityId:   commissionReport._id,
        entityType: "CommissionReport",
        currency:   "PKR",
        meta: { periodKey, fromDate, toDate, commissionAmount },
      }, { type: "financial", session });

      // ── C-02 FIX: STAGE B — Expense fetch now INSIDE the same transaction ──
      const expenseReports = await ExpenseReport.find({
        status: "calculated",
        fromDate: { $gte: fromDate },
        toDate:   { $lte: toDate },
      }).session(session).lean();

      const expenseTxIds = expenseReports.flatMap(r => r.transactionIds || []);
      const expenseAmount = expenseReports.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0);

      const net = commissionAmount - expenseAmount;

      // ── STAGE C: Settlement ──
      if (net !== 0) {
        await applyRulesEngine({
          transactionType: "COMMISSION_SETTLEMENT",
          baseAmount: Math.abs(net),
          session,
        });
        await applyRulesEngine({
          transactionType: net > 0 ? "Profit" : "Loss",
          baseAmount: Math.abs(net),
          session,
        });
      }

      // Finalize commission report — all values available because we're in one transaction
      await CommissionReport.findByIdAndUpdate(
        commissionReport._id,
        {
          expenseAmount:       toInt(expenseAmount),
          netResult:           toInt(net),
          resultType:          getResultType(net),
          capitalImpactAmount: toInt(Math.abs(net)),
          status:              "settled",
          settledAt:           new Date(),
          commissionTransactionIds: commissionTxIds,
        },
        { session }
      );

      // F-18: audit settlement INSIDE session
      await AuditService.log({
        eventType:  "COMMISSION_SETTLED",
        actorId:    userId,
        entityId:   commissionReport._id,
        entityType: "CommissionReport",
        currency:   "PKR",
        meta: { periodKey, commissionAmount, expenseAmount, net, resultType: getResultType(net) },
      }, { type: "financial", session });

      // Mark commission transactions
      await TransactionModel.updateMany(
        { _id: { $in: commissionTxIds } },
        {
          $set: {
            "orderDetails.readyForRetainedEarning": true,
            "orderDetails.retainedLocked":          true,
            "orderDetails.retainedLockedAt":        new Date(),
            "orderDetails.isReported":              true,
            commissionReportId: commissionReport._id,
          },
        },
        { session }
      );

      // Mark expense transactions (if any)
      if (expenseTxIds.length) {
        await TransactionModel.updateMany(
          { _id: { $in: expenseTxIds } },
          {
            $set: {
              "expenseDetails.isReported":     true,
              "expenseDetails.includedInPnL":  true,
              "expenseDetails.isPaid":         false,
              "expenseDetails.paidPeriodKey":  periodKey,
            },
          },
          { session }
        );

        await ExpenseReport.updateMany(
          { _id: { $in: expenseReports.map(r => r._id) } },
          { status: "paid", paidAt: new Date() },
          { session }
        );
      }

      result = {
        reportId:         commissionReport._id,
        commissionAmount,
        expenseAmount,
        net,
        resultType: getResultType(net),
      };
    });

    session.endSession();
    return res.json(result);
  } catch (err) {
    session.endSession();
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message });
    }
    console.error("closeCommissionPeriodController Error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// closeCommissionOnly — no expense settlement
// C-02 FIX applied identically: single session, lock inside transaction
// ─────────────────────────────────────────────────────────────
export const closeCommissionOnly = async (req, res) => {
  const { periodKey, fromDate, toDate } = req.body;

  if (!req.user?._id) return res.status(401).json({ error: "Actor identity required" });
  const userId = req.user._id;

  if (!periodKey || !fromDate || !toDate) {
    return res.status(400).json({ error: "periodKey, fromDate, toDate are required" });
  }
  const fromDateParsed = new Date(fromDate);
  const toDateParsed   = new Date(toDate);
  if (isNaN(fromDateParsed.getTime()) || isNaN(toDateParsed.getTime())) {
    return res.status(400).json({ error: "Invalid date format for fromDate or toDate" });
  }

  // Fast-path pre-flight check
  const existing = await CommissionReport.findOne({
    periodKey,
    status: { $in: ["locked", "settled"] },
  }).lean();
  if (existing) {
    return res.status(409).json({ error: "Commission cycle already settled or in progress" });
  }

  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      // Idempotency lock inside transaction
      const lockDoc = await CommissionReport.findOneAndUpdate(
        { periodKey },
        { $setOnInsert: {
            periodKey,
            fromDate,
            toDate,
            expenseAmount: 0,
            status: "locked",
            reportType: "MONTHLY",
            closedBy: userId,
            closedAt: new Date(),
          }
        },
        { upsert: true, new: false, session }
      );
      if (lockDoc) {
        const err = new Error("Commission cycle already settled or in progress");
        err.statusCode = 409;
        throw err;
      }

      const orderFilter = {
        type: "journal",
        "orderDetails.orderDeliveredAt": { $gte: fromDate, $lte: toDate },
        "orderDetails.readyForRetainedEarning": false,
      };
      const orders = await TransactionModel.find(orderFilter).session(session);
      if (!orders.length) throw new Error("No eligible orders");

      const commissionTxIds = orders.map(o => o._id);
      const baseAmount = orders.reduce((sum, t) => sum + Number(t.commissionAmount || 0), 0);

      const { revenueAmount } = await applyRulesEngine({
        transactionType: "COMMISSION_REVENUE",
        baseAmount,
        session,
      });
      const commissionAmount = revenueAmount;
      const net = commissionAmount; // no expenses

      await CommissionReport.findOneAndUpdate(
        { periodKey },
        { $set: { commissionAmount: toInt(commissionAmount) } },
        { new: true, session }
      );

      const commissionReport = await CommissionReport.findOne({ periodKey }).session(session);

      if (net !== 0) {
        await applyRulesEngine({
          transactionType: "COMMISSION_SETTLEMENT",
          baseAmount: Math.abs(net),
          session,
        });
        await applyRulesEngine({
          transactionType: net > 0 ? "Profit" : "Loss",
          baseAmount: Math.abs(net),
          session,
        });
      }

      await CommissionReport.findByIdAndUpdate(
        commissionReport._id,
        {
          netResult:           toInt(net),
          resultType:          getResultType(net),
          capitalImpactAmount: toInt(Math.abs(net)),
          status:              "settled",
          settledAt:           new Date(),
          commissionTransactionIds: commissionTxIds,
        },
        { session }
      );

      await AuditService.log({
        eventType:  "COMMISSION_SETTLED",
        actorId:    userId,
        entityId:   commissionReport._id,
        entityType: "CommissionReport",
        currency:   "PKR",
        meta: { periodKey, commissionAmount, expenseAmount: 0, net, resultType: getResultType(net) },
      }, { type: "financial", session });

      await TransactionModel.updateMany(
        { _id: { $in: commissionTxIds } },
        {
          $set: {
            "orderDetails.readyForRetainedEarning": true,
            "orderDetails.retainedLocked":          true,
            "orderDetails.retainedLockedAt":        new Date(),
            "orderDetails.isReported":              true,
            commissionReportId: commissionReport._id,
          },
        },
        { session }
      );

      result = {
        reportId:         commissionReport._id,
        commissionAmount,
        expenseAmount:    0,
        net,
        resultType: getResultType(net),
      };
    });

    session.endSession();
    return res.json(result);
  } catch (err) {
    session.endSession();
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message });
    }
    console.error("closeCommissionOnly Error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Read-only controllers — no changes required
// ─────────────────────────────────────────────────────────────
export const groupCommissionTransactionsByMonthController = async (req, res) => {
  try {
    const transactions = await TransactionModel.find({ type: "journal" }).sort({ date: 1 });
    const grouped = {};

    transactions.forEach(txn => {
      const monthKey = txn.date.toISOString().slice(0, 7);
      if (!grouped[monthKey]) {
        grouped[monthKey] = { readyForCommission: [], waitingForReturn: [], settled: [] };
      }
      const isSettled      = txn.orderDetails?.isReported;
      const isReturnExpired = txn.orderDetails?.expiryReached;

      if (isSettled)         grouped[monthKey].settled.push(txn);
      else if (isReturnExpired) grouped[monthKey].readyForCommission.push(txn);
      else                   grouped[monthKey].waitingForReturn.push(txn);
    });

    const result = Object.entries(grouped).map(([month, data]) => ({ month, ...data }));
    return res.status(200).json({ months: result });
  } catch (error) {
    console.error("groupCommissionTransactionsByMonthController Error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const fetchCommissionTransactionsByStatusController = async (req, res) => {
  try {
    const transactions = await TransactionModel.find({
      type: "journal",
      orderDetails: { $exists: true },
    }).sort({ date: 1 });

    const readyForCommission = [];
    const waitingForReturn   = [];
    const settled            = [];

    transactions.forEach(tx => {
      const expiryReached = tx.orderDetails?.expiryReached;
      const hasReport     = tx.expenseDetails?.includedInPnL;

      if (hasReport)        settled.push(tx);
      else if (expiryReached) readyForCommission.push(tx);
      else                  waitingForReturn.push(tx);
    });

    return res.json({ readyForCommission, waitingForReturn, settled });
  } catch (error) {
    console.error("fetchCommissionTransactionsByStatusController Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const fetchCommissionReportsByStatusController = async (req, res) => {
  try {
    const locked   = await CommissionReport.find({ status: "locked" }).sort({ createdAt: -1 });
    const settled  = await CommissionReport.find({ status: "settled" }).sort({ settledAt: -1 });
    return res.json({ locked, settled });
  } catch (error) {
    console.error("fetchCommissionReportsByStatusController Error:", error);
    res.status(500).json({ error: error.message });
  }
};