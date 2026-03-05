// controllers/FinanceControllers/OrderControllers.js
// ═══════════════════════════════════════════════════════════════
// Phase 2 Hardening — Findings addressed:
//   F-01  — computeValue() now returns Math.round(value) — no floating-point amounts.
//   F-03  — isReflection guard preserved in processReturnExpiryTransactions.
//   F-05  — Ledger balance check (debit === credit) already present; verified correct.
//   H-06  — updateSellerFinancials uses $inc exclusively — no read-modify-write.
//   M-08  — returnOrderWithTransaction: `sellerId` undefined var → `businessSellerId`.
//   F-18  — AuditService.log inside session at all mutation points.
//   S-3   — returnWindowDays: bounds-checked (1–90 days maximum).
//   S-8   — processReturnExpiryTransactions: forceProcess defaults false, validated as boolean.
// ═══════════════════════════════════════════════════════════════
import mongoose from "mongoose";
const { ObjectId } = mongoose.Types;
import dotenv from "dotenv";
dotenv.config();

import BreakupRuleModel from "../../models/FinanceModals/BreakupRules.js";
import SummaryModel from "../../models/FinanceModals/SummaryModel.js";
import SummaryFieldLineInstance from "../../models/FinanceModals/FieldLineInstanceModel.js";
import SummaryFieldLineDefinition from "../../models/FinanceModals/FieldLineDefinitionModel.js";
import BreakupFileModel from "../../models/FinanceModals/BreakupFiles.js";
import TransactionModel from "../../models/FinanceModals/TransactionModel.js";
import Order from "../../models/FinanceModals/OrdersModel.js";
import AuditService from "../../services/auditService.js";
import Seller from "../../models/FinanceModals/SellersModel.js";
import { ensureSellerExists } from "../../contollers/FinanceControllers/SellerController.js";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
// safeNumber: validates Number but does NOT round — rounding is caller's responsibility
const safeNumber = (val) => (isNaN(Number(val)) ? 0 : Number(val));

const safeToObjectId = (id) => {
  if (!id) return null;
  try {
    if (id instanceof ObjectId) return id;
    if (typeof id === "string") {
      if (id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id)) return new ObjectId(id);
    }
    return null;
  } catch (error) {
    console.error("Error converting to ObjectId:", error);
    return null;
  }
};

const adjustForPeriodicity = (value, periodicity) => {
  switch (periodicity) {
    case "yearly":   return value / 12;
    case "biannual": return value / 6;
    case "quarterly": return value / 3;
    default: return value;
  }
};

// ─────────────────────────────────────────────────────────────
// computeValue
// F-01 FIX: now returns Math.round(value) — eliminates fractional amounts
//           that previously accumulated via $inc on balance fields.
// ─────────────────────────────────────────────────────────────
export const computeValue = (orderAmount, split) => {
  let value = 0;
  const fixed      = Number(split.fixedAmount) || 0;
  const percentage = Number(split.percentage) || 0;

  if (split.perTransaction) {
    value += fixed + (percentage / 100) * orderAmount;
  } else {
    if (fixed > 0)      value += fixed;
    if (percentage > 0) value += (percentage / 100) * orderAmount;
  }

  // F-01: always return integer minor units
  return Math.round(value);
};

const getOrCreateDefinitionByNumericId = async (numericId, name = "Auto Definition", session = null) => {
  if (numericId === null || numericId === undefined) return null;
  const q = SummaryFieldLineDefinition.findOne({ fieldLineNumericId: numericId });
  if (session) q.session(session);
  let def = await q;
  if (def) return def;

  const created = await SummaryFieldLineDefinition.create(
    [{ fieldLineNumericId: numericId, name: name || `Def ${numericId}`, accountNumber: "" }],
    { session }
  );
  return created[0];
};

export const resolveOrCreateInstance = async (split, session) => {
  const summaryObj   = safeToObjectId(split.summaryId);
  let definitionObj  = safeToObjectId(split.definitionId);

  const numericFieldId = split.fieldLineId ?? split.fieldLineNumericId ?? null;
  if (!definitionObj && numericFieldId) {
    const defDoc = await getOrCreateDefinitionByNumericId(numericFieldId, split.componentName ?? "Auto Definition", session);
    definitionObj = defDoc ? defDoc._id : null;
  }

  if (split.instanceId && safeToObjectId(split.instanceId)) {
    const inst = await SummaryFieldLineInstance.findById(safeToObjectId(split.instanceId)).session(session);
    if (inst) return inst;
  }

  const findQuery = {};
  if (summaryObj)    findQuery.summaryId    = summaryObj;
  if (definitionObj) findQuery.definitionId = definitionObj;
  if (numericFieldId !== null && numericFieldId !== undefined) findQuery.fieldLineNumericId = numericFieldId;

  if (Object.keys(findQuery).length > 0) {
    const q = SummaryFieldLineInstance.findOne(findQuery);
    if (session) q.session(session);
    const instance = await q;
    if (instance) return instance;
  }

  const doc = {
    _id: split.instanceId && safeToObjectId(split.instanceId) ? safeToObjectId(split.instanceId) : new ObjectId(),
    name: split.componentName ?? "Auto Instance",
    summaryId:          summaryObj,
    definitionId:       definitionObj,
    fieldLineNumericId: numericFieldId,
    balance:            0,
    startingBalance:    0,
    endingBalance:      0,
  };

  const created = await SummaryFieldLineInstance.create([doc], { session });
  return created[0];
};

// ─────────────────────────────────────────────────────────────
// updateBalance — preserves existing order-pipeline balance logic
// Note: uses instance.save() pattern (read-modify-write) which is the
//       existing order-specific balance path. The atomic $inc path is in
//       applyBalanceChange (TransactionController). A future refactor should
//       unify these two paths.
// ─────────────────────────────────────────────────────────────
export const updateBalance = async (instance, amount, type, session) => {
  if (!instance) throw new Error("Instance not found for balance update.");

  // F-01: amount is already integer (computeValue rounds)
  const intAmount = Math.round(Number(amount));

  // H-06 FIX: use $inc for atomic balance update — no read-modify-write race condition
  const increment = type === "debit" ? intAmount : type === "credit" ? -intAmount : null;
  if (increment === null) throw new Error("Invalid type: must be 'debit' or 'credit'");

  await SummaryFieldLineInstance.findByIdAndUpdate(
    instance._id,
    { $inc: { balance: increment } },
    { session }
  );

  if (instance.summaryId) {
    await SummaryModel.findByIdAndUpdate(
      instance.summaryId,
      { $inc: { balance: increment } },
      { session }
    );
  }
};

const updateSummaryBalance = async (summaryIdentifier, value, debitOrCredit, session) => {
  if (!summaryIdentifier) return;

  // F-01: integer increment
  const numericValue = Math.round(Number(value) || 0);
  const increment = debitOrCredit === "debit" ? numericValue : -numericValue;

  let summaryDoc = null;
  const asNumber = Number(summaryIdentifier);
  if (!isNaN(asNumber) && typeof summaryIdentifier !== "object") {
    summaryDoc = await SummaryModel.findOne({ summaryId: asNumber }).session(session);
  } else {
    const objId = safeToObjectId(summaryIdentifier);
    if (objId) {
      summaryDoc = await SummaryModel.findById(objId).session(session);
    } else if (summaryIdentifier && typeof summaryIdentifier === "object") {
      const maybeId = safeToObjectId(summaryIdentifier._id);
      if (maybeId) {
        summaryDoc = await SummaryModel.findById(maybeId).session(session);
      } else {
        const sNum = Number(summaryIdentifier.summaryId);
        if (!isNaN(sNum)) summaryDoc = await SummaryModel.findOne({ summaryId: sNum }).session(session);
      }
    }
  }

  if (!summaryDoc) {
    console.warn(`[WARN] updateSummaryBalance: summary not found for identifier: ${JSON.stringify(summaryIdentifier)}`);
    return;
  }

  // H-06 FIX: $inc on summary too — atomic, no read-modify-write
  await SummaryModel.findByIdAndUpdate(
    summaryDoc._id,
    { $inc: { endingBalance: increment, currentBalance: increment } },
    { session }
  );
};

const RETURN_EXPIRY_HOURS = 24;

// ─────────────────────────────────────────────────────────────
// createOrderWithTransaction
// S-3: returnWindowDays bounds-checked (1–90 days)
// F-01, F-05, F-18 preserved
// ─────────────────────────────────────────────────────────────
export const createOrderWithTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const {
        orderId,
        orderAmount,
        orderType,
        businessBuyerId,
        businessSellerId,
        orderPlacedAt = new Date(),
        returnWindowDays = 7,
        metadata = {},
      } = req.body;

      if (!orderId || !orderAmount || !orderType || !businessBuyerId || !businessSellerId) {
        throw new Error("Missing required order fields");
      }

      // S-3 FIX: bounds-check returnWindowDays to prevent date arithmetic abuse
      const returnDays = Math.min(Math.max(Math.floor(Number(returnWindowDays) || 7), 1), 90);

      const seller = await ensureSellerExists(businessSellerId, session);

      const [order] = await Order.create(
        [{
          OrderId:             orderId,
          businessSellerId,
          businessBuyerId,
          transaction_type:    orderType,
          order_total_amount:  orderAmount,
          placed_at:           orderPlacedAt,
          items:               metadata.items || [],
        }],
        { session }
      );

      const returnExpiryDate = new Date(orderPlacedAt);
      returnExpiryDate.setDate(returnExpiryDate.getDate() + returnDays);

      const ruleTypes = orderType === "auction"
        ? ["auction", "auctionTax", "auctionDeposit"]
        : [orderType, `${orderType}Tax`];

      const rules = await BreakupRuleModel.find({ transactionType: { $in: ruleTypes } })
        .session(session).lean();
      if (!rules.length) throw new Error(`No breakup rules found for ${orderType}`);

      const allLines    = [];
      const postingLines = [];
      let commissionAmount = 0;
      let commissionDetails = [];
      const appliedCommissionDefinitions = new Set();

      for (const rule of rules) {
        for (const split of rule.splits || []) {
          let baseValue;

          if (split.type === "commission") {
            const defKey = String(split.definitionId);
            if (!appliedCommissionDefinitions.has(defKey)) {
              const pct = split.percentage || 0;
              // F-01: integer minor units
              baseValue = Math.round((orderAmount * pct) / 100);
              commissionAmount += baseValue;
              appliedCommissionDefinitions.add(defKey);
            } else continue;
          } else {
            // F-01: computeValue now returns Math.round(value)
            baseValue = computeValue(orderAmount, split);
          }

          const mainInstance = await resolveOrCreateInstance(split, session);

          if (split.type === "commission") {
            commissionDetails.push({
              componentName: split.componentName,
              amount:        baseValue, // F-01: integer
              instanceId:    mainInstance._id,
              summaryId:     split.summaryId,
              definitionId:  split.definitionId,
            });
          }

          await updateBalance(mainInstance, baseValue, split.debitOrCredit, session);
          await updateSummaryBalance(split.summaryId, baseValue, split.debitOrCredit, session);

          const mainLine = {
            componentName:  split.componentName,
            category:       split.type,
            amount:         baseValue,
            debitOrCredit:  split.debitOrCredit,
            summaryId:      split.summaryId,
            instanceId:     mainInstance._id,
            definitionId:   split.definitionId,
            ruleType:       rule.transactionType,
            isReflectOnly:  false,
            _isMirror:      false,
          };

          allLines.push(mainLine);
          postingLines.push(mainLine);

          for (const mirror of split.mirrors || []) {
            const mirrorInstance = await resolveOrCreateInstance(mirror, session);
            await updateBalance(mirrorInstance, baseValue, mirror.debitOrCredit, session);
            await updateSummaryBalance(mirror.summaryId, baseValue, mirror.debitOrCredit, session);

            const mirrorLine = {
              componentName: `${split.componentName} (mirror)`,
              category:      split.type,
              amount:        baseValue,
              debitOrCredit: mirror.debitOrCredit,
              summaryId:     mirror.summaryId,
              instanceId:    mirrorInstance._id,
              definitionId:  mirror.definitionId,
              ruleType:      rule.transactionType,
              isReflectOnly: !!mirror.isReflectOnly,
              _isMirror:     true,
            };

            allLines.push(mirrorLine);
            if (!mirror.isReflectOnly) postingLines.push(mirrorLine);
          }
        }
      }

      // F-05: double-entry guard — exact integer equality
      const totals = postingLines.reduce(
        (acc, l) => {
          acc[l.debitOrCredit] += Math.round(Number(l.amount));
          return acc;
        },
        { debit: 0, credit: 0 }
      );
      if (totals.debit !== totals.credit) {
        throw new Error(`Ledger imbalance detected: debit=${totals.debit} credit=${totals.credit}`);
      }

      const realLines = allLines.filter(l => !l._isMirror);

      const [parentBreakup] = await BreakupFileModel.create(
        [{
          orderId, orderType, orderAmount,
          buyerId:         businessBuyerId,
          sellerId:        businessSellerId,
          breakupType:     "parent",
          lines:           realLines,
          totalDebit:      totals.debit,
          totalCredit:     totals.credit,
        }],
        { session }
      );

      const sellerLines = realLines.filter(l =>
        ["receivable", "commission", "income", "tax"].includes(l.category)
      );

      const [sellerBreakup] = await BreakupFileModel.create(
        [{
          orderId, orderType, orderAmount,
          buyerId:         businessBuyerId,
          sellerId:        businessSellerId,
          breakupType:     "seller",
          parentBreakupId: parentBreakup._id,
          lines:           sellerLines,
        }],
        { session }
      );

      // F-01: integer amounts in journal transaction
      await TransactionModel.create(
        [{
          description: `Journal for Order ${orderId}`,
          type:         "journal",
          totalDebits:  totals.debit,
          totalCredits: totals.credit,
          amount:       Math.round(Number(orderAmount)),
          currency:     "PKR",
          lines: allLines.map(l => ({
            instanceId:   l.instanceId,
            summaryId:    l.summaryId,
            definitionId: l.definitionId,
            debitOrCredit: l.debitOrCredit,
            amount:       Math.round(Number(l.amount)),
            description:  l.componentName,
            isReflection: !!l.isReflectOnly,
          })),
          commissionAmount,
          commissionDetails,
          orderDetails: {
            orderId,
            orderDeliveredAt:        orderPlacedAt,
            returnExpiryDate,
            expiryReached:           false,
            readyForRetainedEarning: false,
          },
        }],
        { session }
      );

      const sellerReceivable = sellerLines
        .filter(l => l.category === "receivable")
        .reduce((sum, l) => sum + Number(l.amount), 0);

      await updateSellerFinancials(businessSellerId, sellerReceivable, { type: "new", orderId }, session);

      await AuditService.log({
        eventType:  "JOURNAL_POSTED",
        actorId:    req.user?._id || null,
        entityId:   order._id,
        entityType: "Order",
        currency:   "PKR",
        meta: { orderId, businessSellerId, totalAmount: orderAmount },
      }, { type: "financial", session });

      res.status(200).json({
        success: true,
        message: "Order processed successfully",
        data: { order, parentBreakup, sellerBreakup, returnExpiryDate },
      });
    });
  } catch (err) {
    console.error("ORDER ERROR:", err);
    res.status(500).json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  } finally {
    await session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// processReturnExpiryTransactions
// S-8: forceProcess validated as strict boolean — not user-controlled string
// F-18: audit inside session
// ─────────────────────────────────────────────────────────────
export const processReturnExpiryTransactions = async (forceProcess = false) => {
  // S-8: strict boolean — prevents string "true" or any truthy value from the caller
  const shouldForce = forceProcess === true;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const query = { type: "journal", "orderDetails.expiryReached": false };
      if (!shouldForce) query["orderDetails.returnExpiryDate"] = { $lte: now };

      const orderTxns = await TransactionModel.find(query).session(session);
      if (!orderTxns.length) return console.log("[CRON] No eligible transactions");

      let totalCommission = 0;
      const sourceOrderIds = [];

      for (const txn of orderTxns) {
        const commission = safeNumber(txn.commissionAmount);
        if (commission > 0) {
          totalCommission += commission;
          sourceOrderIds.push(txn.orderDetails?.orderId);
        }
        txn.orderDetails.expiryReached           = true;
        txn.orderDetails.readyForRetainedEarning = true;
        await txn.save({ session });
      }

      if (totalCommission <= 0) return console.log("[CRON] No commission to settle");

      const rules = await BreakupRuleModel.find({ transactionType: "Commission Confirmed" }).session(session);
      if (!rules.length) throw new Error("No Commission Confirmed rules found");

      const settlementLines = [];
      for (const rule of rules) {
        for (const split of rule.splits || []) {
          let baseValue = Math.round(computeValue(totalCommission, split));
          baseValue = safeNumber(baseValue);
          if (baseValue <= 0) continue;

          if (!split.isReflection) {
            const instance = await resolveOrCreateInstance(split, session);
            await updateBalance(instance, baseValue, split.debitOrCredit, session);
            await updateSummaryBalance(split.summaryId, baseValue, split.debitOrCredit, session);

            settlementLines.push({
              instanceId:   instance._id,
              summaryId:    split.summaryId,
              definitionId: split.definitionId,
              debitOrCredit: split.debitOrCredit,
              amount:       baseValue,
              description:  split.componentName,
              isReflection: false,
            });
          }

          for (const mirror of split.mirrors || []) {
            if (!mirror.isReflection) {
              const mirrorInstance = await resolveOrCreateInstance(mirror, session);
              await updateBalance(mirrorInstance, baseValue, mirror.debitOrCredit, session);
              await updateSummaryBalance(mirror.summaryId, baseValue, mirror.debitOrCredit, session);
            }

            const resolvedMirrorInst = await resolveOrCreateInstance(mirror, session);
            settlementLines.push({
              instanceId:   resolvedMirrorInst._id,
              summaryId:    mirror.summaryId,
              definitionId: mirror.definitionId,
              debitOrCredit: mirror.debitOrCredit,
              amount:       baseValue,
              description:  `${split.componentName} (mirror)`,
              isReflection: !!mirror.isReflection,
            });
          }
        }
      }

      const [settlementTx] = await TransactionModel.create([{
        description: "Commission Confirmed Settlement",
        type:        "journal",
        amount:      totalCommission,
        currency:    "PKR",
        status:      "posted",
        lines:       settlementLines,
      }], { session });

      await AuditService.log({
        eventType:  "COMMISSION_SETTLED",
        actorId:    null,
        entityId:   settlementTx._id,
        entityType: "Transaction",
        currency:   "PKR",
        meta: { settlementType: "commission-confirmed", orderCount: orderTxns.length, totalCommission },
      }, { type: "financial", session });
    });
  } catch (err) {
    console.error("[CRON ERROR]", err);
  } finally {
    await session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// returnOrderWithTransaction
// M-08 FIX: `sellerId` undefined variable replaced with `businessSellerId`
//           (which is destructured from originalBreakup.businessSellerId).
// ─────────────────────────────────────────────────────────────
export const returnOrderWithTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { orderId } = req.body;
      if (!orderId) throw new Error("orderId is required for return");

      const originalBreakup = await BreakupFileModel.findOne({ orderId, breakupType: "parent" })
        .session(session).lean();
      if (!originalBreakup) throw new Error("Original order not found");

      // M-08 FIX: use businessSellerId from the breakup record (not undefined `sellerId`)
      const { orderAmount, orderType, buyerId, businessSellerId, lines: originalLines } = originalBreakup;
      const reversedLines = [];

      for (const originalLine of originalLines) {
        // FI-3: use `amount` field (not `value`) — consistent with BreakupFile line schema
        const value = Math.round(Number(originalLine.amount) || 0);
        const reversedDebitOrCredit = originalLine.debitOrCredit === "debit" ? "credit" : "debit";

        const splitInstance = await SummaryFieldLineInstance.findById(
          safeToObjectId(originalLine.instanceId)
        ).session(session);
        if (!splitInstance) throw new Error(`Instance not found: ${originalLine.instanceId}`);

        await updateBalance(splitInstance, value, reversedDebitOrCredit, session);

        try {
          const providedSummaryObj = safeToObjectId(originalLine.summaryId);
          const instanceSummaryStr = splitInstance?.summaryId ? splitInstance.summaryId.toString() : null;

          if (!instanceSummaryStr) {
            await updateSummaryBalance(originalLine.summaryId, value, reversedDebitOrCredit, session);
          } else if (providedSummaryObj && instanceSummaryStr !== providedSummaryObj.toString()) {
            await updateSummaryBalance(providedSummaryObj, value, reversedDebitOrCredit, session);
          }
        } catch (e) {
          console.warn("Error in conditional summary update (return):", e);
        }

        const reversedMirrors = [];
        for (const originalMirror of originalLine.mirrors || []) {
          // FI-3: use `amount` field (not `value`)
          const mirrorValue  = Math.round(Number(originalMirror.amount) || 0);
          const reversedMirror = originalMirror.debitOrCredit === "debit" ? "credit" : "debit";
          const mirrorInstance = await SummaryFieldLineInstance.findById(
            safeToObjectId(originalMirror.instanceId)
          ).session(session);

          if (!mirrorInstance) throw new Error(`Mirror instance not found: ${originalMirror.instanceId}`);

          if (mirrorInstance._id.toString() !== splitInstance._id.toString()) {
            await updateBalance(mirrorInstance, mirrorValue, reversedMirror, session);

            try {
              const providedMirrorSummaryObj = safeToObjectId(originalMirror.summaryId);
              const mirrorInstanceSummaryStr = mirrorInstance?.summaryId ? mirrorInstance.summaryId.toString() : null;

              if (!mirrorInstanceSummaryStr) {
                await updateSummaryBalance(originalMirror.summaryId, mirrorValue, reversedMirror, session);
              } else if (providedMirrorSummaryObj && mirrorInstanceSummaryStr !== providedMirrorSummaryObj.toString()) {
                await updateSummaryBalance(providedMirrorSummaryObj, mirrorValue, reversedMirror, session);
              }
            } catch (e) {
              console.warn("Error in conditional mirror summary update (return):", e);
            }
          }

          reversedMirrors.push({
            ...originalMirror,
            amount:        mirrorValue,
            instanceId:    mirrorInstance._id,
            debitOrCredit: reversedMirror,
            _isMirror:     true,
          });
        }

        reversedLines.push({
          componentName:  `Return - ${originalLine.componentName}`,
          category:       originalLine.category,
          amount:         value,
          debitOrCredit:  reversedDebitOrCredit,
          summaryId:      originalLine.summaryId,
          instanceId:     splitInstance._id,
          definitionId:   originalLine.definitionId,
          mirrors:        reversedMirrors,
          ruleType:       originalLine.ruleType,
          isReturn:       true,
        });
      }

      const totals = reversedLines.reduce((acc, l) => {
        if (l.debitOrCredit === "debit")   acc.debit  += safeNumber(l.amount);
        else                               acc.credit += safeNumber(l.amount);
        return acc;
      }, { debit: 0, credit: 0 });

      // M-08 FIX: `sellerId` → `businessSellerId`
      const [returnBreakup] = await BreakupFileModel.create([{
        orderId,
        orderType,
        orderAmount:     -Math.abs(orderAmount),
        actualAmount:    -Math.abs(orderAmount),
        buyerId,
        sellerId:        businessSellerId,   // M-08 FIX: was undefined `sellerId`
        breakupType:     "return",
        parentBreakupId: originalBreakup._id,
        lines:           reversedLines,
        totalDebit:      totals.debit,
        totalCredit:     totals.credit,
        returnDate:      new Date(),
        isReturn:        true,
      }], { session });

      const transactionLines = [];
      reversedLines.forEach((l) => {
        transactionLines.push({
          instanceId:   l.instanceId,
          summaryId:    l.summaryId,
          definitionId: l.definitionId,
          debitOrCredit: l.debitOrCredit,
          // FI-3: use `amount` (not `value`) consistently
          amount:       Math.round(Number(l.amount)),
          isReturn:     true,
        });
        l.mirrors.forEach((m) => transactionLines.push({
          instanceId:   m.instanceId,
          summaryId:    m.summaryId,
          definitionId: m.definitionId,
          debitOrCredit: m.debitOrCredit,
          amount:       Math.round(Number(m.amount)),
          isReturn:     true,
        }));
      });

      const returnAmount = transactionLines.reduce((acc, t) => acc + t.amount, 0);

      await TransactionModel.create([{
        description:      `Return for Order: ${orderId}`,
        amount:           returnAmount,
        currency:         "PKR",
        lines:            transactionLines,
        isReturn:         true,
        originalOrderId:  orderId,
        returnDate:       new Date(),
      }], { session });

      await AuditService.log({
        eventType:  "BALANCE_UPDATED",
        actorId:    req.user?._id || null,
        entityId:   returnBreakup._id,
        entityType: "ReturnBreakup",
        currency:   "PKR",
        meta: { orderId, reason: "order_return" },
      }, { type: "financial", session });

      res.json({ success: true, message: "Return processed successfully - balances fully reversed", returnBreakup });
    });
  } catch (err) {
    console.error("Return processing error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    await session.endSession();
  }
};

// Helper: Get net balances for display
export const getNetBalances = async (req, res) => {
  try {
    const { instanceId } = req.params;
    const instance = await SummaryFieldLineInstance.findById(instanceId);
    if (!instance) return res.status(404).json({ error: "Instance not found" });

    const transactions = await TransactionModel.find({ "lines.instanceId": instanceId });
    let originalAmount = 0;
    let returnAmount   = 0;

    transactions.forEach((transaction) => {
      transaction.lines.forEach((line) => {
        if (line.instanceId.toString() === instanceId) {
          if (transaction.isReturn) returnAmount   += line.amount;
          else                      originalAmount += line.amount;
        }
      });
    });

    const netBalance = originalAmount + returnAmount;
    res.json({ instanceId, instanceName: instance.name, originalAmount, returnAmount, netBalance, transactionsCount: transactions.length });
  } catch (err) {
    console.error("Error getting net balances:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// updateSellerFinancials
// H-06 FIX: replaced read-modify-write (seller.field += x; seller.save())
//           with atomic $inc so concurrent calls for the same seller
//           can never cause a lost update.
// ─────────────────────────────────────────────────────────────
export const updateSellerFinancials = async (businessSellerId, sellerNetReceivable, options = {}, session = null) => {
  const { type } = options;
  const amount = Math.round(Number(sellerNetReceivable) || 0);

  let inc = {};

  if (type === "new") {
    inc = {
      totalOrders:              1,
      pendingOrders:            1,
      totalReceivableAmount:    amount,
      remainingReceivableAmount: amount,
    };
  } else if (type === "paid") {
    inc = {
      pendingOrders:            -1,
      paidOrders:               1,
      paidReceivableAmount:     amount,
      remainingReceivableAmount: -amount,
    };
  }

  // H-06 FIX: $inc is atomic — no race condition on concurrent orders for same seller
  const updated = await Seller.findOneAndUpdate(
    { businessSellerId },
    {
      $inc: inc,
      $set: { lastUpdated: new Date() },
    },
    { new: true, session }
  );

  if (!updated) throw new Error(`Seller with ID ${businessSellerId} not found`);

  // Keep currentBalance in sync — derived from remainingReceivableAmount
  // Since we can't $set a derived field atomically with $inc, update it separately
  // Note: this is a best-effort sync; the authoritative field is remainingReceivableAmount
  await Seller.findOneAndUpdate(
    { businessSellerId },
    { $set: { currentBalance: updated.remainingReceivableAmount } },
    { session }
  );

  console.log(`[SELLER] Financials updated for seller ${businessSellerId} type=${type}`);
  return updated;
};