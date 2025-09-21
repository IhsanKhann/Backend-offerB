// controllers/FinanceControllers/OrderControllers.js
import mongoose from "mongoose";
const { ObjectId } = mongoose.Types;

import BreakupRuleModel from "../../models/FinanceModals/BreakupRules.js";
import SummaryFieldLineInstance from "../../models/FinanceModals/FieldLineInstanceModel.js";
import BreakupFileModel from "../../models/FinanceModals/BreakupFiles.js";
import TransactionModel from "../../models/FinanceModals/TransactionModel.js";

// -------------------------------
// Helpers
// -------------------------------
const safeNumber = (val) => {
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

const safeToObjectId = (id) => {
  if (!id) return null;
  const idStr = String(id);
  return mongoose.Types.ObjectId.isValid(idStr) ? new ObjectId(idStr) : null;
};

const adjustForPeriodicity = (value, periodicity) => {
  switch (periodicity) {
    case "yearly": return value / 12;
    case "biannual": return value / 6;
    case "quarterly": return value / 3;
    default: return value;
  }
};

const computeSplitValue = (orderAmount, split) => {
  let value = 0;
  const contributions = [];

  if (split.fixedAmount) {
    value += safeNumber(split.fixedAmount);
    contributions.push(`fixedAmount=${split.fixedAmount}`);
  }

  if (split.percentage) {
    const percValue = (split.percentage / 100) * orderAmount;
    value += percValue;
    contributions.push(`percentage=${split.percentage}% of ${orderAmount}=${percValue}`);
  }

  if (split.perTransaction) {
    const perTransValue = safeNumber(split.fixedAmount) + ((split.percentage ?? 0) / 100) * orderAmount;
    value += perTransValue;
    contributions.push(`perTransaction adjustment=${perTransValue}`);
  }

  if (split.periodicity && split.periodicity !== "none") {
    const oldValue = value;
    value = adjustForPeriodicity(value, split.periodicity);
    contributions.push(`periodicity=${split.periodicity} adjusted ${oldValue} => ${value}`);
  }

  if (split.type === "tax" && split.slabStart != null && split.slabEnd != null) {
    if (orderAmount >= split.slabStart && orderAmount <= split.slabEnd) {
      const oldValue = value;
      value = safeNumber(split.fixedTax ?? value);
      contributions.push(`tax slab applied: fixedTax=${split.fixedTax ?? oldValue}`);
      if (split.additionalTaxPercentage) {
        const addTax = (split.additionalTaxPercentage / 100) * orderAmount;
        value += addTax;
        contributions.push(`additionalTaxPercentage=${split.additionalTaxPercentage}% of ${orderAmount}=${addTax}`);
      }
    } else {
      contributions.push(`tax slab skipped: orderAmount=${orderAmount} not in [${split.slabStart}, ${split.slabEnd}]`);
    }
  }

  value = Math.round(value * 100) / 100;
  console.debug(`[DEBUG] computeSplitValue for ${split.componentName}: ${value} (${contributions.join(", ")})`);

  return value;
};

const resolveOrCreateInstance = async (split, session = null) => {
  try {
    let summaryObjId = safeToObjectId(split.summaryId);
    let defObjId = safeToObjectId(split.definitionId);

    if (!summaryObjId) summaryObjId = new ObjectId();
    if (!defObjId) defObjId = new ObjectId();

    if (split.instanceId) {
      const inst = await SummaryFieldLineInstance.findById(safeToObjectId(split.instanceId)).session(session);
      if (inst) return inst;
    }

    const filter = { summaryId: summaryObjId, definitionId: defObjId };
    if (split.fieldLineId || split.fieldLineNumericId) {
      filter.fieldLineNumericId = split.fieldLineId ?? split.fieldLineNumericId;
    }

    let instance = await SummaryFieldLineInstance.findOne(filter).session(session);
    if (instance) return instance;

    // Create new instance
    const docToCreate = {
      name: split.componentName ?? "Auto Instance",
      summaryId: summaryObjId,
      definitionId: defObjId,
      fieldLineNumericId: filter.fieldLineNumericId ?? null,
      balance: 0,
      startingBalance: 0,
      endingBalance: 0,
    };

    if (split.instanceId) docToCreate._id = safeToObjectId(split.instanceId);

    instance = await SummaryFieldLineInstance.create([docToCreate], { session });
    return instance[0];
  } catch (err) {
    console.error("[ERROR] resolveOrCreateInstance:", err, "split:", split);
    return null;
  }
};

// Update balance of SummaryFieldLineInstance
const updateInstanceBalance = async (instance, value, debitOrCredit, session) => {
  if (!instance) return;

  if (instance.startingBalance === undefined || instance.startingBalance === null) {
    instance.startingBalance = instance.balance ?? 0;
  }

  if (debitOrCredit === "debit") instance.balance = (instance.balance ?? 0) + value;
  else if (debitOrCredit === "credit") instance.balance = (instance.balance ?? 0) - value;

  instance.endingBalance = instance.balance;

  await instance.save({ session });
};

// -------------------------------
// Main Controller
// -------------------------------
export const createOrderWithTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { orderAmount, orderType, buyerId, sellerId, orderId } = req.body;
      if (!orderAmount || !orderType || !buyerId || !sellerId || !orderId) {
        throw new Error("Missing required fields");
      }

      const rules = await BreakupRuleModel.find({
        transactionType: { $in: [orderType, `${orderType}Tax`] }
      }).session(session).lean();

      if (!rules?.length) throw new Error(`No BreakupRules found for type ${orderType}`);

      const allLines = [];

      for (const r of rules) {
        for (const split of r.splits || []) {
          const value = computeSplitValue(orderAmount, split);

          // Resolve or create instance
          const inst = await resolveOrCreateInstance(split, session);
          await updateInstanceBalance(inst, value, split.debitOrCredit, session);

          const mirrorsResolved = [];
          for (const m of split.mirrors || []) {
            const mirrorInst = await resolveOrCreateInstance({
              ...m,
              summaryId: m.summaryId ?? split.summaryId,
              definitionId: m.definitionId ?? split.definitionId,
              fieldLineId: m.fieldLineId ?? m.fieldLineNumericId ?? split.fieldLineId ?? split.fieldLineNumericId,
            }, session);

            await updateInstanceBalance(mirrorInst, value, m.debitOrCredit, session);

            mirrorsResolved.push({
              ...m,
              value,
              amount: value,
              instanceId: mirrorInst?._id ?? null,
              summaryId: m.summaryId ?? split.summaryId,
              definitionId: m.definitionId ?? split.definitionId,
              debitOrCredit: m.debitOrCredit,
              fieldLineId: m.fieldLineId ?? m.fieldLineNumericId ?? split.fieldLineId ?? split.fieldLineNumericId,
              _isMirror: true,
            });
          }

          allLines.push({
            componentName: split.componentName,
            category: split.type,
            value,
            amount: value,
            debitOrCredit: split.debitOrCredit,
            summaryId: split.summaryId,
            instanceId: inst?._id ?? null,
            definitionId: split.definitionId,
            fieldLineId: split.fieldLineId ?? split.fieldLineNumericId ?? null,
            mirrors: mirrorsResolved,
            ruleType: r.transactionType,
          });
        }
      }

      // Parent breakup totals
      const totals = allLines.reduce((acc, l) => {
        if (l.debitOrCredit === "debit") acc.debit += safeNumber(l.value);
        else if (l.debitOrCredit === "credit") acc.credit += safeNumber(l.value);
        return acc;
      }, { debit: 0, credit: 0 });

      const parentBreakup = new BreakupFileModel({
        orderId,
        orderType,
        orderAmount,
        actualAmount: orderAmount,
        buyerId,
        sellerId,
        parentBreakupId: null,
        lines: allLines,
        totalDebit: safeNumber(totals.debit),
        totalCredit: safeNumber(totals.credit),
      });
      await parentBreakup.save({ session });

      // Child breakups
      const createChildBreakup = async (lines, type) => {
        const totals = lines.reduce((acc, l) => {
          if (l.debitOrCredit === "debit") acc.debit += safeNumber(l.value);
          else acc.credit += safeNumber(l.value);
          return acc;
        }, { debit: 0, credit: 0 });

        const child = new BreakupFileModel({
          orderId,
          orderType,
          orderAmount,
          buyerId,
          sellerId,
          parentBreakupId: parentBreakup._id,
          lines,
          type,
          totalDebit: totals.debit,
          totalCredit: totals.credit,
        });
        await child.save({ session });
        return child;
      };

      const sellerChild = await createChildBreakup(allLines.filter(l => l.debitOrCredit === "debit"), "seller");
      const buyerChild = await createChildBreakup(allLines.filter(l => l.debitOrCredit === "credit"), "buyer");

      // Transaction lines
      const transactionLines = [];
      allLines.forEach(l => {
        transactionLines.push({
          instanceId: l.instanceId,
          summaryId: l.summaryId,
          definitionId: l.definitionId,
          debitOrCredit: l.debitOrCredit,
          amount: safeNumber(l.value),
        });
        l.mirrors?.forEach(m => transactionLines.push({
          instanceId: m.instanceId,
          summaryId: m.summaryId,
          definitionId: m.definitionId,
          debitOrCredit: m.debitOrCredit,
          amount: safeNumber(m.value),
        }));
      });

      const totalAmount = transactionLines.reduce((acc, l) => acc + l.amount, 0);
      const transaction = new TransactionModel({
        description: `Transaction for Order ID: ${orderId}`,
        amount: totalAmount,
        lines: transactionLines,
      });
      await transaction.save({ session });

      res.json({
        success: true,
        parent: parentBreakup,
        children: [sellerChild, buyerChild],
        transaction,
      });
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("Order creation error:", err);
    return res.status(500).json({ error: err.message });
  } finally {
    await session.endSession();
  }
};
