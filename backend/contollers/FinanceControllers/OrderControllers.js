// controllers/FinanceControllers/OrderControllers.js
import mongoose from "mongoose";
const { ObjectId } = mongoose.Types;
import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

import BreakupRuleModel from "../../models/FinanceModals/BreakupRules.js";
import SummaryModel from "../../models/FinanceModals/SummaryModel.js";
import SummaryFieldLineInstance from "../../models/FinanceModals/FieldLineInstanceModel.js";
import BreakupFileModel from "../../models/FinanceModals/BreakupFiles.js";
import TransactionModel from "../../models/FinanceModals/TransactionModel.js";
import Order from "../../models/FinanceModals/OrdersModel.js";
import api from "../../../frontend/src/api/axios.js";
import {ensureSellerExists} from "../../contollers/FinanceControllers/SellerController.js";

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

  // Guard: always work with numbers
  const fixed = Number(split.fixedAmount) || 0;
  const percentage = Number(split.percentage) || 0;

  if (split.perTransaction) {
    // ✅ Per-transaction means: apply fixed + percentage ONCE per transaction
    value += fixed + (percentage / 100) * orderAmount;

    console.log(
      `[DEBUG] computeValue | component=${split.componentName} | perTransaction=YES | fixed=${fixed} | percentage=${percentage}% of ${orderAmount} | total=${value}`
    );
  } else {
    // ✅ Standard: add fixed and percentage separately
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

// Resolve or create instance (non-duplicating)
const resolveOrCreateInstance = async (split, session) => {
  const summaryId = safeToObjectId(split.summaryId);
  const definitionId = safeToObjectId(split.definitionId);

  // ✅ First check by explicit instanceId
  if (split.instanceId && safeToObjectId(split.instanceId)) {
    const inst = await SummaryFieldLineInstance.findById(
      safeToObjectId(split.instanceId)
    ).session(session);
    if (inst) return inst;
  }

  // ✅ Next, check if an instance already exists for this summary+definition+fieldLine
  let instance = await SummaryFieldLineInstance.findOne({
    summaryId,
    definitionId,
    fieldLineNumericId: split.fieldLineId ?? split.fieldLineNumericId ?? null,
  }).session(session);

  if (instance) {
    // ⚡ reuse existing, do not duplicate
    return instance;
  }

  // ✅ Otherwise, create new
  const doc = {
    _id:
      split.instanceId && safeToObjectId(split.instanceId)
        ? safeToObjectId(split.instanceId)
        : new ObjectId(),
    name: split.componentName ?? "Auto Instance",
    summaryId,
    definitionId,
    fieldLineNumericId: split.fieldLineId ?? split.fieldLineNumericId ?? null,
    balance: 0,
    startingBalance: 0,
    endingBalance: 0,
  };

  const created = await SummaryFieldLineInstance.create([doc], { session });
  return created[0];
};

export const updateBalance = async (instance, value, debitOrCredit, session) => {
  if (!instance) return;

  const numericValue = Number(value) || 0;

  // ========== Update the Instance ==========
  instance.startingBalance ??= instance.balance ?? 0;

  if (debitOrCredit === "debit") {
    instance.balance = (instance.balance ?? 0) + numericValue;
  } else if (debitOrCredit === "credit") {
    instance.balance = (instance.balance ?? 0) - numericValue;
  } else {
    throw new Error(`Invalid debitOrCredit: ${debitOrCredit}`);
  }

  instance.endingBalance = instance.balance;
  await instance.save({ session });

  // ========== Update the Parent Summary ==========
  if (instance.summaryId) {
    const summary = await SummaryModel.findById(instance.summaryId).session(
      session
    );
    if (summary) {
      summary.startingBalance ??= summary.endingBalance ?? 0;
      if (typeof summary.endingBalance !== "number")
        summary.endingBalance = summary.startingBalance;

      if (debitOrCredit === "debit") {
        summary.endingBalance += numericValue;
      } else {
        summary.endingBalance -= numericValue;
      }

      // keep a running "currentBalance" if needed
      if (typeof summary.currentBalance !== "number")
        summary.currentBalance = summary.startingBalance;
      if (debitOrCredit === "debit") {
        summary.currentBalance += numericValue;
      } else {
        summary.currentBalance -= numericValue;
      }

      await summary.save({ session });
    }
  }
};

// -------------------------------
// Helper: Update Summary Balance (when you need to update a summary that is
// referenced directly by summaryId (numeric or ObjectId) rather than via instance)
// -------------------------------
const updateSummaryBalance = async (summaryIdentifier, value, debitOrCredit, session) => {
  if (!summaryIdentifier) return;

  const numericValue = Number(value) || 0;

  // Resolve the summary doc:
  let summaryDoc = null;

  // If numeric (actual number or numeric string) -> resolve by summaryId field
  const asNumber = Number(summaryIdentifier);
  if (!isNaN(asNumber) && typeof summaryIdentifier !== "object") {
    // treat as numeric summaryId (e.g., 1500)
    summaryDoc = await SummaryModel.findOne({ summaryId: asNumber }).session(
      session
    );
  } else {
    // try as ObjectId
    const objId = safeToObjectId(summaryIdentifier);
    if (objId) {
      summaryDoc = await SummaryModel.findById(objId).session(session);
    } else if (summaryIdentifier && typeof summaryIdentifier === "object") {
      // maybe the caller passed the whole doc or an object with _id
      const maybeId = safeToObjectId(summaryIdentifier._id);
      if (maybeId) {
        summaryDoc = await SummaryModel.findById(maybeId).session(session);
      } else {
        // maybe object contains numeric summaryId
        const sNum = Number(summaryIdentifier.summaryId);
        if (!isNaN(sNum)) {
          summaryDoc = await SummaryModel.findOne({ summaryId: sNum }).session(
            session
          );
        }
      }
    }
  }

  if (!summaryDoc) {
    // Not fatal — log and return (the instance updates still occurred)
    console.warn(
      `[WARN] updateSummaryBalance: summary not found for identifier: ${JSON.stringify(
        summaryIdentifier
      )}`
    );
    return;
  }

  summaryDoc.startingBalance ??= summaryDoc.endingBalance ?? 0;
  if (typeof summaryDoc.endingBalance !== "number")
    summaryDoc.endingBalance = summaryDoc.startingBalance;

  if (debitOrCredit === "debit") {
    summaryDoc.endingBalance = (summaryDoc.endingBalance || 0) + numericValue;
  } else if (debitOrCredit === "credit") {
    summaryDoc.endingBalance = (summaryDoc.endingBalance || 0) - numericValue;
  } else {
    throw new Error(`Invalid debitOrCredit: ${debitOrCredit}`);
  }

  // optional currentBalance
  if (typeof summaryDoc.currentBalance !== "number")
    summaryDoc.currentBalance = summaryDoc.startingBalance;
  if (debitOrCredit === "debit") summaryDoc.currentBalance += numericValue;
  else summaryDoc.currentBalance -= numericValue;

  await summaryDoc.save({ session });
};

const BUSINESS_API_BASE = process.env.BUSINESS_API_BASE;
export const createOrderWithTransaction = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // ✅ Step 1: Validate input
      const { orderAmount, orderType, buyerId, sellerId, orderId } = req.body;
      if (!orderAmount || !orderType || !buyerId || !sellerId || !orderId)
        throw new Error("Missing required fields");

      console.log(`🚀 [ORDER] Processing Order: ${orderId} | Seller: ${sellerId}`);

      // ✅ Step 2: Ensure Seller Exists
      const seller = await ensureSellerExists(sellerId);

      // ✅ Step 3: Load breakup rules
      const ruleTypes =
        orderType === "auction"
          ? ["auction", "auctionTax", "auctionDeposit"]
          : [orderType, `${orderType}Tax`];

      const rules = await BreakupRuleModel.find({
        transactionType: { $in: ruleTypes },
      })
        .session(session)
        .lean();

      if (!rules?.length)
        throw new Error(`No BreakupRules found for type ${orderType}`);

      console.log(`📘 [RULES] Loaded ${rules.length} breakup rules`);

      // ✅ Step 4: Compute all splits + mirrors
      const allLines = [];

      for (const rule of rules) {
        for (const split of rule.splits || []) {
          const baseValue = computeValue(orderAmount, split);

          // --- MAIN SPLIT ---
          const mainInstance = await resolveOrCreateInstance(split, session);
          await updateBalance(mainInstance, baseValue, split.debitOrCredit, session);
          await updateSummaryBalance(split.summaryId, baseValue, split.debitOrCredit, session);

          allLines.push({
            componentName: split.componentName,
            category: split.type,
            amount: baseValue,
            debitOrCredit: split.debitOrCredit,
            summaryId: split.summaryId,
            instanceId: mainInstance._id,
            definitionId: split.definitionId,
            ruleType: rule.transactionType,
            isReflectOnly: false,
          });

          // --- MIRRORS ---
          if (Array.isArray(split.mirrors) && split.mirrors.length > 0) {
            for (const mirror of split.mirrors) {
              const mirrorInstance = await resolveOrCreateInstance(mirror, session);

              // ✅ Only update balances if NOT reflection-only
              if (!mirror.isReflectOnly) {
                await updateBalance(mirrorInstance, baseValue, mirror.debitOrCredit, session);
                await updateSummaryBalance(mirror.summaryId, baseValue, mirror.debitOrCredit, session);
              } else {
                console.log(
                  `🪞 [REFLECT] Mirror for ${split.componentName} (Summary: ${mirror.summaryId}) is reflection-only — skipping balance updates.`
                );
              }

              // ✅ Still include in lines for display / tracking
              allLines.push({
                componentName: `${split.componentName} (mirror)`,
                category: split.type,
                amount: baseValue,
                debitOrCredit: mirror.debitOrCredit,
                summaryId: mirror.summaryId,
                instanceId: mirrorInstance._id,
                definitionId: mirror.definitionId,
                ruleType: rule.transactionType,
                isReflectOnly: mirror.isReflectOnly || false,
              });
            }
          }
        }
      }

      // ✅ Step 5: Compute totals excluding reflection-only entries
      const totals = allLines.reduce(
        (acc, l) => {
          if (!l.isReflectOnly) {
            if (l.debitOrCredit === "debit") acc.debit += safeNumber(l.amount);
            else acc.credit += safeNumber(l.amount);
          }
          return acc;
        },
        { debit: 0, credit: 0 }
      );

      const imbalance = Math.abs(totals.debit - totals.credit);
      if (imbalance > 0.01) {
        console.warn(
          `⚠️ [IMBALANCE DETECTED] Debit: ${totals.debit}, Credit: ${totals.credit}, Difference: ${imbalance}`
        );
      } else {
        console.log(`💰 [BALANCED] Debit: ${totals.debit}, Credit: ${totals.credit}`);
      }

      // ✅ Step 6: Create breakup files
      const [parentBreakup] = await BreakupFileModel.create(
        [
          {
            orderId,
            orderType,
            orderAmount,
            actualAmount: orderAmount,
            buyerId,
            sellerId,
            breakupType: "parent",
            parentBreakupId: null,
            lines: allLines,
            totalDebit: totals.debit,
            totalCredit: totals.credit,
          },
        ],
        { session }
      );

      const sellerLines = allLines.filter(l =>
        ["income", "receivable", "commission", "principal"].includes(l.category)
      );
      const buyerLines = allLines.filter(l =>
        ["expense", "deduction", "tax", "charge"].includes(l.category)
      );

      const [sellerBreakup] = await BreakupFileModel.create(
        [
          {
            orderId,
            orderType,
            orderAmount,
            buyerId,
            sellerId,
            breakupType: "seller",
            parentBreakupId: parentBreakup._id,
            lines: sellerLines,
            totalDebit: sellerLines.reduce(
              (sum, l) => sum + (!l.isReflectOnly && l.debitOrCredit === "debit" ? l.amount : 0),
              0
            ),
            totalCredit: sellerLines.reduce(
              (sum, l) => sum + (!l.isReflectOnly && l.debitOrCredit === "credit" ? l.amount : 0),
              0
            ),
          },
        ],
        { session }
      );

      const [buyerBreakup] = await BreakupFileModel.create(
        [
          {
            orderId,
            orderType,
            orderAmount,
            buyerId,
            sellerId,
            breakupType: "buyer",
            parentBreakupId: parentBreakup._id,
            lines: buyerLines,
            totalDebit: buyerLines.reduce(
              (sum, l) => sum + (!l.isReflectOnly && l.debitOrCredit === "debit" ? l.amount : 0),
              0
            ),
            totalCredit: buyerLines.reduce(
              (sum, l) => sum + (!l.isReflectOnly && l.debitOrCredit === "credit" ? l.amount : 0),
              0
            ),
          },
        ],
        { session }
      );

      console.log(`🧾 [BREAKUP] Parent, Seller, Buyer breakups created successfully.`);

      // ✅ Step 7: Record transaction (excluding reflection-only)
      const transactionAmount = totals.credit - totals.debit;

      await TransactionModel.create(
        [
          {
            description: `Transaction for Order ID: ${orderId}`,
            amount: transactionAmount,
            lines: allLines
              .filter(l => !l.isReflectOnly)
              .map(l => ({
                instanceId: l.instanceId,
                summaryId: l.summaryId,
                definitionId: l.definitionId,
                debitOrCredit: l.debitOrCredit,
                amount: l.amount,
              })),
          },
        ],
        { session }
      );

      console.log(`📒 [TRANSACTION] Recorded transaction of ${transactionAmount}`);

      // ✅ Step 8: Update Seller Financials
      seller.totalOrders += 1;
      seller.totalPending += orderAmount;
      seller.currentBalance = seller.totalPending - seller.totalPaid;
      seller.lastUpdated = new Date();
      await seller.save({ session });

      console.log(`🏦 [SELLER] Updated financials for ${seller.name}`);

      // ✅ Step 9: Respond
      res.status(200).json({
        success: true,
        message: "Order transaction processed successfully",
        data: { parentBreakup, sellerBreakup, buyerBreakup },
      });
    });
  } catch (err) {
    console.error("❌ [ORDER ERROR]:", err);
    res.status(500).json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  } finally {
    await session.endSession();
  }
};


// ----------------- RETURN ORDER -----------------
export const returnOrderWithTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { orderId } = req.body;
      if (!orderId) throw new Error("orderId is required for return");

      // 🔎 Fetch original parent breakup
      const originalBreakup = await BreakupFileModel.findOne({
        orderId,
        breakupType: "parent",
      })
        .session(session)
        .lean();

      if (!originalBreakup) throw new Error("Original order not found");

      const { orderAmount, orderType, buyerId, sellerId, lines: originalLines } =
        originalBreakup;

      const reversedLines = [];

      for (const originalLine of originalLines) {
        const value = Number(originalLine.value) || 0;
        const reversedDebitOrCredit =
          originalLine.debitOrCredit === "debit" ? "credit" : "debit";

        // --- main instance ---
        const splitInstance = await SummaryFieldLineInstance.findById(
          safeToObjectId(originalLine.instanceId)
        ).session(session);

        if (!splitInstance)
          throw new Error(`Instance not found: ${originalLine.instanceId}`);

        await updateBalance(splitInstance, value, reversedDebitOrCredit, session);

        // Conditional parent summary update
        try {
          const providedSummaryObj = safeToObjectId(originalLine.summaryId);
          const instanceSummaryStr = splitInstance?.summaryId
            ? splitInstance.summaryId.toString()
            : null;

          if (!instanceSummaryStr) {
            await updateSummaryBalance(originalLine.summaryId, value, reversedDebitOrCredit, session);
          } else if (providedSummaryObj && instanceSummaryStr !== providedSummaryObj.toString()) {
            await updateSummaryBalance(providedSummaryObj, value, reversedDebitOrCredit, session);
          }
        } catch (e) {
          console.warn("Error in conditional summary update (return):", e);
        }

        // --- mirrors ---
        const reversedMirrors = [];
        for (const originalMirror of originalLine.mirrors || []) {
          const mirrorValue = Number(originalMirror.value) || 0;
          const reversedMirror =
            originalMirror.debitOrCredit === "debit" ? "credit" : "debit";

          const mirrorInstance = await SummaryFieldLineInstance.findById(
            safeToObjectId(originalMirror.instanceId)
          ).session(session);

          if (!mirrorInstance)
            throw new Error(`Mirror instance not found: ${originalMirror.instanceId}`);

          // ✅ Skip mirror if same as main split to avoid double reversal
          if (mirrorInstance._id.toString() !== splitInstance._id.toString()) {
            await updateBalance(mirrorInstance, mirrorValue, reversedMirror, session);

            try {
              const providedMirrorSummaryObj = safeToObjectId(
                originalMirror.summaryId
              );
              const mirrorInstanceSummaryStr = mirrorInstance?.summaryId
                ? mirrorInstance.summaryId.toString()
                : null;

              if (!mirrorInstanceSummaryStr) {
                await updateSummaryBalance(
                  originalMirror.summaryId,
                  mirrorValue,
                  reversedMirror,
                  session
                );
              } else if (
                providedMirrorSummaryObj &&
                mirrorInstanceSummaryStr !== providedMirrorSummaryObj.toString()
              ) {
                await updateSummaryBalance(
                  providedMirrorSummaryObj,
                  mirrorValue,
                  reversedMirror,
                  session
                );
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

      // --- totals ---
      const totals = reversedLines.reduce(
        (acc, l) => {
          if (l.debitOrCredit === "debit") acc.debit += safeNumber(l.value);
          else acc.credit += safeNumber(l.value);
          return acc;
        },
        { debit: 0, credit: 0 }
      );

      // --- save return breakup ---
      const [returnBreakup] = await BreakupFileModel.create(
        [
          {
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
          },
        ],
        { session }
      );

      // --- save transaction ---
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
        l.mirrors.forEach((m) =>
          transactionLines.push({
            instanceId: m.instanceId,
            summaryId: m.summaryId,
            definitionId: m.definitionId,
            debitOrCredit: m.debitOrCredit,
            amount: m.value,
            isReturn: true,
          })
        );
      });

      console.log("[DEBUG] Total return transaction amount:", transactionLines.reduce((acc, t) => acc + t.amount, 0));

      await TransactionModel.create(
        [
          {
            description: `Return for Order: ${orderId}`,
            amount: transactionLines.reduce((acc, t) => acc + t.amount, 0),
            lines: transactionLines,
            isReturn: true,
            originalOrderId: orderId,
            returnDate: new Date(),
          },
        ],
        { session }
      );

      res.json({
        success: true,
        message: "Return processed successfully - balances fully reversed",
        returnBreakup,
      });
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
    if (!instance) {
      return res.status(404).json({ error: "Instance not found" });
    }

    // Get all transactions for this instance
    const transactions = await TransactionModel.find({
      "lines.instanceId": instanceId,
    });

    let originalAmount = 0;
    let returnAmount = 0;

    transactions.forEach((transaction) => {
      transaction.lines.forEach((line) => {
        if (line.instanceId.toString() === instanceId) {
          if (transaction.isReturn) {
            returnAmount += line.amount;
          } else {
            originalAmount += line.amount;
          }
        }
      });
    });

    const netBalance = originalAmount + returnAmount; // Returns are negative

    res.json({
      instanceId,
      instanceName: instance.name,
      originalAmount,
      returnAmount,
      netBalance,
      transactionsCount: transactions.length,
    });
  } catch (err) {
    console.error("Error getting net balances:", err);
    res.status(500).json({ error: err.message });
  }
};

// Helper: ensures string is always valid
const safeString = (val) => (val ? String(val) : "");
