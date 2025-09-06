import mongoose from "mongoose";
import TransactionModel from "../../models/FinanceModals/TransactionModel.js";
import SummaryModel from "../../models/FinanceModals/SummaryModel.js";
import SummaryFieldLineModel from "../../models/FinanceModals/SummaryFieldLinesModel.js";
import TablesModel from "../../models/FinanceModals/TablesModel.js";

const SID = {
  ALLOWANCES: 1100,
  EXPENSES: 1200,
  BANK: 1300,
  COMMISSION: 1400,
  CASH: 1500,
  CAPITAL: 1600,
};

// Debit/Credit helper
const incBySide = (side, amt) => (side === "debit" ? amt : -amt);

// Compute split amount
const computeLineAmount = (split, amount, incrementType, totalPercentage = 100) => {
  let lineAmt = 0;
  const percentFactor = (split.percentage || 0) / totalPercentage;
  if (incrementType === "percentage" || incrementType === "both") lineAmt += amount * percentFactor;
  if (incrementType === "fixed" || incrementType === "both") lineAmt += Number(split.fixedAmount || 0);
  return Math.round(lineAmt * 100) / 100;
};

// Fund remaining imbalance using Capital
async function fundImbalance(imbalance, accountingLines) {
  const remaining = Math.abs(imbalance);
  if (remaining <= 0.0001) return 0;

  accountingLines.push({
    summaryId: SID.CASH,
    fieldLineId: null,
    debitOrCredit: "debit",
    amount: remaining,
    fieldName: "Owner Funding (Capital)",
  });
  accountingLines.push({
    summaryId: SID.CAPITAL,
    fieldLineId: null,
    debitOrCredit: "credit",
    amount: remaining,
    fieldName: "Funding -> Cash (Capital)",
  });

  return 0;
}

export const ExpenseTransactionController = async (req, res) => {
  const MAX_RETRIES = 5;
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const { amount, name, description } = req.body;
      if (!amount || typeof amount !== "number" || amount <= 0)
        return res.status(400).json({ error: "Invalid amount" });

      const rules = await TablesModel.find({ transactionType: "Expense" }).lean();
      if (!rules || rules.length === 0)
        return res.status(400).json({ error: "No expense rules defined" });

      const allSummaryIds = (await SummaryModel.find({}, { summaryId: 1 }).lean()).map(s => Number(s.summaryId));
      const allFieldLineIds = (await SummaryFieldLineModel.find({}, { fieldLineId: 1 }).lean()).map(f => Number(f.fieldLineId));

      const accountingLines = [];
      let totalDebits = 0;

      // Process each rule
      for (const rule of rules) {
        const totalPercent = (rule.splits || []).reduce((s, split) => s + (split.percentage || 0), 0) || 100;

        for (const split of rule.splits || []) {
          const summaryId = Number(split.summaryId);
          if (isNaN(summaryId) || !allSummaryIds.includes(summaryId))
            return res.status(400).json({ error: "Invalid summaryId in split", split });

          const fieldLineId = split.fieldLineId != null ? Number(split.fieldLineId) : null;
          if (fieldLineId && !allFieldLineIds.includes(fieldLineId))
            return res.status(400).json({ error: "Invalid fieldLineId in split", split });

          const lineAmount = computeLineAmount(split, amount, rule.incrementType, totalPercent);
          if (!lineAmount || lineAmount <= 0) continue;

          // Debit Expense summary
          accountingLines.push({
            summaryId,
            fieldLineId,
            debitOrCredit: "debit",
            amount: lineAmount,
            fieldName: split.fieldName || null,
          });
          totalDebits += lineAmount;

          // Mirror allowances (tracking only)
          if (split.mirror && split.mirror.summaryId != null) {
            const mirrorSummaryId = Number(split.mirror.summaryId);
            const mirrorFieldLineId = split.mirror.fieldLineId != null ? Number(split.mirror.fieldLineId) : null;

            if (!isNaN(mirrorSummaryId)) {
              accountingLines.push({
                summaryId: mirrorSummaryId,
                fieldLineId: mirrorFieldLineId,
                debitOrCredit: "none",
                amount: lineAmount,
                fieldName: `Mirror (Allowances): ${split.fieldName}`,
              });
            }
          }
        }
      }

      // Credit Cash for total expense
      accountingLines.push({
        summaryId: SID.CASH,
        fieldLineId: null,
        debitOrCredit: "credit",
        amount: totalDebits,
        fieldName: "Payment for Expenses",
      });

      // Check imbalance
      let imbalance = Math.round((totalDebits - totalDebits) * 100) / 100;
      if (Math.abs(imbalance) > 0.0001) {
        imbalance = await fundImbalance(imbalance, accountingLines);
        if (imbalance !== 0) throw new Error("Unable to fund transaction imbalance.");
      }

      // Save transaction
      const txDoc = await TransactionModel.create(
        [
          {
            transactionId: Date.now(),
            date: new Date(),
            description: description || name || "Expense Posting",
            amount,
            lines: accountingLines
              .filter(l => l.debitOrCredit !== "none")
              .map(l => ({
                fieldLineId: l.fieldLineId || null,
                summaryId: l.summaryId,
                debitOrCredit: l.debitOrCredit,
                amount: l.amount,
              })),
          },
        ],
        { session }
      );

      // Update balances
      for (const l of accountingLines) {
        if (l.debitOrCredit === "none") continue;

        if (l.fieldLineId) {
          const fieldLineDoc = await SummaryFieldLineModel.findOneAndUpdate(
            { fieldLineId: l.fieldLineId },
            { $inc: { balance: incBySide(l.debitOrCredit, l.amount) } },
            { new: true, session }
          );
          if (fieldLineDoc && !isNaN(fieldLineDoc.summaryId)) {
            await SummaryModel.updateOne(
              { summaryId: Number(fieldLineDoc.summaryId) },
              { $inc: { endingBalance: incBySide(l.debitOrCredit, l.amount) } },
              { session }
            );
          }
        } else if (!isNaN(l.summaryId)) {
          await SummaryModel.updateOne(
            { summaryId: l.summaryId },
            { $inc: { endingBalance: incBySide(l.debitOrCredit, l.amount) } },
            { session }
          );
        }
      }

      await session.commitTransaction();
      session.endSession();

      return res.status(201).json({
        message: "Expense transaction posted successfully",
        transactionId: txDoc[0].transactionId,
        totals: { totalExpense: totalDebits },
        accountingLines,
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();

      // Retry on transient conflict
      if (err.hasErrorLabel && err.hasErrorLabel("TransientTransactionError")) {
        retryCount++;
        console.log(`Write conflict detected. Retry attempt ${retryCount}/${MAX_RETRIES}`);
        continue;
      }

      console.error("ExpenseTransactionController error:", err);
      return res.status(500).json({ error: err.message || String(err) });
    }
  }

  return res.status(500).json({ error: "Max transaction retries exceeded." });
};
