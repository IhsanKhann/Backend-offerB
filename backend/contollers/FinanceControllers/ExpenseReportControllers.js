// controllers/FinanceControllers/ExpenseReportControllers.js
// ═══════════════════════════════════════════════════════════════
// Phase 2 Hardening — Findings addressed:
//   H-04 — Transaction.updateMany (mark includedInPnL=true) now UNCOMMENTED and
//           executed INSIDE the session, atomically with ExpenseReport.create.
//           A unique index on periodKey (in ExpenseReports model) ensures only
//           one report can be created per period even under concurrent requests.
//   F-01 — All monetary arithmetic uses Math.round() — no parseFloat drift.
//   F-04 — currency: "PKR" threaded through all audit calls.
//   F-18 — AuditService.log for EXPENSE_REPORT_CREATED now called inside session
//           so audit failure rolls back report creation.
//   M-06 — fetchExpenseTransactionsController query field fixed:
//           was query.includedInPnL (top-level), now "expenseDetails.includedInPnL".
// ═══════════════════════════════════════════════════════════════
import mongoose from "mongoose";
import Transaction from "../../models/FinanceModals/TransactionModel.js";
import ExpenseReport from "../../models/FinanceModals/ExpenseReports.js";
import Cycle from "../../models/BussinessOperationModals/cyclesModel.js";
import Rule from "../../models/FinanceModals/TablesModel.js";

import {
  computeLineAmount,
  resolveInstanceForEntry,
  resolveSummaryIdForEntry,
  resolveDefinitionIdForEntry,
  buildLine,
  applyBalanceChange,
} from "../../contollers/FinanceControllers/TransactionController.js";
import AuditService from "../../services/auditService.js";

// ─────────────────────────────────────────────────────────────
// updateExpenseFlags — marks expenses as PAID (cash flow)
// ─────────────────────────────────────────────────────────────
async function updateExpenseFlags({ expenseTxIds, expenseReportIds = [], periodKey, paidBy, session }) {
  if (!expenseTxIds?.length) return;

  await Transaction.updateMany(
    { _id: { $in: expenseTxIds } },
    {
      $set: {
        "expenseDetails.isPaid":         true,
        "expenseDetails.isPaidAt":       new Date(),
        "expenseDetails.paidPeriodKey":  periodKey,
        "expenseDetails.paidBy":         paidBy,
      },
    },
    { session }
  );

  if (expenseReportIds.length) {
    await ExpenseReport.updateMany(
      { _id: { $in: expenseReportIds } },
      { status: "paid", paidAt: new Date() },
      { session }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// payExpensePeriodController
// F-18: AuditService.log inside session
// F-03: isReflection passed to applyBalanceChange
// ─────────────────────────────────────────────────────────────
export const payExpensePeriodController = async (req, res) => {
  if (!req.user?._id) return res.status(401).json({ error: "Actor identity required" });
  const paidBy = req.user._id;
  const { fromDate, toDate, periodKey } = req.body;

  // Fetch unpaid expense transactions BEFORE the session starts
  // to decide early if there's any work to do.
  const expenseTxs = await Transaction.find({
    type: "expense",
    "expenseDetails.isPaid": false,
    date: { $gte: fromDate, $lte: toDate },
  });

  if (!expenseTxs.length) {
    return res.json({ message: "No unpaid expenses found" });
  }

  // F-01: integer sum
  const baseAmount = expenseTxs.reduce((s, t) => s + Math.round(Number(t.amount)), 0);

  const rule = await Rule.findOne({ transactionType: "EXPENSE_PAY_LATER" }).lean();
  if (!rule) throw new Error("EXPENSE_PAY_LATER rule missing");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const tx = new Transaction({
        type: "journal",
        transactionType: "EXPENSE_PAY_LATER",
        amount: baseAmount,
        currency: "PKR",
        createdBy: paidBy,
        lines: [],
      });

      const totalPercent = rule.splits.reduce((s, sp) => s + Number(sp.percentage || 0), 0);

      for (const split of rule.splits) {
        // F-01: integer amount
        const amount = Math.round(computeLineAmount(split, baseAmount, rule.incrementType, totalPercent));
        if (!amount) continue;

        const instanceId   = await resolveInstanceForEntry(split, session);
        const summaryId    = await resolveSummaryIdForEntry({ instanceId }, session);
        const definitionId = await resolveDefinitionIdForEntry(split, session);

        const line = buildLine({
          instanceId, summaryId, definitionId,
          debitOrCredit: split.debitOrCredit,
          amount,
          description: split.fieldName,
          isReflection: !!split.isReflection,
        });

        tx.lines.push(line);

        await applyBalanceChange(
          { instanceId, summaryId, debitOrCredit: split.debitOrCredit, amount, isReflection: !!split.isReflection },
          session
        );

        for (const mirror of split.mirrors || []) {
          const mInst = await resolveInstanceForEntry(mirror, session);
          const mSum  = await resolveSummaryIdForEntry({ instanceId: mInst }, session);
          const mDef  = await resolveDefinitionIdForEntry(mirror, session);

          const mirrorLine = buildLine({
            instanceId: mInst, summaryId: mSum, definitionId: mDef,
            debitOrCredit: mirror.debitOrCredit,
            amount,
            description: `${split.fieldName} mirror`,
            isReflection: !!mirror.isReflection,
          });
          tx.lines.push(mirrorLine);

          await applyBalanceChange(
            { instanceId: mInst, summaryId: mSum, debitOrCredit: mirror.debitOrCredit, amount, isReflection: !!mirror.isReflection },
            session
          );
        }
      }

      await tx.save({ session });

      // F-18: audit INSIDE session
      await AuditService.log({
        eventType:  "EXPENSE_PAID",
        actorId:    paidBy,
        entityId:   tx._id,
        entityType: "Transaction",
        currency:   "PKR",
        meta: { periodKey, totalPaid: baseAmount, transactionsCount: expenseTxs.length },
      }, { type: "financial", session });

      const expenseReportIds = await ExpenseReport.distinct("_id", {
        transactionIds: { $in: expenseTxs.map(t => t._id) },
      });

      await updateExpenseFlags({
        expenseTxIds:     expenseTxs.map(t => t._id),
        expenseReportIds,
        periodKey,
        paidBy,
        session,
      });
    });

    session.endSession();
    res.json({ paidTransactions: expenseTxs.length, totalPaid: baseAmount });
  } catch (err) {
    session.endSession();
    console.error("payExpensePeriodController Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// generateExpenseReportByCycle
//
// H-04 FIX: Transaction.updateMany to mark includedInPnL=true is now
//   UNCOMMENTED and runs INSIDE the session atomically with ExpenseReport.create.
//   The unique index on periodKey (in ExpenseReports model) prevents duplicate
//   reports for the same period under concurrent calls.
//
// periodKey format: EXPENSE_YYYY-MM-DD_YYYY-MM-DD (deterministic, not using Date.now())
// ─────────────────────────────────────────────────────────────
export const generateExpenseReportByCycle = async (req, res) => {
  try {
    const { cycleId } = req.body;
    if (!cycleId) return res.status(400).json({ message: "cycleId is required" });

    const cycle = await Cycle.findById(cycleId);
    if (!cycle) return res.status(404).json({ message: "Cycle not found." });

    const fromStr  = cycle.startDate.toISOString().split("T")[0];
    const toStr    = cycle.endDate.toISOString().split("T")[0];
    // H-04 FIX: deterministic periodKey — not Date.now() suffixed
    const periodKey = `EXPENSE_${fromStr}_${toStr}`;

    // Fast idempotency check — avoid opening a session for duplicate
    const existingReport = await ExpenseReport.findOne({ periodKey }).lean();
    if (existingReport) {
      return res.status(409).json({
        message: "Expense report for this period already exists.",
        periodKey,
        reportId: existingReport._id,
      });
    }

    // Fetch transactions to report
    const transactions = await Transaction.find({
      type: "expense",
      "expenseDetails.includedInPnL": false,
      date: { $gte: cycle.startDate, $lte: cycle.endDate },
    });

    if (transactions.length === 0) {
      return res.status(200).json({
        message: "No new transactions found for this cycle.",
        cycle,
      });
    }

    // F-01: integer sum
    const totalAmount = transactions.reduce((sum, txn) => sum + Math.round(Number(txn.amount) || 0), 0);

    const session = await mongoose.startSession();
    let newReport;
    try {
      await session.withTransaction(async () => {
        // H-04 FIX: create report THEN mark transactions — both in same session
        [newReport] = await ExpenseReport.create([{
          periodKey,
          fromDate: cycle.startDate,
          toDate:   cycle.endDate,
          totalAmount,
          currency: "PKR",
          transactionIds: transactions.map(txn => txn._id),
          status: "calculated",
        }], { session });

        // H-04 FIX: mark transactions as reported ATOMICALLY with report creation
        await Transaction.updateMany(
          {
            _id: { $in: transactions.map(txn => txn._id) },
            "expenseDetails.includedInPnL": false,
          },
          { $set: { "expenseDetails.includedInPnL": true } },
          { session }
        );

        // F-18: audit INSIDE session
        await AuditService.log({
          eventType:  "EXPENSE_REPORT_CREATED",
          actorId:    req.user?._id || null,
          entityId:   newReport._id,
          entityType: "ExpenseReport",
          currency:   "PKR",
          meta: { periodKey, totalAmount, transactionsCount: transactions.length, method: "cycle" },
        }, { type: "financial", session });
      });

      session.endSession();
    } catch (err) {
      session.endSession();
      // E11000 on periodKey unique index = another request already created this report
      if (err.code === 11000) {
        return res.status(409).json({ message: "Expense report for this period already exists.", periodKey });
      }
      throw err;
    }

    return res.status(201).json({
      message: "Expense report generated successfully.",
      report: newReport,
      transactionsCount: transactions.length,
    });
  } catch (error) {
    console.error("generateExpenseReportByCycle Error:", error);
    return res.status(500).json({ message: "Server error while generating expense report.", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// generateExpenseReportByMonthsController
// H-04 FIX applied identically: Transaction.updateMany inside session.
// periodKey: deterministic format EXPENSE_YYYY-MM_YYYY-MM
// ─────────────────────────────────────────────────────────────
export const generateExpenseReportByMonthsController = async (req, res) => {
  try {
    const { months } = req.body || {};
    if (!months || !months.length) {
      return res.status(400).json({ message: "months array is required in request body" });
    }

    const monthRanges = months.map(m => {
      const startDate = new Date(`${m}-01T00:00:00.000Z`);
      const endDate   = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setMilliseconds(endDate.getMilliseconds() - 1);
      return { month: m, startDate, endDate };
    });

    // H-04 FIX: deterministic periodKey — not Date.now() suffixed
    const periodKey = `EXPENSE_${months[0]}_${months[months.length - 1]}`;

    const existingReport = await ExpenseReport.findOne({ periodKey }).lean();
    if (existingReport) {
      return res.status(409).json({
        message: "Expense report for this period already exists.",
        periodKey,
        reportId: existingReport._id,
      });
    }

    const allTransactions = [];
    for (const range of monthRanges) {
      const txns = await Transaction.find({
        type: "expense",
        "expenseDetails.includedInPnL": false,
        date: { $gte: range.startDate, $lte: range.endDate },
      });
      allTransactions.push(...txns);
    }

    if (allTransactions.length === 0) {
      return res.status(200).json({ message: "No unreported transactions found for the selected months." });
    }

    // F-01: integer sum
    const totalAmount = allTransactions.reduce((sum, txn) => sum + Math.round(Number(txn.amount) || 0), 0);

    const session = await mongoose.startSession();
    let newReport;
    try {
      await session.withTransaction(async () => {
        [newReport] = await ExpenseReport.create([{
          periodKey,
          fromDate: monthRanges[0].startDate,
          toDate:   monthRanges[monthRanges.length - 1].endDate,
          totalAmount,
          currency: "PKR",
          transactionIds: allTransactions.map(txn => txn._id),
          status: "calculated",
        }], { session });

        // H-04 FIX: mark transactions reported ATOMICALLY
        await Transaction.updateMany(
          {
            _id: { $in: allTransactions.map(txn => txn._id) },
            "expenseDetails.includedInPnL": false,
          },
          { $set: { "expenseDetails.includedInPnL": true } },
          { session }
        );

        // F-18: audit INSIDE session
        await AuditService.log({
          eventType:  "EXPENSE_REPORT_CREATED",
          actorId:    req.user?._id || null,
          entityId:   newReport._id,
          entityType: "ExpenseReport",
          currency:   "PKR",
          meta: { periodKey, totalAmount, transactionsCount: allTransactions.length, method: "months" },
        }, { type: "financial", session });
      });

      session.endSession();
    } catch (err) {
      session.endSession();
      if (err.code === 11000) {
        return res.status(409).json({ message: "Expense report for this period already exists.", periodKey });
      }
      throw err;
    }

    return res.status(201).json({
      message: "Expense report generated successfully for selected months.",
      report: newReport,
      transactionsCount: allTransactions.length,
    });
  } catch (error) {
    console.error("generateExpenseReportByMonthsController Error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// groupTransactionsByMonthController — read only, no changes required
// ─────────────────────────────────────────────────────────────
export const groupTransactionsByMonthController = async (req, res) => {
  try {
    const transactions = await Transaction.find({ type: "expense" }).sort({ date: 1 });
    const grouped = {};

    transactions.forEach(txn => {
      if (!txn.date) return;
      const monthKey = new Date(txn.date).toISOString().slice(0, 7);
      if (!grouped[monthKey]) grouped[monthKey] = { reported: [], unreported: [] };

      if (txn.expenseDetails?.isPaid === true) grouped[monthKey].reported.push(txn);
      else grouped[monthKey].unreported.push(txn);
    });

    const unreportedMonths = [];
    const reportedMonths   = [];

    Object.entries(grouped).forEach(([month, data]) => {
      if (data.unreported.length) unreportedMonths.push({ month, transactions: data.unreported });
      if (data.reported.length)   reportedMonths.push({ month, transactions: data.reported });
    });

    return res.json({ unreportedMonths, reportedMonths });
  } catch (error) {
    console.error("groupTransactionsByMonthController Error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const fetchExpenseReportsController = async (req, res) => {
  try {
    const { status } = req.query;
    if (!["calculated", "paid"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Use calculated or paid." });
    }
    const reports = await ExpenseReport.find({ status })
      .populate("transactionIds")
      .sort({ createdAt: -1 });
    res.json({ count: reports.length, reports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// M-06 FIX: query field was query.includedInPnL (top-level — wrong).
//           Now correctly uses "expenseDetails.includedInPnL".
export const fetchExpenseTransactionsController = async (req, res) => {
  try {
    const { includedInPnL, isPaid } = req.query;
    const query = { type: "expense" };

    if (includedInPnL !== undefined) {
      // M-06 FIX: correct nested field path
      query["expenseDetails.includedInPnL"] = includedInPnL === "true";
    }

    if (isPaid !== undefined) {
      query["expenseDetails.isPaid"] = isPaid === "true";
    }

    const transactions = await Transaction.find(query).sort({ date: -1 });
    res.json({ count: transactions.length, transactions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};