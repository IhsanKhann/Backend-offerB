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

// Compute line amount
const computeLineAmount = (split, amount, incrementType, totalPercentage = 100) => {
  const percentageFactor = (split.percentage || 0) / totalPercentage;
  const fixedAmount = Number(split.fixedAmount || 0);
  let lineAmt = 0;

  switch (incrementType) {
    case "percentage":
      lineAmt = amount * percentageFactor;
      break;
    case "fixed":
      lineAmt = fixedAmount;
      break;
    case "both":
      lineAmt = amount * percentageFactor + fixedAmount;
      break;
    default:
      throw new Error(`Unknown incrementType: ${incrementType}`);
  }

  return Math.round(lineAmt * 100) / 100;
};

// Get ObjectId references for internal updates
async function getSummaryObjectId(numericSummaryId, session) {
  const summary = await SummaryModel.findOne({ summaryId: numericSummaryId }).session(session);
  if (!summary) throw new Error(`Summary with numeric ID ${numericSummaryId} not found`);
  return summary._id;
}

async function getFieldLineObjectId(numericFieldLineId, session) {
  if (!numericFieldLineId) return null;
  const fieldLine = await SummaryFieldLineModel.findOne({ fieldLineId: numericFieldLineId }).session(session);
  if (!fieldLine) throw new Error(`Field line with numeric ID ${numericFieldLineId} not found`);
  return fieldLine._id;
}

// Fund remaining imbalance using Capital
async function fundImbalance(imbalance, accountingLines, session) {
  const remaining = Math.abs(imbalance);
  if (remaining <= 0.0001) return 0;

  const cashSummaryObjectId = await getSummaryObjectId(SID.CASH, session);
  const capitalSummaryObjectId = await getSummaryObjectId(SID.CAPITAL, session);

  accountingLines.push({
    summaryObjectId: cashSummaryObjectId,
    summaryId: SID.CASH,
    fieldLineObjectId: null,
    fieldLineId: null,
    debitOrCredit: "debit",
    amount: remaining,
    fieldName: "Owner Funding (Cash) - auto funding",
  });
  accountingLines.push({
    summaryObjectId: capitalSummaryObjectId,
    summaryId: SID.CAPITAL,
    fieldLineObjectId: null,
    fieldLineId: null,
    debitOrCredit: "credit",
    amount: remaining,
    fieldName: "Owner Funding (Capital) - auto funding",
  });

  return 0;
}

// Update balances
async function updateBalances(accountingLines, session) {
  for (const l of accountingLines) {
    if (l.debitOrCredit === "none") continue;
    const amount = incBySide(l.debitOrCredit, l.amount);

    if (l.fieldLineObjectId) {
      await SummaryFieldLineModel.findByIdAndUpdate(
        l.fieldLineObjectId,
        { $inc: { balance: amount } },
        { session }
      );
      const fieldLineDoc = await SummaryFieldLineModel.findById(l.fieldLineObjectId).session(session);
      if (fieldLineDoc && fieldLineDoc.summaryId) {
        await SummaryModel.findByIdAndUpdate(
          fieldLineDoc.summaryId,
          { $inc: { endingBalance: amount } },
          { session }
        );
      }
    } else if (l.summaryObjectId) {
      await SummaryModel.findByIdAndUpdate(
        l.summaryObjectId,
        { $inc: { endingBalance: amount } },
        { session }
      );
    }
  }
}

// Main controller
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

      const accountingLines = [];
      let totalDebits = 0;
      let totalCredits = 0;

      for (const rule of rules) {
        const splits = rule.splits || [];
        const totalPercent = splits.reduce((s, sp) => s + (sp.percentage || 0), 0) || 100;

        for (const split of splits) {
          const numericSummaryId = Number(split.summaryId);
          const numericFieldLineId = split.fieldLineId != null ? Number(split.fieldLineId) : null;

          // ObjectIds for balance updates
          const summaryObjectId = await getSummaryObjectId(numericSummaryId, session);
          const fieldLineObjectId = numericFieldLineId ? await getFieldLineObjectId(numericFieldLineId, session) : null;

          const lineAmount = computeLineAmount(split, amount, rule.incrementType, totalPercent);
          if (!lineAmount || lineAmount <= 0) continue;

          const splitSide = split.debitOrCredit || "debit";
          accountingLines.push({
            summaryObjectId,
            summaryId: numericSummaryId,       // numeric ID saved in transaction
            fieldLineObjectId,
            fieldLineId: numericFieldLineId,   // numeric ID saved in transaction
            debitOrCredit: splitSide,
            amount: lineAmount,
            fieldName: split.fieldName || null,
          });

          if (splitSide === "debit") totalDebits += lineAmount;
          else totalCredits += lineAmount;

          // mirrors
          if (Array.isArray(split.mirrors)) {
            for (const m of split.mirrors) {
              const mNumericSummaryId = Number(m.summaryId);
              const mNumericFieldLineId = m.fieldLineId != null ? Number(m.fieldLineId) : null;

              const mSummaryObjectId = await getSummaryObjectId(mNumericSummaryId, session);
              const mFieldLineObjectId = mNumericFieldLineId ? await getFieldLineObjectId(mNumericFieldLineId, session) : null;

              accountingLines.push({
                summaryObjectId: mSummaryObjectId,
                summaryId: mNumericSummaryId,
                fieldLineObjectId: mFieldLineObjectId,
                fieldLineId: mNumericFieldLineId,
                debitOrCredit: "none",
                amount: lineAmount,
                fieldName: `Mirror (tracking): ${split.fieldName || ""}`,
              });
            }
          }
        }
      }

      // Debit cash for total debits
      const cashSummaryObjectId = await getSummaryObjectId(SID.CASH, session);
      accountingLines.push({
        summaryObjectId: cashSummaryObjectId,
        summaryId: SID.CASH,
        fieldLineObjectId: null,
        fieldLineId: null,
        debitOrCredit: "credit",
        amount: totalDebits,
        fieldName: "Payment for Expenses (Cash)",
      });
      totalCredits += totalDebits;

      // Handle imbalance
      let imbalance = Math.round((totalDebits - totalCredits) * 100) / 100;
      if (Math.abs(imbalance) > 0.0001) {
        await fundImbalance(imbalance, accountingLines, session);
      }

      // Save transaction (only numeric IDs!)
      const txDoc = await TransactionModel.create(
        [
          {
            transactionId: Date.now(),
            date: new Date(),
            description: description || name || "Expense Posting",
            amount,
            lines: accountingLines
              .filter((l) => l.debitOrCredit !== "none")
              .map((l) => ({
                fieldLineId: l.fieldLineId,   // numeric
                summaryId: l.summaryId,       // numeric
                debitOrCredit: l.debitOrCredit,
                amount: l.amount,
              })),
          },
        ],
        { session }
      );

      // Update balances using ObjectIds
      await updateBalances(accountingLines, session);

      await session.commitTransaction();
      session.endSession();

      return res.status(201).json({
        message: "Expense transaction posted successfully",
        transactionId: txDoc[0].transactionId,
        totals: { totalExpense: totalDebits, totalPaidFromCash: totalCredits },
        accountingLines: accountingLines.map(l => ({
          ...l,
          summaryObjectId: l.summaryObjectId.toString(),
          fieldLineObjectId: l.fieldLineObjectId ? l.fieldLineObjectId.toString() : null,
        })),
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();

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
