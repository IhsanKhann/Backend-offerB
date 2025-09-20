// controllers/finance/breakupControllers.js
import mongoose from "mongoose";
const { ObjectId } = mongoose.Types;

import TransactionModel from "../../models/FinanceModals/TransactionModel.js";
import SummaryModel from "../../models/FinanceModals/SummaryModel.js";
import SummaryFieldLineInstance from "../../models/FinanceModals/FieldLineInstanceModel.js";
import BreakupFileModel from "../../models/FinanceModals/BreakupFiles.js";
import BreakupRuleModel from "../../models/FinanceModals/BreakupRules.js";

const safeToObjectId = (id) => {
  if (!id) return null;
  const idStr = String(id);
  return mongoose.Types.ObjectId.isValid(idStr)
    ? new mongoose.Types.ObjectId(idStr)
    : null;
};

/**
 * Core value calculator
 */
function computeValue(baseAmount, split, order = {}) {
  let value = 0;

  // --- Base rules ---
  if (split.fixedAmount > 0) value += split.fixedAmount;
  if (split.percentage > 0) value += (split.percentage / 100) * baseAmount;

  // --- Order-specific rules ---
  if (split.isActual && order.actualAmount !== undefined) {
    value = order.actualAmount;
  }
  if (split.perTransaction) {
    value += split.fixedAmount;
  }
  if (split.periodicity && split.periodicity !== "none") {
    value = adjustForPeriodicity(value, split.periodicity);
  }

  // --- Tax-specific rules ---
  if (split.type === "tax") {
    if (
      split.slabStart !== null &&
      split.slabEnd !== null &&
      baseAmount >= split.slabStart &&
      baseAmount <= split.slabEnd
    ) {
      value = split.fixedTax ?? value;
      if (split.additionalTaxPercentage) {
        value += (split.additionalTaxPercentage / 100) * baseAmount;
      }
    }
  }

  return Math.round(value * 100) / 100;
}

function adjustForPeriodicity(value, periodicity) {
  switch (periodicity) {
    case "yearly":
      return value / 12;
    case "biannual":
      return value / 6;
    case "quarterly":
      return value / 3;
    default:
      return value;
  }
}

/**
 * Resolve numeric summaryId -> Summary _id
 */
async function getSummaryObjectId(numericSummaryId, session = null) {
  if (numericSummaryId === null || numericSummaryId === undefined) return null;
  const q = SummaryModel.findOne({ summaryId: numericSummaryId });
  if (session) q.session(session);
  const summary = await q;
  if (!summary) throw new Error(`Summary with summaryId ${numericSummaryId} not found`);
  return summary._id;
}

/**
 * Update balances
 */
async function applyBalanceChange({ instanceObjectId, summaryObjectId, summaryNumericId, debitOrCredit, amount }, session = null) {
  const amt = Number(amount || 0);
  if (amt === 0) return;

  const increment = debitOrCredit === "debit" ? amt : -amt;

  if (instanceObjectId) {
    const iid = safeToObjectId(instanceObjectId);
    if (!iid) return;
    await SummaryFieldLineInstance.findByIdAndUpdate(iid, { $inc: { balance: increment } }, { session });
    const inst = session
      ? await SummaryFieldLineInstance.findById(iid).session(session)
      : await SummaryFieldLineInstance.findById(iid);
    if (inst && inst.summaryId) {
      await SummaryModel.findByIdAndUpdate(inst.summaryId, { $inc: { endingBalance: increment } }, { session });
    }
    return;
  }

  if (summaryObjectId) {
    const sid = safeToObjectId(summaryObjectId);
    if (sid) {
      await SummaryModel.findByIdAndUpdate(sid, { $inc: { endingBalance: increment } }, { session });
    }
    return;
  }

  if (summaryNumericId) {
    const sdoc = await SummaryModel.findOne({ summaryId: summaryNumericId }).session(session);
    if (sdoc) {
      await SummaryModel.findByIdAndUpdate(sdoc._id, { $inc: { endingBalance: increment } }, { session });
    }
    return;
  }
}

/**
 * Save transaction + apply balances
 */
async function persistTransactionAndApply(accountingLines, description, session) {
  const resolvedTxLines = [];

  for (const l of accountingLines) {
    let resolvedSummaryId = null;
    if (l.summaryObjectId) {
      resolvedSummaryId = safeToObjectId(l.summaryObjectId);
    } else if (l.summaryNumericId) {
      try {
        resolvedSummaryId = await getSummaryObjectId(l.summaryNumericId, session);
      } catch {
        resolvedSummaryId = null;
      }
    }

    resolvedTxLines.push({
      instanceId: safeToObjectId(l.instanceObjectId),
      summaryId: resolvedSummaryId,
      definitionId: safeToObjectId(l.definitionId),
      debitOrCredit: l.debitOrCredit,
      amount: Math.round(Number(l.amount || 0) * 100) / 100,
      fieldName: l.fieldName || "",
    });
  }

  const txDoc = await TransactionModel.create([{
    transactionId: Date.now(),
    date: new Date(),
    description,
    amount: 0,
    lines: resolvedTxLines,
  }], { session });

  for (const l of accountingLines) {
    await applyBalanceChange(l, session);
  }

  return txDoc[0];
}

// ------------------- Middleware -------------------

/**
 * Step 1: Apply rules ONCE to create the master (order) breakup
 */
export const orderSummaryMiddleware = async (req, res, next) => {
  try {
    const { orderAmount, orderType, buyerId, sellerId, orderId, actualAmount } = req.body;

    if (!orderAmount || !orderType || !buyerId || !sellerId || !orderId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const rules = await BreakupRuleModel.find({
      transactionType: { $in: [orderType, `${orderType}Tax`] }
    }).lean();

    if (!rules || rules.length === 0) {
      return res.status(404).json({ error: `No BreakupRules found for type ${orderType}` });
    }

    const computeLines = (ruleset, baseAmount) =>
      ruleset.splits.map(split => ({
        componentName: split.componentName,
        category: split.type,
        value: computeValue(baseAmount, split, { actualAmount }),
        debitOrCredit: split.debitOrCredit,
        summaryId: split.summaryId,
        instanceId: split.instanceId,
        definitionId: split.definitionId,
        ruleType: ruleset.transactionType,
      }));

    // Apply all rules once
    let allLines = [];
    for (const r of rules) {
      allLines = allLines.concat(computeLines(r, orderAmount));
    }

    const totals = allLines.reduce((acc, l) => {
      if (l.debitOrCredit === "debit") acc.debit += l.value;
      if (l.debitOrCredit === "credit") acc.credit += l.value;
      return acc;
    }, { debit: 0, credit: 0 });

    const parentBreakup = new BreakupFileModel({
      orderId,
      orderType,
      orderAmount,
      buyerId,
      sellerId,
      parentBreakupId: null,
      lines: allLines,
      totalDebit: totals.debit,
      totalCredit: totals.credit,
    });

    await parentBreakup.save();
    req.parentBreakup = parentBreakup;
    next();
  } catch (err) {
    console.error("orderSummaryMiddleware error:", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Step 2: Derive Seller & Buyer breakups from parent (no re-calculation)
 */
export const childrenSummariesMiddleware = async (req, res, next) => {
  try {
    const parent = req.parentBreakup;
    if (!parent) return res.status(500).json({ error: "Parent breakup not found" });

    const childDocs = [];

    // Seller child = entries relevant to seller (commissions, charges, receivable)
    const sellerLines = parent.lines.filter(l =>
      ["commission", "charge", "sellerShare"].includes(l.category) ||
      l.componentName.toLowerCase().includes("seller") ||
      l.componentName.toLowerCase().includes("commission")
    );
    if (sellerLines.length > 0) {
      const sd = sellerLines.reduce((acc, l) => {
        if (l.debitOrCredit === "debit") acc.debit += l.value;
        else acc.credit += l.value;
        return acc;
      }, { debit: 0, credit: 0 });

      const sellerChild = new BreakupFileModel({
        ...parent.toObject(),
        parentBreakupId: parent._id,
        lines: sellerLines,
        totalDebit: sd.debit,
        totalCredit: sd.credit,
        summaryOwner: "seller",
      });
      await sellerChild.save();
      childDocs.push(sellerChild);
    }

    // Buyer child = entries relevant to buyer (duties, premium, payable)
    const buyerLines = parent.lines.filter(l =>
      ["tax", "duty", "allowance", "deduction"].includes(l.category) ||
      l.componentName.toLowerCase().includes("buyer")
    );
    if (buyerLines.length > 0) {
      const bd = buyerLines.reduce((acc, l) => {
        if (l.debitOrCredit === "debit") acc.debit += l.value;
        else acc.credit += l.value;
        return acc;
      }, { debit: 0, credit: 0 });

      const buyerChild = new BreakupFileModel({
        ...parent.toObject(),
        parentBreakupId: parent._id,
        lines: buyerLines,
        totalDebit: bd.debit,
        totalCredit: bd.credit,
        summaryOwner: "buyer",
      });
      await buyerChild.save();
      childDocs.push(buyerChild);
    }

    req.childBreakups = childDocs;
    next();
  } catch (err) {
    console.error("childrenSummariesMiddleware error:", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Step 3: Post transaction (based only on parent/master)
 */
export const transactionController = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const parent = req.parentBreakup;
    if (!parent || !parent.lines?.length) throw new Error("Parent breakup missing or empty");

    const accountingLines = parent.lines.map(line => ({
      instanceObjectId: line.instanceId,
      summaryObjectId: line.summaryId,
      definitionId: line.definitionId,
      debitOrCredit: line.debitOrCredit,
      amount: line.value,
      fieldName: line.componentName,
    }));

    const tx = await persistTransactionAndApply(
      accountingLines,
      `Transaction for Order ID: ${parent.orderId}`,
      session
    );

    await BreakupFileModel.findByIdAndUpdate(
      parent._id,
      { transactionId: tx._id, processedAt: new Date() },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "✅ Transaction posted successfully",
      transactionId: tx._id,
      orderId: parent.orderId,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("transactionController error:", err);
    return res.status(500).json({ error: err.message });
  }
};
