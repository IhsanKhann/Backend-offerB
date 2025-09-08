// controllers/FinanceControllers/ExpenseAndCommissionControllers.js
import mongoose from "mongoose";
import TransactionModel from "../../models/FinanceModals/TransactionModel.js";
import SummaryModel from "../../models/FinanceModals/SummaryModel.js";
import SummaryFieldLineModel from "../../models/FinanceModals/SummaryFieldLinesModel.js";
import TablesModel from "../../models/FinanceModals/TablesModel.js";

// ------------------ Summary Numeric IDs ------------------
const SID = {
  ALLOWANCES: 1100,
  EXPENSES: 1200,
  BANK: 1300,
  SALARIES: 1400,
  CASH: 1500,
  CAPITAL: 1600,
  COMMISSION: 1700,
};

// ------------------ Helpers ------------------

// Compute line amount based on increment type
const computeLineAmount = (split, baseAmount, incrementType, totalPercentage = 100) => {
  const percentageFactor = (split.percentage || 0) / totalPercentage;
  const fixedAmount = Number(split.fixedAmount || 0);
  let lineAmount = 0;

  switch (incrementType) {
    case "percentage":
      lineAmount = baseAmount * percentageFactor;
      break;
    case "fixed":
      lineAmount = fixedAmount;
      break;
    case "both":
      lineAmount = baseAmount * percentageFactor + fixedAmount;
      break;
    default:
      throw new Error(`Unknown increment type: ${incrementType}`);
  }

  return Math.round(lineAmount * 100) / 100;
};

// Debit/Credit conversion: debit = +, credit = -
const incBySide = (side, amount) => (side === "debit" ? amount : -amount);

// Fetch Summary ObjectId by numeric ID
async function getSummaryObjectId(summaryId, session) {
  const summary = await SummaryModel.findOne({ summaryId }).session(session);
  if (!summary) throw new Error(`Summary ${summaryId} not found`);
  return summary._id;
}

// Fetch FieldLine ObjectId by numeric ID
async function getFieldLineObjectId(fieldLineId, session) {
  if (!fieldLineId) return null;
  const fieldLine = await SummaryFieldLineModel.findOne({ fieldLineId }).session(session);
  return fieldLine ? fieldLine._id : null;
}

// Fetch field line document by numeric ID
async function getFieldLineDocByNumericId(fieldLineId, session) {
  if (!fieldLineId) return null;
  return await SummaryFieldLineModel.findOne({ fieldLineId }).session(session);
}

// Update balances for summaries and field lines
async function updateBalances(accountingLines, session) {
  for (const line of accountingLines) {
    if (line.debitOrCredit === "none") continue;

    const amt = incBySide(line.debitOrCredit, line.amount);

    // Update Field Line balance
    if (line.fieldLineObjectId) {
      await SummaryFieldLineModel.findByIdAndUpdate(
        line.fieldLineObjectId,
        { $inc: { balance: amt } },
        { session }
      );

      // Update parent Summary endingBalance
      const fieldLineDoc = await SummaryFieldLineModel.findById(line.fieldLineObjectId).session(session);
      if (fieldLineDoc && fieldLineDoc.summaryId) {
        await SummaryModel.findByIdAndUpdate(
          fieldLineDoc.summaryId,
          { $inc: { endingBalance: amt } },
          { session }
        );
      }
    } else if (line.summaryObjectId) {
      await SummaryModel.findByIdAndUpdate(
        line.summaryObjectId,
        { $inc: { endingBalance: amt } },
        { session }
      );
    }
  }
}

// ------------------ Controllers ------------------

/**
 * Expense Transaction Controller
 */
export const ExpenseTransactionController = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, name, description } = req.body;
    if (!amount || amount <= 0) throw new Error("Invalid amount");

    const rules = await TablesModel.find({ transactionType: "Expense Allocation" }).lean();
    if (!rules || rules.length === 0) throw new Error("No Expense Allocation rules found");

    const accountingLines = [];
    let totalDebits = 0;

    // 1) Recognition: Expense debits and Allowance credits
    for (const rule of rules) {
      const splits = rule.splits || [];
      const totalPercent = splits.reduce((s, sp) => s + (sp.percentage || 0), 0) || 100;

      for (const split of splits) {
        const lineAmount = computeLineAmount(split, amount, rule.incrementType, totalPercent);
        if (!lineAmount) continue;

        // Expense Debit
        const expenseSummaryObjId = await getSummaryObjectId(split.summaryId, session);
        const expenseFieldObjId = await getFieldLineObjectId(split.fieldLineId, session);

        accountingLines.push({
          summaryObjectId: expenseSummaryObjId,
          summaryId: split.summaryId,
          fieldLineObjectId: expenseFieldObjId,
          fieldLineId: split.fieldLineId,
          debitOrCredit: "debit",
          amount: lineAmount,
          fieldName: split.fieldName,
        });
        totalDebits += lineAmount;

        // Create Allowance Credit
        const allowanceFieldLineId = split.fieldLineId ? split.fieldLineId - 1000 : null; // e.g., 2106 → 1106
        const allowanceFieldObjId = allowanceFieldLineId
          ? (await getFieldLineDocByNumericId(allowanceFieldLineId, session))?._id
          : null;
        const allowanceSummaryObjId = await getSummaryObjectId(SID.ALLOWANCES, session);

        accountingLines.push({
          summaryObjectId: allowanceSummaryObjId,
          summaryId: SID.ALLOWANCES,
          fieldLineObjectId: allowanceFieldObjId,
          fieldLineId: allowanceFieldLineId,
          debitOrCredit: "credit",
          amount: lineAmount,
          fieldName: `Allowance for ${split.fieldName}`,
        });
      }
    }

    // 2) Funding: Commission → Cash → Capital if needed
    let remainingToFund = Math.round(totalDebits * 100) / 100;
    const commissionSummaryDoc = await SummaryModel.findOne({ summaryId: SID.COMMISSION }).session(session);
    const commissionBalance = commissionSummaryDoc?.endingBalance || 0;

    const cashSummaryObjId = await getSummaryObjectId(SID.CASH, session);

    if (commissionBalance > 0 && remainingToFund > 0) {
      const transferFromCommission = Math.min(commissionBalance, remainingToFund);
      const commissionObjId = await getSummaryObjectId(SID.COMMISSION, session);

      accountingLines.push({
        summaryObjectId: cashSummaryObjId,
        summaryId: SID.CASH,
        debitOrCredit: "debit",
        amount: transferFromCommission,
        fieldLineObjectId: null,
        fieldLineId: null,
        fieldName: "Fund from Commission → Cash",
      });
      accountingLines.push({
        summaryObjectId: commissionObjId,
        summaryId: SID.COMMISSION,
        debitOrCredit: "credit",
        amount: transferFromCommission,
        fieldLineObjectId: null,
        fieldLineId: null,
        fieldName: "Reduce Commission (fund expenses)",
      });

      remainingToFund -= transferFromCommission;
      remainingToFund = Math.round(remainingToFund * 100) / 100;
    }

    if (remainingToFund > 0.00001) {
      const capitalObjId = await getSummaryObjectId(SID.CAPITAL, session);

      accountingLines.push({
        summaryObjectId: cashSummaryObjId,
        summaryId: SID.CASH,
        debitOrCredit: "debit",
        amount: remainingToFund,
        fieldLineObjectId: null,
        fieldLineId: null,
        fieldName: "Fund from Capital → Cash",
      });
      accountingLines.push({
        summaryObjectId: capitalObjId,
        summaryId: SID.CAPITAL,
        debitOrCredit: "credit",
        amount: remainingToFund,
        fieldLineObjectId: null,
        fieldLineId: null,
        fieldName: "Reduce Capital (fund shortage)",
      });
      remainingToFund = 0;
    }

    // 3) Pay Allowances from Cash
    const allowanceCredits = accountingLines.filter(
      (l) => l.summaryId === SID.ALLOWANCES && l.debitOrCredit === "credit"
    );

    for (const allow of allowanceCredits) {
      const payAmount = allow.amount;
      const allowanceFieldObjId = allow.fieldLineId
        ? await getFieldLineObjectId(allow.fieldLineId, session)
        : null;

      // Debit allowance
      accountingLines.push({
        summaryObjectId: allow.summaryObjectId,
        summaryId: SID.ALLOWANCES,
        fieldLineObjectId: allowanceFieldObjId,
        fieldLineId: allow.fieldLineId,
        debitOrCredit: "debit",
        amount: payAmount,
        fieldName: `Pay Allowance - ${allow.fieldName}`,
      });

      // Credit cash
      accountingLines.push({
        summaryObjectId: cashSummaryObjId,
        summaryId: SID.CASH,
        fieldLineObjectId: null,
        fieldLineId: null,
        debitOrCredit: "credit",
        amount: payAmount,
        fieldName: `Cash Payment for Allowance - ${allow.fieldName}`,
      });
    }

    // Persist Transaction
    const txDoc = await TransactionModel.create(
      [
        {
          transactionId: Date.now(),
          date: new Date(),
          description: description || name || "Expense Transaction",
          amount,
          lines: accountingLines.map((l) => ({
            fieldLineId: l.fieldLineId,
            summaryId: l.summaryId,
            debitOrCredit: l.debitOrCredit,
            amount: l.amount,
          })),
        },
      ],
      { session }
    );

    // Update balances
    await updateBalances(accountingLines, session);

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Expense transaction posted successfully",
      transactionId: txDoc[0].transactionId,
      accountingLines,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("ExpenseTransactionController Error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

/**
 * Commission Transaction Controller
 */
export const CommissionTransactionController = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) throw new Error("Invalid commission amount");

    const cashObjId = await getSummaryObjectId(SID.CASH, session);
    const commissionObjId = await getSummaryObjectId(SID.COMMISSION, session);

    const accountingLines = [
      {
        summaryObjectId: cashObjId,
        summaryId: SID.CASH,
        fieldLineObjectId: null,
        fieldLineId: null,
        debitOrCredit: "debit",
        amount,
        fieldName: "Commission received (Cash)",
      },
      {
        summaryObjectId: commissionObjId,
        summaryId: SID.COMMISSION,
        fieldLineObjectId: null,
        fieldLineId: null,
        debitOrCredit: "credit",
        amount,
        fieldName: "Commission Income",
      },
    ];

    // Save transaction
    const txDoc = await TransactionModel.create(
      [
        {
          transactionId: Date.now(),
          date: new Date(),
          description: description || "Commission Transaction",
          amount,
          lines: accountingLines.map((l) => ({
            fieldLineId: l.fieldLineId,
            summaryId: l.summaryId,
            debitOrCredit: l.debitOrCredit,
            amount: l.amount,
          })),
        },
      ],
      { session }
    );

    await updateBalances(accountingLines, session);

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Commission transaction posted successfully",
      transactionId: txDoc[0].transactionId,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("CommissionTransactionController Error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

/**
 * Transfer Commission to Retained Income
 */
export const transferCommissionToRetained = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const commissionSummary = await SummaryModel.findOne({ summaryId: SID.COMMISSION }).session(session);
    const retainedFieldLine = await SummaryFieldLineModel.findOne({ fieldLineId: 5401 }).session(session);

    if (!commissionSummary) throw new Error("Commission summary not found");
    if (!retainedFieldLine) throw new Error("Retained Income field line (5401) not found");

    const retainedSummary = await SummaryModel.findById(retainedFieldLine.summaryId).session(session);
    const amount = Math.round((commissionSummary.endingBalance || 0) * 100) / 100;

    if (amount <= 0) return res.status(400).json({ error: "No commission to transfer" });

    const accountingLines = [
      {
        summaryObjectId: commissionSummary._id,
        summaryId: commissionSummary.summaryId,
        fieldLineObjectId: null,
        fieldLineId: null,
        debitOrCredit: "debit",
        amount,
        fieldName: "Close Commission → Retained",
      },
      {
        summaryObjectId: retainedSummary._id,
        summaryId: retainedSummary.summaryId,
        fieldLineObjectId: retainedFieldLine._id,
        fieldLineId: retainedFieldLine.fieldLineId,
        debitOrCredit: "credit",
        amount,
        fieldName: "Close Commission → Retained",
      },
    ];

    await TransactionModel.create(
      [
        {
          transactionId: Date.now(),
          date: new Date(),
          description: "Close commission to retained income",
          amount,
          lines: accountingLines.map((l) => ({
            fieldLineId: l.fieldLineId,
            summaryId: l.summaryId,
            debitOrCredit: l.debitOrCredit,
            amount: l.amount,
          })),
        },
      ],
      { session }
    );

    await updateBalances(accountingLines, session);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ message: `Transferred ${amount} commission → Retained Income`, amount });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

/**
 * Transfer Retained Income → Capital
 */
export const transferRetainedIncomeToCapital = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const retainedFieldLine = await SummaryFieldLineModel.findOne({ fieldLineId: 5401 }).session(session);
    const capitalFieldLine = await SummaryFieldLineModel.findOne({ fieldLineId: 5101 }).session(session);

    if (!retainedFieldLine || !capitalFieldLine) throw new Error("Retained Income or Capital field line not found");

    const amount = Math.round((retainedFieldLine.balance || 0) * 100) / 100;
    if (amount <= 0) return res.status(400).json({ error: "No retained income to transfer" });

    const retainedSummary = await SummaryModel.findById(retainedFieldLine.summaryId).session(session);
    const capitalSummary = await SummaryModel.findById(capitalFieldLine.summaryId).session(session);

    const accountingLines = [
      {
        summaryObjectId: retainedSummary._id,
        summaryId: retainedSummary.summaryId,
        fieldLineObjectId: retainedFieldLine._id,
        fieldLineId: retainedFieldLine.fieldLineId,
        debitOrCredit: "debit",
        amount,
        fieldName: "Transfer Retained → Capital",
      },
      {
        summaryObjectId: capitalSummary._id,
        summaryId: capitalSummary.summaryId,
        fieldLineObjectId: capitalFieldLine._id,
        fieldLineId: capitalFieldLine.fieldLineId,
        debitOrCredit: "credit",
        amount,
        fieldName: "Transfer Retained → Capital",
      },
    ];

    await TransactionModel.create(
      [
        {
          transactionId: Date.now(),
          date: new Date(),
          description: "Transfer retained to capital",
          amount,
          lines: accountingLines.map((l) => ({
            fieldLineId: l.fieldLineId,
            summaryId: l.summaryId,
            debitOrCredit: l.debitOrCredit,
            amount: l.amount,
          })),
        },
      ],
      { session }
    );

    await updateBalances(accountingLines, session);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ message: `Transferred ${amount} retained → capital`, amount });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};
