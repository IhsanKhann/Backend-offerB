// controllers/FinanceControllers/OrderControllers.js
import mongoose from "mongoose";
const { ObjectId } = mongoose.Types;
import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

import BreakupRuleModel from "../../models/FinanceModals/BreakupRules.js";
import SummaryModel from "../../models/FinanceModals/SummaryModel.js";
import SummaryFieldLineInstance from "../../models/FinanceModals/FieldLineInstanceModel.js";
import SummaryFieldLineDefinition from "../../models/FinanceModals/FieldLineDefinitionModel.js"; // <-- added
import BreakupFileModel from "../../models/FinanceModals/BreakupFiles.js";
import TransactionModel from "../../models/FinanceModals/TransactionModel.js";
import Order from "../../models/FinanceModals/OrdersModel.js";
import api from "../../../frontend/src/api/axios.js";
import Seller from "../../models/FinanceModals/SellersModel.js";
import { ensureSellerExists } from "../../contollers/FinanceControllers/SellerController.js";

// -------------------------------
// Helpers
// -------------------------------
const safeNumber = (val) => (isNaN(Number(val)) ? 0 : Number(val));

const safeToObjectId = (id) => {
  if (!id) return null;

  try {
    // If it's already an ObjectId, return as is
    if (id instanceof ObjectId) {
      return id;
    }

    // If it's a string, check if it's valid and convert
    if (typeof id === "string") {
      if (mongoose.Types.ObjectId.isValid(id)) {
        // Check if it's a 24-character hex string
        if (id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id)) {
          return new ObjectId(id);
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error converting to ObjectId:", error);
    return null;
  }
};

const adjustForPeriodicity = (value, periodicity) => {
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
};

// utils/computeValue.js
export const computeValue = (orderAmount, split) => {
  let value = 0;

  const fixed = Number(split.fixedAmount) || 0;
  const percentage = Number(split.percentage) || 0;

  if (split.perTransaction) {
    value += fixed + (percentage / 100) * orderAmount;
    console.log(
      `[DEBUG] computeValue | component=${split.componentName} | perTransaction=YES | fixed=${fixed} | percentage=${percentage}% of ${orderAmount} | total=${value}`
    );
  } else {
    if (fixed > 0) {
      value += fixed;
      console.log(
        `[DEBUG] computeValue | component=${split.componentName} | fixed=${fixed}`
      );
    }
    if (percentage > 0) {
      const pctValue = (percentage / 100) * orderAmount;
      value += pctValue;
      console.log(
        `[DEBUG] computeValue | component=${split.componentName} | percentage=${percentage}% of ${orderAmount} = ${pctValue}`
      );
    }
  }

  console.log(
    `[DEBUG] computeValue | FINAL | component=${split.componentName} | value=${value}`
  );

  return value;
};

// -------------------------------
// New helper: get or create definition by numeric id
// -------------------------------
const getOrCreateDefinitionByNumericId = async (numericId, name = "Auto Definition", session = null) => {
  if (numericId === null || numericId === undefined) return null;

  const q = SummaryFieldLineDefinition.findOne({ fieldLineNumericId: numericId });
  if (session) q.session(session);
  let def = await q;
  if (def) return def;

  // create definition if not existing
  const doc = {
    fieldLineNumericId: numericId,
    name: name || `Def ${numericId}`,
    accountNumber: "",
  };

  const created = await SummaryFieldLineDefinition.create([doc], { session });
  return created[0];
};

// Resolve or create instance (non-duplicating) — now ensures definition existence too
const resolveOrCreateInstance = async (split, session) => {
  // Resolve provided summary & definition object ids (if any)
  const summaryObj = safeToObjectId(split.summaryId);
  let definitionObj = safeToObjectId(split.definitionId);

  // If definition missing but numeric field id is passed, ensure definition exists (create if needed)
  const numericFieldId = split.fieldLineId ?? split.fieldLineNumericId ?? null;
  if (!definitionObj && numericFieldId) {
    const defDoc = await getOrCreateDefinitionByNumericId(numericFieldId, split.componentName ?? "Auto Definition", session);
    definitionObj = defDoc ? defDoc._id : null;
  }

  // If instanceId explicitly provided and valid, try returning it
  if (split.instanceId && safeToObjectId(split.instanceId)) {
    const inst = await SummaryFieldLineInstance.findById(safeToObjectId(split.instanceId)).session(session);
    if (inst) return inst;
  }

  // Try to find existing instance by combination of summary + definition + numeric field id
  const findQuery = {};
  if (summaryObj) findQuery.summaryId = summaryObj;
  if (definitionObj) findQuery.definitionId = definitionObj;
  if (numericFieldId !== null && numericFieldId !== undefined) findQuery.fieldLineNumericId = numericFieldId;

  let instance = null;
  // Only run a query if we have at least something to search by
  if (Object.keys(findQuery).length > 0) {
    const q = SummaryFieldLineInstance.findOne(findQuery);
    if (session) q.session(session);
    instance = await q;
    if (instance) return instance; // reuse
  }

  // If not found, create an instance (with optional provided instanceId or new ObjectId)
  const doc = {
    _id: split.instanceId && safeToObjectId(split.instanceId) ? safeToObjectId(split.instanceId) : new ObjectId(),
    name: split.componentName ?? "Auto Instance",
    summaryId: summaryObj,
    definitionId: definitionObj,
    fieldLineNumericId: numericFieldId,
    balance: 0,
    startingBalance: 0,
    endingBalance: 0,
  };

  const created = await SummaryFieldLineInstance.create([doc], { session });
  return created[0];
};

export const updateBalance = async (instance, amount, type, session) => {
  if (!instance) throw new Error("Instance not found for balance update.");

  // 1️⃣ Update instance balance
  let updatedBalance = instance.balance || 0;
  if (type === "debit") {
    updatedBalance += amount;
  } else if (type === "credit") {
    updatedBalance -= amount;
  } else {
    throw new Error("Invalid type: must be 'debit' or 'credit'");
  }

  instance.balance = updatedBalance;
  await instance.save({ session });

  // 2️⃣ Update parent summary only once (if summaryId exists)
  if (instance.summaryId) {
    const summary = await SummaryModel.findById(instance.summaryId).session(session);
    if (summary) {
      let summaryBalance = summary.balance || 0;
      summaryBalance += type === "debit" ? amount : -amount;
      summary.balance = summaryBalance;
      await summary.save({ session });
    }
  }
};

// -------------------------------
// Helper: Update Summary Balance (when updating a summary directly)
// -------------------------------
const updateSummaryBalance = async (summaryIdentifier, value, debitOrCredit, session) => {
  if (!summaryIdentifier) return;

  const numericValue = Number(value) || 0;

  // Resolve the summary doc:
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
        if (!isNaN(sNum)) {
          summaryDoc = await SummaryModel.findOne({ summaryId: sNum }).session(session);
        }
      }
    }
  }

  if (!summaryDoc) {
    console.warn(`[WARN] updateSummaryBalance: summary not found for identifier: ${JSON.stringify(summaryIdentifier)}`);
    return;
  }

  summaryDoc.startingBalance ??= summaryDoc.endingBalance ?? 0;
  if (typeof summaryDoc.endingBalance !== "number") summaryDoc.endingBalance = summaryDoc.startingBalance;

  if (debitOrCredit === "debit") summaryDoc.endingBalance = (summaryDoc.endingBalance || 0) + numericValue;
  else if (debitOrCredit === "credit") summaryDoc.endingBalance = (summaryDoc.endingBalance || 0) - numericValue;
  else throw new Error(`Invalid debitOrCredit: ${debitOrCredit}`);

  if (typeof summaryDoc.currentBalance !== "number") summaryDoc.currentBalance = summaryDoc.startingBalance;
  if (debitOrCredit === "debit") summaryDoc.currentBalance += numericValue;
  else summaryDoc.currentBalance -= numericValue;

  await summaryDoc.save({ session });
};

const BUSINESS_API_BASE = process.env.BUSINESS_API_BASE;

/**
 * CONFIG: Change this whenever business rules change
 * Example:
 * 24  → 1 day
 * 48  → 2 days
 * 72  → 3 days
 */
const RETURN_EXPIRY_HOURS = 24;

export const createOrderWithTransaction = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {

      /* ======================================================
       * 1. INPUT + VALIDATION
       * ====================================================== */
      const {
        orderId,
        orderAmount,
        orderType,
<<<<<<< HEAD
        buyerId,
        sellerId,
        orderId,
        deliveredAt, // optional
=======
        businessBuyerId,
        businessSellerId,
        orderPlacedAt = new Date(),
        returnWindowDays = 7,
        metadata = {}
>>>>>>> a6ead15 (made changes to the orderController and working on the commission flow)
      } = req.body;

      if (!orderId || !orderAmount || !orderType || !businessBuyerId || !businessSellerId) {
        throw new Error("Missing required order fields");
      }

      console.log(`🚀 [ORDER] ${orderId} | Seller ${businessSellerId}`);

      /* ======================================================
       * 2. ENSURE SELLER EXISTS
       * ====================================================== */
      const seller = await ensureSellerExists(businessSellerId, session);

<<<<<<< HEAD
      // -----------------------------
      // ENSURE SELLER
      // -----------------------------
      let seller;
      try {
        seller = await ensureSellerExists(sellerId);
      } catch (err) {
        console.error("❌ [SELLER ERROR]", {
          message: err.message,
          stack: err.stack,
          response: err.response?.data || null,
          status: err.response?.status || null,
        });
        throw new Error(`Failed to ensure seller: ${err.message}`);
      }
=======
      /* ======================================================
       * 3. CREATE ORDER
       * ====================================================== */
      const [order] = await Order.create(
        [{
          OrderId: orderId,
          businessSellerId,
          businessBuyerId,
          transaction_type: orderType,
          order_total_amount: orderAmount,
          placed_at: orderPlacedAt,
          items: metadata.items || []
        }],
        { session }
      );
>>>>>>> a6ead15 (made changes to the orderController and working on the commission flow)

      /* ======================================================
       * 4. RETURN WINDOW
       * ====================================================== */
      const returnExpiryDate = new Date(orderPlacedAt);
      returnExpiryDate.setDate(returnExpiryDate.getDate() + Number(returnWindowDays));

      /* ======================================================
       * 5. LOAD BREAKUP RULES
       * ====================================================== */
      const ruleTypes =
        orderType === "auction"
          ? ["auction", "auctionTax", "auctionDeposit"]
          : [orderType, `${orderType}Tax`];

      const rules = await BreakupRuleModel.find({
        transactionType: { $in: ruleTypes }
      }).session(session).lean();

      if (!rules.length) {
        throw new Error(`No breakup rules found for ${orderType}`);
      }

      /* ======================================================
       * 6. ACCOUNTING BUCKETS
       * ====================================================== */
      const allLines = [];
      const postingLines = [];

      /* ======================================================
       * 7. APPLY RULES & SPLITS
       * ====================================================== */
      let commissionAmount = 0;
      let commissionDetails = []; // ✅ FIXED (ARRAY)
      const appliedCommissionDefinitions = new Set();

      for (const rule of rules) {
        for (const split of rule.splits || []) {

<<<<<<< HEAD
          // MAIN LINE
          let mainInstance;
          try {
            mainInstance = await resolveOrCreateInstance(split, session);
          } catch (err) {
            console.error("❌ [INSTANCE ERROR]", {
              split,
              message: err.message,
              stack: err.stack,
              response: err.response?.data || null,
            });
            throw new Error(`Failed to resolve/create instance for ${split.componentName}`);
          }
=======
          let baseValue;

          if (split.type === "commission") {

            const defKey = String(split.definitionId);

            if (appliedCommissionDefinitions.has(defKey)) {
              continue; // skip only this exact split if already applied
            }

            const pct = split.percentage || 0;
            baseValue = Number(((orderAmount * pct) / 100).toFixed(2));

            commissionAmount += baseValue;
            appliedCommissionDefinitions.add(defKey);

            console.log("COMMISSION SPLIT APPLIED:", {
              rule: rule.transactionType,
              component: split.componentName,
              amount: baseValue
            });
          } else {
            baseValue = computeValue(orderAmount, split);
          }

          /* ---------------------------
           * 7.2 Resolve Ledger Instance
           * --------------------------- */
          const mainInstance = await resolveOrCreateInstance(split, session);
>>>>>>> a6ead15 (made changes to the orderController and working on the commission flow)

          /* ---------------------------
           * 7.3 Commission Metadata
           * --------------------------- */
          if (split.type === "commission") {
            commissionDetails.push({
              componentName: split.componentName,
              amount: mongoose.Types.Decimal128.fromString(String(baseValue)),
              instanceId: mainInstance._id,
              summaryId: split.summaryId,
              definitionId: split.definitionId,
            });
          }

          /* ---------------------------
           * 7.4 Main Ledger Posting
           * --------------------------- */
          await updateBalance(mainInstance, baseValue, split.debitOrCredit, session);
          await updateSummaryBalance(split.summaryId, baseValue, split.debitOrCredit, session);

          const mainLine = {
            componentName: split.componentName,
            category: split.type,
            amount: baseValue,
            debitOrCredit: split.debitOrCredit,
            summaryId: split.summaryId,
            instanceId: mainInstance._id,
            definitionId: split.definitionId,
            ruleType: rule.transactionType,
            isReflectOnly: false,
            _isMirror: false
          };

          allLines.push(mainLine);
          postingLines.push(mainLine);

          /* ---------------------------
           * 7.5 MIRRORS / REFLECTIONS
           * --------------------------- */
          let splitDebit = split.debitOrCredit === "debit" ? baseValue : 0;
          let splitCredit = split.debitOrCredit === "credit" ? baseValue : 0;

          for (const mirror of split.mirrors || []) {
            let mirrorInstance;
            try {
              mirrorInstance = await resolveOrCreateInstance(mirror, session);
            } catch (err) {
              console.error("❌ [MIRROR INSTANCE ERROR]", {
                mirror,
                message: err.message,
                stack: err.stack,
                response: err.response?.data || null,
              });
              throw new Error(`Failed to resolve/create mirror instance for ${mirror.componentName}`);
            }

            const mirrorLine = {
              componentName: `${split.componentName} (mirror)`,
              category: split.type,
              amount: baseValue,
              debitOrCredit: mirror.debitOrCredit,
              summaryId: mirror.summaryId,
              instanceId: mirrorInstance?._id || null,
              definitionId: mirror.definitionId,
              ruleType: rule.transactionType,
              isReflectOnly: !!mirror.isReflectOnly,
              _isMirror: true
            };

            allLines.push(mirrorLine);

            if (!mirror.isReflectOnly) {
              await updateBalance(mirrorInstance, baseValue, mirror.debitOrCredit, session);
              await updateSummaryBalance(mirror.summaryId, baseValue, mirror.debitOrCredit, session);
              postingLines.push(mirrorLine);

              if (mirror.debitOrCredit === "debit") splitDebit += baseValue;
              if (mirror.debitOrCredit === "credit") splitCredit += baseValue;
            }
          }

          /* ---------------------------
           * 7.6 Split Balance Check
           * --------------------------- */
          if (Math.abs(splitDebit - splitCredit) > 0.01) {
            throw new Error(`Split imbalance: ${split.componentName}`);
          }
        }
      }

      /* ======================================================
       * 8. GLOBAL LEDGER BALANCE CHECK
       * ====================================================== */
      const totals = postingLines.reduce(
        (acc, l) => {
          acc[l.debitOrCredit] += Number(l.amount);
          return acc;
        },
        { debit: 0, credit: 0 }
      );

      if (Math.abs(totals.debit - totals.credit) > 0.01) {
        throw new Error("Ledger imbalance detected");
      }

<<<<<<< HEAD
      // -----------------------------
      // BREAKUP FILES
      // -----------------------------
=======
      /* ======================================================
       * 9. BREAKUP FILES
       * ====================================================== */
>>>>>>> a6ead15 (made changes to the orderController and working on the commission flow)
      const realLines = allLines.filter(l => !l._isMirror);

      const [parentBreakup] = await BreakupFileModel.create(
        [{
          orderId,
          orderType,
          orderAmount,
          buyerId: businessBuyerId,
          sellerId: businessSellerId,
          breakupType: "parent",
          lines: realLines,
          totalDebit: totals.debit,
          totalCredit: totals.credit
        }],
        { session }
      );

<<<<<<< HEAD
      // -----------------------------
      // TRANSACTION SAVE
      // -----------------------------
      const transactionLinesForSave = allLines.map(l => ({
        instanceId: l.instanceId,
        summaryId: l.summaryId,
        definitionId: l.definitionId,
        debitOrCredit: l.debitOrCredit,
        amount: mongoose.Types.Decimal128.fromString(String(safeNumber(l.amount))),
        description: l.componentName,
        isReflection: !!l.isReflectOnly,
      }));

      await TransactionModel.create([{
        description: `Order Transaction ${orderId}`,
        orderId,
        orderDeliveredAt: deliveredAt || null,
        returnExpiryDate,
        expiryReached: false,
        type: "journal",
        amount: mongoose.Types.Decimal128.fromString(String(orderAmount)),
        lines: transactionLinesForSave,
        totalDebits: postingTotals.debit,
        totalCredits: postingTotals.credit,
        isBalanced,
      }], { session });
=======
      const sellerLines = realLines.filter(l =>
        ["receivable", "commission", "income", "tax"].includes(l.category)
      );

      const [sellerBreakup] = await BreakupFileModel.create(
        [{
          orderId,
          orderType,
          orderAmount,
          buyerId: businessBuyerId,
          sellerId: businessSellerId,
          breakupType: "seller",
          parentBreakupId: parentBreakup._id,
          lines: sellerLines
        }],
        { session }
      );
>>>>>>> a6ead15 (made changes to the orderController and working on the commission flow)

      /* ======================================================
       * 10. TRANSACTION (JOURNAL)
       * ====================================================== */
      await TransactionModel.create(
        [{
          description: `Journal for Order ${orderId}`,
          type: "journal",
          totalDebits: mongoose.Types.Decimal128.fromString(String(totals.debit)),
          totalCredits: mongoose.Types.Decimal128.fromString(String(totals.credit)),
              
          amount: mongoose.Types.Decimal128.fromString(String(orderAmount)),
          
          isBalanced: true,
          lines: allLines.map(l => ({
            instanceId: l.instanceId,
            summaryId: l.summaryId,
            definitionId: l.definitionId,
            debitOrCredit: l.debitOrCredit,
            amount: mongoose.Types.Decimal128.fromString(String(l.amount)),
            description: l.componentName,
            isReflection: !!l.isReflectOnly
          })),
          commissionAmount: mongoose.Types.Decimal128.fromString(
            commissionAmount.toFixed(2)
          ),
          commissionDetails,
          orderDetails: {
            orderId,
            orderDeliveredAt: orderPlacedAt,
            returnExpiryDate,
            expiryReached: false,
            readyForRetainedEarning: false
          }
        }],
        { session }
      );

      /* ======================================================
       * 11. SELLER FINANCIAL UPDATE
       * ====================================================== */
      const sellerReceivable = sellerLines
        .filter(l => l.category === "receivable")
        .reduce((sum, l) => sum + Number(l.amount), 0);

<<<<<<< HEAD
      try {
        await updateSellerFinancials(sellerId, sellerReceivable, { type: "new" }, session);
      } catch (err) {
        console.error("❌ [SELLER FINANCIAL ERROR]", {
          sellerId,
          message: err.message,
          stack: err.stack,
          response: err.response?.data || null,
        });
        throw err;
      }
=======
      await updateSellerFinancials(
        businessSellerId,
        sellerReceivable,
        { type: "new", orderId },
        session
      );
>>>>>>> a6ead15 (made changes to the orderController and working on the commission flow)

      /* ======================================================
       * 12. RESPONSE
       * ====================================================== */
      res.status(200).json({
        success: true,
        message: "Order processed successfully",
        data: {
          order,
          parentBreakup,
          sellerBreakup,
          returnExpiryDate
        }
      });
    });
  } catch (err) {
<<<<<<< HEAD
    console.error("❌ [ORDER ERROR]", {
      message: err.message,
      stack: err.stack,
      response: err.response?.data || null,
      status: err.response?.status || null,
    });
=======
    console.error("❌ ORDER ERROR:", err);
>>>>>>> a6ead15 (made changes to the orderController and working on the commission flow)
    res.status(500).json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  } finally {
    await session.endSession();
  }
};

// export const processReturnExpiryTransactions = async () => {
//   const session = await mongoose.startSession();
//   try {
//     await session.withTransaction(async () => {
//       const now = new Date();

//       // 1️⃣ Find expired transactions that haven't been processed for return expiry
//       const expiredTransactions = await TransactionModel.find({
//         type: "journal",
//         "orderDetails.returnExpiryDate": { $lte: now },
//         "orderDetails.expiryReached": false,
//       }).session(session);

//       console.log(`⏰ [CRON] Found ${expiredTransactions.length} expired transactions`);

//       for (const txn of expiredTransactions) {
//         console.log(`🔹 Processing transaction for order: ${txn.orderDetails.orderId}`);

//         // 2️⃣ Fetch the Commission Confirmed rules
//         const rules = await BreakupRuleModel.find({
//           transactionType: "Commission Confirmed",
//         }).session(session);

//         const allLines = [];

//         // 3️⃣ Apply rules on the commissionAmount instead of orderAmount
//         const commissionAmount = safeNumber(txn.commissionAmount || 0);

//         if (commissionAmount <= 0) {
//           console.log(`⚠️ No commission to process for order ${txn.orderDetails.orderId}`);
//           txn.orderDetails.expiryReached = true;
//           await txn.save({ session });
//           continue;
//         }

//         for (const rule of rules) {
//           for (const split of rule.splits || []) {
//             // Use the commissionAmount as the base for all splits
//             const baseValue = parseFloat(((commissionAmount * (split.percentage || 0)) / 100).toFixed(2));

//             // 4️⃣ Resolve ledger instance
//             const instance = await resolveOrCreateInstance(split, session);

//             // 5️⃣ Update balances
//             await updateBalance(instance, baseValue, split.debitOrCredit, session);
//             await updateSummaryBalance(split.summaryId, baseValue, split.debitOrCredit, session);

//             // 6️⃣ Store line for the transaction
//             allLines.push({
//               instanceId: instance._id,
//               summaryId: split.summaryId,
//               definitionId: split.definitionId,
//               debitOrCredit: split.debitOrCredit,
//               amount: baseValue,
//               description: split.componentName,
//               isReflection: false,
//             });

//             // 7️⃣ Apply mirror lines if any
//             for (const mirror of split.mirrors || []) {
//               const mirrorInstance = await resolveOrCreateInstance(mirror, session);

//               const mirrorValue = baseValue; // same as baseValue
//               await updateBalance(mirrorInstance, mirrorValue, mirror.debitOrCredit, session);
//               await updateSummaryBalance(mirror.summaryId, mirrorValue, mirror.debitOrCredit, session);

//               allLines.push({
//                 instanceId: mirrorInstance._id,
//                 summaryId: mirror.summaryId,
//                 definitionId: mirror.definitionId,
//                 debitOrCredit: mirror.debitOrCredit,
//                 amount: mirrorValue,
//                 description: `${split.componentName} (mirror)`,
//                 isReflection: !!mirror.isReflectOnly,
//               });
//             }
//           }
//         }

//         // 8️⃣ Append lines and mark transaction as processed
//         txn.lines.push(...allLines);
//         txn.orderDetails.expiryReached = true;
//         await txn.save({ session });

//         console.log(`✅ Transaction updated and expiry marked for order ${txn.orderDetails.orderId}`);
//       }
//     });
//   } catch (err) {
//     console.error("❌ [CRON ERROR]", err);
//   } finally {
//     await session.endSession();
//   }
// };

// for testing:

export const processReturnExpiryTransactions = async (forceProcess = false) => {
  const session = await mongoose.startSession();

  try {
    console.log("🕒 [CRON] Return-expiry & commission settlement started");

    await session.withTransaction(async () => {
      const now = new Date();

      /* ======================================================
       * 1. FIND ELIGIBLE ORDER JOURNALS
       * ====================================================== */
      const query = {
        type: "journal",
        "orderDetails.expiryReached": false,
      };

      if (!forceProcess) {
        query["orderDetails.returnExpiryDate"] = { $lte: now };
      }

      const orderTxns = await TransactionModel.find(query).session(session);

      if (!orderTxns.length) {
        console.log("ℹ️ [CRON] No eligible transactions");
        return;
      }

      console.log(`⏰ [CRON] Found ${orderTxns.length} transactions`);

      /* ======================================================
       * 2. COLLECT COMMISSION
       * ====================================================== */
      let totalCommission = 0;
      const sourceOrderIds = [];

      for (const txn of orderTxns) {
        const commission = safeNumber(txn.commissionAmount);
        if (commission > 0) {
          totalCommission += commission;
          sourceOrderIds.push(txn.orderDetails?.orderId);
        }

        txn.orderDetails.expiryReached = true;
        txn.orderDetails.readyForRetainedEarning = true;
        await txn.save({ session });
      }

      if (totalCommission <= 0) {
        console.log("⚠️ [CRON] No commission to settle");
        return;
      }

      console.log(`💰 [CRON] Total commission collected: ${totalCommission}`);

      /* ======================================================
       * 3. LOAD COMMISSION CONFIRMED RULES
       * ====================================================== */
      const rules = await BreakupRuleModel.find({
        transactionType: "Commission Confirmed",
      }).session(session);

      if (!rules.length) {
        throw new Error("No Commission Confirmed rules found");
      }

      /* ======================================================
       * 4. APPLY RULES ON AGGREGATED COMMISSION
       * ====================================================== */
      const settlementLines = [];

      for (const rule of rules) {
        for (const split of rule.splits || []) {
          // base value comes ONLY from aggregated commission
          let baseValue = computeValue(totalCommission, split);
          baseValue = safeNumber(baseValue);

          if (baseValue <= 0) continue;

          /* ---------------- Instance ---------------- */
          const instance = await resolveOrCreateInstance(split, session);

          /* ---------------- Ledger Updates ---------------- */
          await updateBalance(instance, baseValue, split.debitOrCredit, session);
          await updateSummaryBalance(split.summaryId, baseValue, split.debitOrCredit, session);

          settlementLines.push({
            instanceId: instance._id,
            summaryId: split.summaryId,
            definitionId: split.definitionId,
            debitOrCredit: split.debitOrCredit,
            amount: mongoose.Types.Decimal128.fromString(baseValue.toFixed(2)),
            description: split.componentName,
            isReflection: false,
          });

          /* ---------------- Mirrors ---------------- */
          for (const mirror of split.mirrors || []) {
            const mirrorInstance = await resolveOrCreateInstance(mirror, session);

            await updateBalance(
              mirrorInstance,
              baseValue,
              mirror.debitOrCredit,
              session
            );

            await updateSummaryBalance(
              mirror.summaryId,
              baseValue,
              mirror.debitOrCredit,
              session
            );

            settlementLines.push({
              instanceId: mirrorInstance._id,
              summaryId: mirror.summaryId,
              definitionId: mirror.definitionId,
              debitOrCredit: mirror.debitOrCredit,
              amount: mongoose.Types.Decimal128.fromString(baseValue.toFixed(2)),
              description: `${split.componentName} (mirror)`,
              isReflection: false,
            });
          }
        }
      }

      /* ======================================================
       * 5. CREATE SETTLEMENT JOURNAL
       * ====================================================== */
      await TransactionModel.create(
        [{
          description: `Commission Confirmed Settlement`,
          type: "journal",
          amount: mongoose.Types.Decimal128.fromString(totalCommission.toFixed(2)),
          status: "posted",
          lines: settlementLines,
          metadata: {
            sourceOrders: sourceOrderIds,
            settlementType: "commission-confirmed",
          },
        }],
        { session }
      );

      console.log("✅ [CRON] Commission settlement journal created");
    });
  } catch (err) {
    console.error("❌ [CRON ERROR]", err);
  } finally {
    await session.endSession();
  }
};

// ----------------- RETURN ORDER ----------------- (unchanged)
export const returnOrderWithTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { orderId } = req.body;
      if (!orderId) throw new Error("orderId is required for return");

      // Fetch original parent breakup
      const originalBreakup = await BreakupFileModel.findOne({ orderId, breakupType: "parent" })
        .session(session)
        .lean();

      if (!originalBreakup) throw new Error("Original order not found");

      const { orderAmount, orderType, buyerId, businessSellerId, lines: originalLines } = originalBreakup;
      const reversedLines = [];

      for (const originalLine of originalLines) {
        const value = Number(originalLine.value) || 0;
        const reversedDebitOrCredit = originalLine.debitOrCredit === "debit" ? "credit" : "debit";

        const splitInstance = await SummaryFieldLineInstance.findById(safeToObjectId(originalLine.instanceId)).session(session);
        if (!splitInstance) throw new Error(`Instance not found: ${originalLine.instanceId}`);

        await updateBalance(splitInstance, value, reversedDebitOrCredit, session);

        // Conditional parent summary update
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

        // mirrors
        const reversedMirrors = [];
        for (const originalMirror of originalLine.mirrors || []) {
          const mirrorValue = Number(originalMirror.value) || 0;
          const reversedMirror = originalMirror.debitOrCredit === "debit" ? "credit" : "debit";
          const mirrorInstance = await SummaryFieldLineInstance.findById(safeToObjectId(originalMirror.instanceId)).session(session);

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
          } else {
            console.log(`[DEBUG] Skipped mirror reversal for ${originalMirror.componentName} to avoid double reversal.`);
          }

          reversedMirrors.push({
            ...originalMirror,
            value: mirrorValue,
            instanceId: mirrorInstance._id,
            debitOrCredit: reversedMirror,
            _isMirror: true,
          });
        }

        reversedLines.push({
          componentName: `Return - ${originalLine.componentName}`,
          category: originalLine.category,
          value,
          debitOrCredit: reversedDebitOrCredit,
          summaryId: originalLine.summaryId,
          instanceId: splitInstance._id,
          definitionId: originalLine.definitionId,
          mirrors: reversedMirrors,
          ruleType: originalLine.ruleType,
          isReturn: true,
        });

        console.log(`[DEBUG] Reversed line: ${originalLine.componentName} | value=${value} | debitOrCredit=${reversedDebitOrCredit}`);
      }

      // totals
      const totals = reversedLines.reduce((acc, l) => {
        if (l.debitOrCredit === "debit") acc.debit += safeNumber(l.value);
        else acc.credit += safeNumber(l.value);
        return acc;
      }, { debit: 0, credit: 0 });

      // save return breakup
      const [returnBreakup] = await BreakupFileModel.create([{
        orderId,
        orderType,
        orderAmount: -Math.abs(orderAmount),
        actualAmount: -Math.abs(orderAmount),
        buyerId,
        sellerId,
        breakupType: "return",
        parentBreakupId: originalBreakup._id,
        lines: reversedLines,
        totalDebit: totals.debit,
        totalCredit: totals.credit,
        returnDate: new Date(),
        isReturn: true,
      }], { session });

      // save transaction
      const transactionLines = [];
      reversedLines.forEach((l) => {
        transactionLines.push({
          instanceId: l.instanceId,
          summaryId: l.summaryId,
          definitionId: l.definitionId,
          debitOrCredit: l.debitOrCredit,
          amount: l.value,
          isReturn: true,
        });
        l.mirrors.forEach((m) => transactionLines.push({
          instanceId: m.instanceId,
          summaryId: m.summaryId,
          definitionId: m.definitionId,
          debitOrCredit: m.debitOrCredit,
          amount: m.value,
          isReturn: true,
        }));
      });

      console.log("[DEBUG] Total return transaction amount:", transactionLines.reduce((acc, t) => acc + t.amount, 0));

      await TransactionModel.create([{
        description: `Return for Order: ${orderId}`,
        amount: transactionLines.reduce((acc, t) => acc + t.amount, 0),
        lines: transactionLines,
        isReturn: true,
        originalOrderId: orderId,
        returnDate: new Date(),
      }], { session });

      res.json({ success: true, message: "Return processed successfully - balances fully reversed", returnBreakup });
    });
  } catch (err) {
    console.error("❌ Return processing error:", err);
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
    let returnAmount = 0;

    transactions.forEach((transaction) => {
      transaction.lines.forEach((line) => {
        if (line.instanceId.toString() === instanceId) {
          if (transaction.isReturn) returnAmount += line.amount;
          else originalAmount += line.amount;
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

const safeString = (val) => (val ? String(val) : "");

export const updateSellerFinancials = async (businessSellerId, sellerNetReceivable, options = {}, session = null) => {
  const seller = await Seller.findOne({ businessSellerId: businessSellerId }).session(session);
  if (!seller) throw new Error(`Seller with ID ${businessSellerId} not found`);

  const { type } = options;
  const amount = Number(sellerNetReceivable) || 0;

  if (type === "new") {
    seller.totalOrders += 1;
    seller.pendingOrders += 1;
    seller.totalReceivableAmount += amount;
    seller.remainingReceivableAmount += amount;
  }

  if (type === "paid") {
    seller.pendingOrders = Math.max(seller.pendingOrders - 1, 0);
    seller.paidOrders += 1;
    seller.paidReceivableAmount += amount;
    seller.remainingReceivableAmount = Math.max(seller.remainingReceivableAmount - amount, 0);
  }

  // Recalculate balance
  seller.currentBalance = seller.remainingReceivableAmount;
  seller.lastUpdated = new Date();

  await seller.save({ session });
  console.log(`🏦 [SELLER] Financials updated for seller ${seller.name} (${businessSellerId})`);

  return seller;
};