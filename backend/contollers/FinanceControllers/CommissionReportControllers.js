// models/FinanceModels/CommissionReport.js
import mongoose from "mongoose";
import mongoose from "mongoose";
import TransactionModel from "../../models/FinanceModals/TransactionModel.js";
import ExpenseReport from "../../models/FinanceModals/ExpenseReports.js";
import CommissionReport from "../../models/FinanceModals/CommissionReports.js";
import TablesModel from "../../models/FinanceModals/TablesModel"; // Rules
import {
  safeToObjectId,
  getSummaryObjectId,
  getDefinitionByNumericId,
  getInstanceByNumericFieldLineId,
  resolveInstanceForEntry,
  resolveSummaryIdForEntry,
  resolveDefinitionIdForEntry,
  computeLineAmount,
  buildLine,
  applyBalanceChange
} from "../../contollers/FinanceControllers/TransactionController.js"; 


export async function applyRulesEngine({ transactionType, baseAmount, session }) {
  // 1️⃣ Fetch rules for this transaction type
  const rules = await TablesModel.find({ transactionType }).session(session).lean();
  if (!rules.length) throw new Error(`No rules found for transaction type: ${transactionType}`);

  const transactionLines = [];

  for (const rule of rules) {
    const splits = rule.splits || [];
    const totalPercent = splits.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0) || 100;

    for (const split of splits) {
      const splitAmount = computeLineAmount(split, baseAmount, rule.incrementType, totalPercent);
      if (!splitAmount) continue;

      // Resolve IDs
      const instanceId = await resolveInstanceForEntry(split, session);
      const summaryId = await resolveSummaryIdForEntry(split, session);
      const definitionId = await resolveDefinitionIdForEntry(split, session);

      if (!instanceId || !summaryId || !definitionId) continue;

      // Build main line
      const mainLine = buildLine({
        instanceId,
        summaryId,
        definitionId,
        debitOrCredit: split.debitOrCredit,
        amount: splitAmount,
        description: split.fieldName,
        isReflection: !!split.isReflection
      });
      transactionLines.push(mainLine);

      // Build mirror lines
      if (Array.isArray(split.mirrors)) {
        for (const mirror of split.mirrors) {
          const mirrorInstanceId = await resolveInstanceForEntry(mirror, session);
          const mirrorSummaryId = await resolveSummaryIdForEntry(mirror, session);
          const mirrorDefinitionId = await resolveDefinitionIdForEntry(mirror, session);

          if (!mirrorInstanceId || !mirrorSummaryId || !mirrorDefinitionId) continue;

          const mirrorLine = buildLine({
            instanceId: mirrorInstanceId,
            summaryId: mirrorSummaryId,
            definitionId: mirrorDefinitionId,
            debitOrCredit: mirror.debitOrCredit,
            amount: splitAmount,
            description: mirror.fieldName || `${split.fieldName} Mirror`,
            isReflection: !!mirror.isReflection
          });

          transactionLines.push(mirrorLine);
        }
      }
    }
  }

  // Apply balances
  for (const line of transactionLines) {
    await applyBalanceChange({
      instanceId: line.instanceId,
      summaryId: line.summaryId,
      debitOrCredit: line.debitOrCredit,
      amount: Number(line.amount.toString())
    }, session);
  }

  return transactionLines;
};

export const closeCommissionPeriodController = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      fromDate,
      toDate,
      expenseReportIds = [],
      confirmCapitalUsage = false
    } = req.body;

    const periodKey = `${fromDate}_${toDate}`;

    /* --------------------------------------------------
       1️⃣ FETCH ELIGIBLE COMMISSION TRANSACTIONS
       -------------------------------------------------- */
    const commissionTxs = await TransactionModel.find({
      "orderDetails.readyForRetainedEarning": true,
      "orderDetails.retainedLocked": false,
      date: { $gte: new Date(fromDate), $lte: new Date(toDate) }
    }).session(session);

    if (!commissionTxs.length) {
      throw new Error("No commission transactions found for this period");
    }

    /* --------------------------------------------------
       2️⃣ CALCULATE COMMISSION REVENUE (FROM LINES)
       -------------------------------------------------- */
    let commissionAmount = 0;

    commissionTxs.forEach(tx => {
      tx.lines.forEach(line => {
        if (
          line.debitOrCredit === "credit" &&
          line.description?.toLowerCase().includes("commission revenue")
        ) {
          commissionAmount += Number(line.amount.toString());
        }
      });
    });

    /* --------------------------------------------------
       3️⃣ FETCH & SUM EXPENSE REPORTS
       -------------------------------------------------- */
    let expenseAmount = 0;
    let expenseReports = [];

    if (expenseReportIds.length) {
      expenseReports = await ExpenseReport.find({
        _id: { $in: expenseReportIds },
        status: "calculated"
      }).session(session);

      expenseReports.forEach(r => {
        expenseAmount += Number(r.totalAmount.toString());
      });
    }

    /* --------------------------------------------------
       4️⃣ NET RESULT
       -------------------------------------------------- */
    const netResult = commissionAmount - expenseAmount;

    if (netResult < 0 && !confirmCapitalUsage) {
      throw new Error("Loss detected. Capital usage confirmation required.");
    }

    /* --------------------------------------------------
       5️⃣ CREATE COMMISSION REPORT
       -------------------------------------------------- */
    const [commissionReport] = await CommissionReport.create([{
      periodKey,
      fromDate,
      toDate,
      commissionAmount,
      expenseAmount,
      netResult,
      resultType:
        netResult > 0 ? "profit" :
        netResult < 0 ? "loss" :
        "breakeven",
      status: "settled",
      settledAt: new Date(),
      commissionTransactionIds: commissionTxs.map(t => t._id)
    }], { session });

    /* --------------------------------------------------
       6️⃣ LOCK COMMISSION TRANSACTIONS
       -------------------------------------------------- */
    await TransactionModel.updateMany(
      { _id: { $in: commissionTxs.map(t => t._id) } },
      {
        $set: {
          "orderDetails.retainedLocked": true,
          "orderDetails.retainedLockedAt": new Date(),
          "orderDetails.retainedPeriodKey": periodKey,
          "orderDetails.commissionReportId": commissionReport._id
        }
      },
      { session }
    );

    /* --------------------------------------------------
       7️⃣ PAY EXPENSE REPORTS
       -------------------------------------------------- */
    for (const report of expenseReports) {
      await ExpenseReport.updateOne(
        { _id: report._id },
        {
          $set: {
            status: "paid",
            paidAt: new Date(),
            linkedCommissionReport: commissionReport._id
          }
        },
        { session }
      );

      await TransactionModel.updateMany(
        { _id: { $in: report.transactionIds } },
        {
          $set: {
            "expenseDetails.isCleared": true,
            "expenseDetails.clearedAt": new Date(),
            "expenseDetails.clearedPeriodKey": periodKey
          }
        },
        { session }
      );
    }

    /* --------------------------------------------------
       8️⃣ APPLY RULES (ACCOUNTING ENGINE)
       -------------------------------------------------- */

    // A) Revenue → Income
    await applyRulesEngine({
      transactionType: "CommissionRevenueToIncome",
      baseAmount: commissionAmount,
      session
    });

    // B) Profit or Loss → Capital
    if (netResult > 0) {
      await applyRulesEngine({
        transactionType: "CommissionIncomeToCapital",
        baseAmount: netResult,
        session
      });
    }

    if (netResult < 0) {
      await applyRulesEngine({
        transactionType: "CapitalToCommissionLoss",
        baseAmount: Math.abs(netResult),
        session
      });
    }

    await session.commitTransaction();
    session.endSession();

    res.json({
      message: "Commission period closed successfully",
      commissionReportId: commissionReport._id,
      commissionAmount,
      expenseAmount,
      netResult
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: error.message });
  }
};

export const fetchCommissionReportsController = async (req, res) => {
  try {
    const { status } = req.query;

    if (!["locked", "settled"].includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Use locked or settled."
      });
    }

    const reports = await CommissionReport.find({ status })
      .sort({ createdAt: -1 });

    res.json({
      count: reports.length,
      reports
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3️⃣ FETCH COMMISSION TRANSACTIONS BY FLAGS
export const fetchCommissionTransactionsController = async (req, res) => {
  try {
    const {
      expiryReached,
      readyForRetainedEarning,
      retainedLocked
    } = req.query;

    const query = {};

    if (expiryReached !== undefined) {
      query["orderDetails.expiryReached"] = expiryReached === "true";
    }

    if (readyForRetainedEarning !== undefined) {
      query["orderDetails.readyForRetainedEarning"] =
        readyForRetainedEarning === "true";
    }

    if (retainedLocked !== undefined) {
      query["orderDetails.retainedLocked"] =
        retainedLocked === "true";
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1 });

    res.json({
      count: transactions.length,
      transactions
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

