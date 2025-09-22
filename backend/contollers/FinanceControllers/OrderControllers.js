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
const safeNumber = (val) => isNaN(Number(val)) ? 0 : Number(val);

const safeToObjectId = (id) => {
  if (!id) return null;
  return mongoose.Types.ObjectId.isValid(id) ? new ObjectId(id) : null;
};

const adjustForPeriodicity = (value, periodicity) => {
  switch (periodicity) {
    case "yearly": return value / 12;
    case "biannual": return value / 6;
    case "quarterly": return value / 3;
    default: return value;
  }
};

const computeValue = (orderAmount, split) => {
  let value = 0;
  if (split.fixedAmount) value += safeNumber(split.fixedAmount);
  if (split.percentage) value += (split.percentage / 100) * orderAmount;
  if (split.perTransaction) value += safeNumber(split.fixedAmount) + ((split.percentage ?? 0) / 100) * orderAmount;
  if (split.periodicity && split.periodicity !== "none") value = adjustForPeriodicity(value, split.periodicity);

  if (split.type === "tax" && split.slabStart != null && split.slabEnd != null) {
    if (orderAmount >= split.slabStart && orderAmount <= split.slabEnd) {
      value = safeNumber(split.fixedTax ?? value);
      if (split.additionalTaxPercentage) value += (split.additionalTaxPercentage / 100) * orderAmount;
    }
  }

  return Math.round(value * 100) / 100;
};

// -------------------------------
// Resolve or create instance safely
// -------------------------------
const resolveOrCreateInstance = async (split, session) => {
  const summaryId = safeToObjectId(split.summaryId);
  const definitionId = safeToObjectId(split.definitionId);

  // If instanceId is valid, try to fetch it
  if (split.instanceId && safeToObjectId(split.instanceId)) {
    const inst = await SummaryFieldLineInstance.findById(safeToObjectId(split.instanceId)).session(session);
    if (inst) return inst;
  }

  // Else, try to find existing instance for the summary/definition
  let instance = await SummaryFieldLineInstance.findOne({
    summaryId,
    definitionId,
    fieldLineNumericId: split.fieldLineId ?? split.fieldLineNumericId ?? null
  }).session(session);

  if (instance) return instance;

  // If still not found, create new instance
  const doc = {
    _id: split.instanceId && safeToObjectId(split.instanceId) ? safeToObjectId(split.instanceId) : new ObjectId(),
    name: split.componentName ?? "Auto Instance",
    summaryId,
    definitionId,
    fieldLineNumericId: split.fieldLineId ?? split.fieldLineNumericId ?? null,
    balance: 0,
    startingBalance: 0,
    endingBalance: 0
  };

  const created = await SummaryFieldLineInstance.create([doc], { session });
  return created[0];
};

// -------------------------------
// Update balance safely
// -------------------------------
const updateBalance = async (instance, value, debitOrCredit, session) => {
  if (!instance) return;
  instance.startingBalance ??= instance.balance ?? 0;
  if (debitOrCredit === "debit") instance.balance = (instance.balance ?? 0) + value;
  else instance.balance = (instance.balance ?? 0) - value;
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

      // Fetch all breakup rules
      const rules = await BreakupRuleModel.find({
        transactionType: { $in: [orderType, `${orderType}Tax`] }
      }).session(session).lean();

      if (!rules?.length) throw new Error(`No BreakupRules found for type ${orderType}`);

      const allLines = [];

      for (const rule of rules) {
        for (const split of rule.splits || []) {
          const value = computeValue(orderAmount, split);

          // Resolve/create split instance
          const splitInstance = await resolveOrCreateInstance(split, session);
          await updateBalance(splitInstance, value, split.debitOrCredit, session);

          // Resolve/create mirrors
          const mirrorsResolved = [];
          for (const mirror of split.mirrors || []) {
            const mirrorInstance = await resolveOrCreateInstance({
              ...mirror,
              summaryId: mirror.summaryId ?? split.summaryId,
              definitionId: mirror.definitionId ?? split.definitionId,
              fieldLineId: mirror.fieldLineId ?? mirror.fieldLineNumericId ?? split.fieldLineId ?? split.fieldLineNumericId
            }, session);

            await updateBalance(mirrorInstance, value, mirror.debitOrCredit, session);

            mirrorsResolved.push({
              ...mirror,
              value,
              instanceId: mirrorInstance._id,
              debitOrCredit: mirror.debitOrCredit,
              _isMirror: true
            });
          }

          allLines.push({
            componentName: split.componentName,
            category: split.type,
            value,
            amount: value,
            debitOrCredit: split.debitOrCredit,
            summaryId: split.summaryId,
            instanceId: splitInstance._id,
            definitionId: split.definitionId,
            fieldLineId: split.fieldLineId ?? split.fieldLineNumericId ?? null,
            mirrors: mirrorsResolved,
            ruleType: rule.transactionType
          });
        }
      }

      // Calculate totals
      const totals = allLines.reduce((acc, l) => {
        if (l.debitOrCredit === "debit") acc.debit += safeNumber(l.value);
        else acc.credit += safeNumber(l.value);
        return acc;
      }, { debit: 0, credit: 0 });

      // Create parent breakup file
      const [parentBreakup] = await BreakupFileModel.create([{
        orderId,
        orderType,
        orderAmount,
        actualAmount: orderAmount,
        buyerId,
        sellerId,
        parentBreakupId: null,
        lines: allLines,
        totalDebit: totals.debit,
        totalCredit: totals.credit
      }], { session });

      // Create transaction lines
      const transactionLines = [];
      allLines.forEach(l => {
        transactionLines.push({ instanceId: l.instanceId, summaryId: l.summaryId, definitionId: l.definitionId, debitOrCredit: l.debitOrCredit, amount: l.value });
        l.mirrors.forEach(m => transactionLines.push({ instanceId: m.instanceId, summaryId: m.summaryId, definitionId: m.definitionId, debitOrCredit: m.debitOrCredit, amount: m.value }));
      });

      await TransactionModel.create([{
        description: `Transaction for Order ID: ${orderId}`,
        amount: transactionLines.reduce((acc, t) => acc + t.amount, 0),
        lines: transactionLines
      }], { session });

      res.json({ success: true, parentBreakup });
    });
  } catch (err) {
    console.error("Order creation error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    await session.endSession();
  }
};
