// controllers/finance/breakupControllers.js
import mongoose from "mongoose";
const { ObjectId } = mongoose.Types;

import TransactionModel from "../../models/FinanceModals/TransactionModel.js";
import SummaryModel from "../../models/FinanceModals/SummaryModel.js";
import SummaryFieldLineInstance from "../../models/FinanceModals/FieldLineInstanceModel.js";
import BreakupFileModel from "../../models/FinanceModals/BreakupFiles.js";
import BreakupRuleModel from "../../models/FinanceModals/BreakupRules.js";

/* -------------------------------
   Helpers
-------------------------------- */
const safeNumber = (val) => {
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

const safeToObjectId = (id) => {
  if (!id) return null;
  const idStr = String(id);
  return mongoose.Types.ObjectId.isValid(idStr)
    ? new mongoose.Types.ObjectId(idStr)
    : null;
};

/**
 * Get or create SummaryFieldLineInstance
 */
async function getOrCreateInstance(split) {
  try {
    if (!split.summaryId || !split.definitionId) {
      console.warn("⚠️ Split missing summaryId or definitionId", split);
      return null;
    }

    const filter = {
      summaryId: safeToObjectId(split.summaryId),
      definitionId: safeToObjectId(split.definitionId),
      fieldLineNumericId: split.fieldLineNumericId ?? null,
    };

    let instance = await SummaryFieldLineInstance.findOne(filter);
    if (!instance) {
      instance = new SummaryFieldLineInstance({
        ...filter,
        name: split.componentName,
        balance: 0,
      });
      await instance.save();
      console.log("🆕 Created new instance:", {
        id: instance._id,
        name: instance.name,
        summaryId: instance.summaryId,
      });
    } else {
      console.log("♻️ Reusing existing instance:", {
        id: instance._id,
        name: instance.name,
        summaryId: instance.summaryId,
      });
    }

    return instance;
  } catch (err) {
    console.error("❌ getOrCreateInstance error:", err);
    return null;
  }
}

/**
 * Compute value dynamically for a split
 */
function computeSplitValue(orderAmount, split, actualAmount) {
  let value = 0;

  value += safeNumber(split.fixedAmount);
  if (split.percentage) {
    value += (split.percentage / 100) * orderAmount;
  }

  if (split.perTransaction) {
    value +=
      safeNumber(split.fixedAmount) +
      ((split.percentage ?? 0) / 100) * orderAmount;
  }

  if (split.periodicity && split.periodicity !== "none") {
    switch (split.periodicity) {
      case "yearly":
        value = value / 12;
        break;
      case "biannual":
        value = value / 6;
        break;
      case "quarterly":
        value = value / 3;
        break;
    }
  }

  if (
    split.type === "tax" &&
    split.slabStart != null &&
    split.slabEnd != null
  ) {
    if (orderAmount >= split.slabStart && orderAmount <= split.slabEnd) {
      value = safeNumber(split.fixedTax ?? value);
      if (split.additionalTaxPercentage) {
        value += (split.additionalTaxPercentage / 100) * orderAmount;
      }
    }
  }

  return Math.round(value * 100) / 100;
}

/* -------------------------------
   Step 1: Parent breakup
-------------------------------- */
export const orderSummaryMiddleware = async (req, res, next) => {
  try {
    const { orderAmount, orderType, buyerId, sellerId, orderId, actualAmount } =
      req.body;

    if (!orderAmount || !orderType || !buyerId || !sellerId || !orderId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const rules = await BreakupRuleModel.find({
      transactionType: { $in: [orderType, `${orderType}Tax`] },
    }).lean();

    if (!rules || rules.length === 0) {
      return res
        .status(404)
        .json({ error: `No BreakupRules found for type ${orderType}` });
    }

    let allLines = [];
    const appliedRules = [];

    for (const r of rules) {
      for (const split of r.splits) {
        const amount = safeNumber(
          computeSplitValue(orderAmount, split, actualAmount)
        );

        // ✅ Ensure instance exists (auto-create if missing)
        const instance = await getOrCreateInstance(split);

        const line = {
          componentName: split.componentName,
          category: split.type,
          amount,
          debitOrCredit: split.debitOrCredit,
          summaryId: split.summaryId,
          instanceId: instance?._id,
          definitionId: split.definitionId,
          ruleType: r.transactionType,
        };

        allLines.push(line);
        appliedRules.push({
          rule: r.transactionType,
          component: split.componentName,
          amount,
          summaryId: split.summaryId,
          instanceId: instance?._id,
        });
      }
    }

    const totals = allLines.reduce(
      (acc, l) => {
        if (l.debitOrCredit === "debit") acc.debit += safeNumber(l.amount);
        if (l.debitOrCredit === "credit") acc.credit += safeNumber(l.amount);
        return acc;
      },
      { debit: 0, credit: 0 }
    );

    const parentBreakup = new BreakupFileModel({
      orderId,
      orderType,
      orderAmount,
      actualAmount,
      buyerId,
      sellerId,
      parentBreakupId: null,
      lines: allLines,
      totalDebit: safeNumber(totals.debit),
      totalCredit: safeNumber(totals.credit),
    });

    await parentBreakup.save();
    req.parentBreakup = parentBreakup;

    console.log("✅ Parent breakup created:", {
      orderId,
      totalDebit: totals.debit,
      totalCredit: totals.credit,
      appliedRules,
    });

    next();
  } catch (err) {
    console.error("❌ orderSummaryMiddleware error:", err);
    return res.status(500).json({ error: err.message });
  }
};

/* -------------------------------
   Step 2: Children breakups
-------------------------------- */
export const childrenSummariesMiddleware = async (req, res, next) => {
  try {
    const parent = req.parentBreakup;
    if (!parent)
      return res.status(500).json({ error: "Parent breakup not found" });

    const childDocs = [];
    const debugChildren = [];

    const createChild = async (lines, type) => {
      const totals = lines.reduce(
        (acc, l) => {
          if (l.debitOrCredit === "debit") acc.debit += safeNumber(l.amount);
          else acc.credit += safeNumber(l.amount);
          return acc;
        },
        { debit: 0, credit: 0 }
      );

      const child = new BreakupFileModel({
        orderId: parent.orderId,
        orderType: parent.orderType,
        orderAmount: parent.orderAmount,
        buyerId: parent.buyerId,
        sellerId: parent.sellerId,
        parentBreakupId: parent._id,
        lines,
        totalDebit: safeNumber(totals.debit),
        totalCredit: safeNumber(totals.credit),
      });

      await child.save();
      debugChildren.push({
        type,
        childId: child._id,
        totalDebit: totals.debit,
        totalCredit: totals.credit,
        linesCount: lines.length,
        components: lines.map((l) => l.componentName),
      });

      return child;
    };

    const sellerLines = parent.lines.filter(
      (l) =>
        ["commission", "charge"].includes(l.category) ||
        l.componentName.toLowerCase().includes("seller")
    );
    if (sellerLines.length > 0)
      childDocs.push(await createChild(sellerLines, "seller"));

    const buyerLines = parent.lines.filter(
      (l) =>
        ["tax", "duty", "allowance", "deduction"].includes(l.category) ||
        l.componentName.toLowerCase().includes("buyer")
    );
    if (buyerLines.length > 0)
      childDocs.push(await createChild(buyerLines, "buyer"));

    req.childBreakups = childDocs;
    console.log("✅ Child breakups created:", debugChildren);

    next();
  } catch (err) {
    console.error("❌ childrenSummariesMiddleware error:", err);
    return res.status(500).json({ error: err.message });
  }
};

/* -------------------------------
   Step 3: Transaction
-------------------------------- */
export const transactionController = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const parent = req.parentBreakup;
    if (!parent || !parent.lines?.length) {
      throw new Error("❌ Parent breakup not found or has no lines");
    }

    const appliedLines = [];
    const skippedLines = [];
    const accountingLines = [];

    for (const line of parent.lines) {
      const summaryId = safeToObjectId(line.summaryId);
      if (!summaryId) {
        skippedLines.push({ reason: "Invalid summaryId", line });
        continue;
      }

      const amount = safeNumber(line.amount ?? line.value);
      if (!amount) {
        skippedLines.push({ reason: "Amount is 0", line });
        continue;
      }

      accountingLines.push({
        summaryObjectId: summaryId,
        debitOrCredit: line.debitOrCredit,
        amount,
        lineDetail: line,
      });
      appliedLines.push({ line, amount, appliedTo: summaryId });

      if (Array.isArray(line.mirrors)) {
        for (const mirror of line.mirrors) {
          const mirrorSummaryId = safeToObjectId(mirror.summaryId);
          if (!mirrorSummaryId) {
            skippedLines.push({
              reason: "Invalid mirror summaryId",
              line: mirror,
            });
            continue;
          }
          accountingLines.push({
            summaryObjectId: mirrorSummaryId,
            debitOrCredit: mirror.debitOrCredit,
            amount,
            lineDetail: mirror,
          });
          appliedLines.push({
            line: mirror,
            amount,
            appliedTo: mirrorSummaryId,
            mirror: true,
          });
        }
      }
    }

    // ✅ Update balances (instances already exist from middleware)
    for (const l of accountingLines) {
      await SummaryModel.findByIdAndUpdate(
        l.summaryObjectId,
        {
          $inc: {
            balance: l.debitOrCredit === "debit" ? l.amount : -l.amount,
          },
        },
        { session }
      );
    }

    const totalAmount = accountingLines.reduce(
      (sum, l) => sum + safeNumber(l.amount),
      0
    );
    const tx = new TransactionModel({
      narration: `Transaction for Order ID: ${parent.orderId}`,
      lines: accountingLines.map((l) => ({
        summaryObjectId: l.summaryObjectId,
        debitOrCredit: l.debitOrCredit,
        amount: l.amount,
      })),
      amount: totalAmount,
      createdAt: new Date(),
    });
    await tx.save({ session });

    await BreakupFileModel.findByIdAndUpdate(
      parent._id,
      { transactionId: tx._id, processedAt: new Date() },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "✅ Transaction posted successfully",
      orderId: parent.orderId,
      transactionId: tx._id,
      totals: {
        debit: parent.totalDebit,
        credit: parent.totalCredit,
      },
      appliedLines,
      skippedLines,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ transactionController error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};
