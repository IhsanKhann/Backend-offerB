// controllers/FinanceControllers/OrderControllers.js
import mongoose from "mongoose";
const { ObjectId } = mongoose.Types;

import BreakupRuleModel from "../../models/FinanceModals/BreakupRules.js";
import SummaryFieldLineInstance from "../../models/FinanceModals/FieldLineInstanceModel.js";
import BreakupFileModel from "../../models/FinanceModals/BreakupFiles.js";
import TransactionModel from "../../models/FinanceModals/TransactionModel.js";
import Order from "../../models/FinanceModals/OrdersModel.js";

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
    if (typeof id === 'string') {
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

const computeValue = (orderAmount, split) => {
  let value = 0;
  if (split.fixedAmount) value += safeNumber(split.fixedAmount);
  if (split.percentage) value += (split.percentage / 100) * orderAmount;
  if (split.perTransaction)
    value +=
      safeNumber(split.fixedAmount) +
      ((split.percentage ?? 0) / 100) * orderAmount;
  if (split.periodicity && split.periodicity !== "none")
    value = adjustForPeriodicity(value, split.periodicity);

  // tax slabs
  if (split.type === "tax" && split.slabStart != null && split.slabEnd != null) {
    if (
      orderAmount >= split.slabStart &&
      (split.slabEnd === null || orderAmount <= split.slabEnd)
    ) {
      value = safeNumber(split.fixedTax ?? value);
      if (split.additionalTaxPercentage)
        value += (split.additionalTaxPercentage / 100) * orderAmount;
    }
  }

  return Math.round(value * 100) / 100;
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
    _id: split.instanceId && safeToObjectId(split.instanceId) 
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

const updateBalance = async (instance, value, debitOrCredit, session) => {
  if (!instance) return;
  instance.startingBalance ??= instance.balance ?? 0;
  if (debitOrCredit === "debit")
    instance.balance = (instance.balance ?? 0) + value;
  else instance.balance = (instance.balance ?? 0) - value;
  instance.endingBalance = instance.balance;
  await instance.save({ session });
};

export const createOrderWithTransaction = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const { orderAmount, orderType, buyerId, sellerId, orderId } = req.body;
      if (!orderAmount || !orderType || !buyerId || !sellerId || !orderId)
        throw new Error("Missing required fields");

      const ruleTypes = orderType === "auction" ? ["auction", "auctionTax", "auctionDeposit"] : [orderType, `${orderType}Tax`];
      const rules = await BreakupRuleModel.find({ transactionType: { $in: ruleTypes } }).session(session).lean();
      if (!rules?.length) throw new Error(`No BreakupRules found for type ${orderType}`);

      const allLines = [];

      for (const rule of rules) {
        for (const split of rule.splits || []) {
          const value = computeValue(orderAmount, split);

          // resolve main split instance
          const splitInstance = await resolveOrCreateInstance(split, session);
          await updateBalance(splitInstance, value, split.debitOrCredit, session);

          // mirrors
          const mirrorsResolved = [];
          for (const mirror of split.mirrors || []) {
            const mirrorInstance = await resolveOrCreateInstance({
              ...mirror,
              componentName: split.componentName + " (Mirror)",
              summaryId: mirror.summaryId ?? split.summaryId,
              definitionId: mirror.definitionId ?? split.definitionId,
              fieldLineId: mirror.fieldLineId ?? mirror.fieldLineNumericId ?? split.fieldLineId ?? split.fieldLineNumericId,
            }, session);

            await updateBalance(mirrorInstance, value, mirror.debitOrCredit, session);

            mirrorsResolved.push({
              ...mirror,
              value,
              instanceId: mirrorInstance._id,
              debitOrCredit: mirror.debitOrCredit,
              _isMirror: true,
            });
          }

          allLines.push({
            componentName: split.componentName,
            category: split.type,
            value,
            debitOrCredit: split.debitOrCredit,
            summaryId: split.summaryId,
            instanceId: splitInstance._id,
            definitionId: split.definitionId,
            mirrors: mirrorsResolved,
            ruleType: rule.transactionType,
          });
        }
      }

      const totals = allLines.reduce(
        (acc, l) => {
          if (l.debitOrCredit === "debit") acc.debit += safeNumber(l.value);
          else acc.credit += safeNumber(l.value);
          return acc;
        },
        { debit: 0, credit: 0 }
      );

      const [parentBreakup] = await BreakupFileModel.create([{
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
      }], { session });

      const transactionLines = [];
      allLines.forEach(l => {
        transactionLines.push({
          instanceId: l.instanceId,
          summaryId: l.summaryId,
          definitionId: l.definitionId,
          debitOrCredit: l.debitOrCredit,
          amount: l.value,
        });
        l.mirrors.forEach(m =>
          transactionLines.push({
            instanceId: m.instanceId,
            summaryId: m.summaryId,
            definitionId: m.definitionId,
            debitOrCredit: m.debitOrCredit,
            amount: m.value,
          })
        );
      });

      await TransactionModel.create([{
        description: `Transaction for Order ID: ${orderId}`,
        amount: transactionLines.reduce((acc, t) => acc + t.amount, 0),
        lines: transactionLines,
      }], { session });

      res.json({ success: true, parentBreakup });
    });
  } catch (err) {
    console.error("❌ Order creation error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    await session.endSession();
  }
};

// Return / Reversal Transaction - PROPER ACCOUNTING APPROACH
export const returnOrderWithTransaction = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const { orderId } = req.body;
      if (!orderId) throw new Error("orderId is required for return");

      console.log("🔄 STARTING RETURN PROCESS =====================");
      console.log("📥 Processing return for order:", orderId);

      // 1. Find original order breakup
      const originalBreakup = await BreakupFileModel.findOne({
        orderId,
        breakupType: "parent",
      }).session(session).lean();

      if (!originalBreakup) {
        console.log("❌ Original breakup not found for order:", orderId);
        throw new Error("Original order not found");
      }

      // 2. Check if return already exists (prevent double returns)
      const existingReturn = await BreakupFileModel.findOne({
        orderId,
        breakupType: "return",
      }).session(session);

      if (existingReturn) {
        console.log("❌ Return already exists for order:", orderId);
        throw new Error("Return already processed for this order");
      }

      console.log("✅ Original breakup found:", {
        orderId: originalBreakup.orderId,
        orderType: originalBreakup.orderType,
        orderAmount: originalBreakup.orderAmount,
        linesCount: originalBreakup.lines?.length || 0
      });

      const { orderAmount, orderType, buyerId, sellerId, lines: originalLines } = originalBreakup;
      const allLines = [];

      // 3. Process each original line with PROPER REVERSAL
      console.log("🔄 Processing reversal entries...");
      for (let i = 0; i < originalLines.length; i++) {
        const originalLine = originalLines[i];
        const value = originalLine.value;

        console.log(`\n--- Reversing Line ${i + 1}: ${originalLine.componentName} ---`);
        console.log("   Original entry:", {
          amount: value,
          debitOrCredit: originalLine.debitOrCredit,
          summaryId: originalLine.summaryId
        });

        // 🔄 CRITICAL: Reverse debit/credit (proper accounting reversal)
        const reversedDebitOrCredit = originalLine.debitOrCredit === "debit" ? "credit" : "debit";
        console.log("   Reversal entry:", {
          amount: value,
          debitOrbitCredit: reversedDebitOrCredit,
          effect: "Reversing original transaction"
        });

        // ✅ Use the SAME summary IDs as original order (not return summary)
        // This ensures balances are properly reversed in the same accounts
        const originalSummaryId = originalLine.summaryId;

        // ✅ Find the ORIGINAL instance (must exist)
        const instanceId = safeToObjectId(originalLine.instanceId);
        if (!instanceId) {
          throw new Error(`Invalid instanceId: ${originalLine.instanceId}`);
        }

        const splitInstance = await SummaryFieldLineInstance.findById(instanceId).session(session);
        if (!splitInstance) {
          // Try fallback search
          const fallbackInstance = await SummaryFieldLineInstance.findOne({
            _id: originalLine.instanceId
          }).session(session);
          
          if (!fallbackInstance) {
            console.log("❌ Original instance not found:", originalLine.instanceId);
            throw new Error(`Original instance not found: ${originalLine.instanceId}`);
          }
          console.log("✅ Found instance via fallback search");
        }

        const originalBalance = splitInstance.balance;
        console.log("   Instance balance before reversal:", originalBalance);

        // ✅ Update balance with REVERSAL
        await updateBalance(splitInstance, value, reversedDebitOrCredit, session);
        
        console.log("   Instance balance after reversal:", splitInstance.balance);
        console.log("   Balance change:", `${originalBalance} → ${splitInstance.balance}`);

        // Process mirrors with reversal
        const mirrorsResolved = [];
        for (let j = 0; j < (originalLine.mirrors || []).length; j++) {
          const originalMirror = originalLine.mirrors[j];
          const reversedMirror = originalMirror.debitOrCredit === "debit" ? "credit" : "debit";
          
          const mirrorInstanceId = safeToObjectId(originalMirror.instanceId);
          if (!mirrorInstanceId) {
            throw new Error(`Invalid mirror instanceId: ${originalMirror.instanceId}`);
          }

          const mirrorInstance = await SummaryFieldLineInstance.findById(mirrorInstanceId).session(session);
          if (!mirrorInstance) {
            // Try fallback
            const fallbackMirror = await SummaryFieldLineInstance.findOne({
              _id: originalMirror.instanceId
            }).session(session);
            if (!fallbackMirror) {
              throw new Error(`Mirror instance not found: ${originalMirror.instanceId}`);
            }
          }

          const mirrorOriginalBalance = mirrorInstance.balance;
          await updateBalance(mirrorInstance, value, reversedMirror, session);

          console.log(`   Mirror ${j + 1} reversal:`, {
            instance: mirrorInstance._id.toString(),
            balanceChange: `${mirrorOriginalBalance} → ${mirrorInstance.balance}`
          });

          mirrorsResolved.push({
            ...originalMirror,
            value,
            instanceId: mirrorInstance._id,
            debitOrCredit: reversedMirror,
            _isMirror: true,
          });
        }

        allLines.push({
          componentName: `Return - ${originalLine.componentName}`,
          category: originalLine.category,
          value,
          debitOrCredit: reversedDebitOrCredit, // ✅ REVERSED
          summaryId: originalSummaryId, // ✅ SAME as original (not return summary)
          instanceId: splitInstance._id,
          definitionId: originalLine.definitionId,
          mirrors: mirrorsResolved,
          ruleType: originalLine.ruleType,
          isReturn: true, // Flag to identify return entries
        });

        console.log(`✅ Line ${i + 1} reversal completed`);
      }

      // 4. Create return breakup record (for tracking purposes only)
      const totals = allLines.reduce(
        (acc, l) => {
          if (l.debitOrCredit === "debit") acc.debit += safeNumber(l.value);
          else acc.credit += safeNumber(l.value);
          return acc;
        },
        { debit: 0, credit: 0 }
      );

      console.log("💾 Creating return breakup record...");
      const [returnBreakup] = await BreakupFileModel.create([{
        orderId,
        orderType,
        orderAmount: -Math.abs(orderAmount), // Negative amount to indicate return
        actualAmount: -Math.abs(orderAmount),
        buyerId,
        sellerId,
        breakupType: "return",
        parentBreakupId: originalBreakup._id,
        lines: allLines,
        totalDebit: totals.debit,
        totalCredit: totals.credit,
        returnDate: new Date(),
        isReturn: true,
      }], { session });

      // 5. Create return transaction
      const transactionLines = [];
      allLines.forEach((l) => {
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

      const returnTransactionAmount = transactionLines.reduce((acc, t) => acc + t.amount, 0);
      console.log("💾 Creating return transaction...");

      await TransactionModel.create([{
        description: `Return for Order: ${orderId}`,
        amount: -Math.abs(returnTransactionAmount), // Negative amount
        lines: transactionLines,
        isReturn: true,
        originalOrderId: orderId,
        returnDate: new Date(),
      }], { session });

      console.log("🎉 RETURN PROCESS COMPLETED SUCCESSFULLY");
      console.log("==========================================\n");

      res.json({
        success: true,
        message: "Return processed successfully - Original account balances have been reversed",
        returnBreakup,
        reversalEffect: "All original entries have been reversed in their respective accounts",
        netEffect: "Balances should return to their pre-order state",
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
      "lines.instanceId": instanceId
    });

    let originalAmount = 0;
    let returnAmount = 0;

    transactions.forEach(transaction => {
      transaction.lines.forEach(line => {
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
      transactionsCount: transactions.length
    });

  } catch (err) {
    console.error("Error getting net balances:", err);
    res.status(500).json({ error: err.message });
  }
};

// Helper: ensures string is always valid
const safeString = (val) => (val ? String(val) : "");

// Get seller orders
export const getSellerOrders = async (req, res) => {
  try {
    const { sellerId } = req.params;
    console.log("📡 API HIT: getSellerOrders with sellerId =", sellerId);

    if (!ObjectId.isValid(sellerId)) {
      console.error("❌ Invalid sellerId:", sellerId);
      return res.status(400).json({ error: "Invalid sellerId" });
    }

    const orders = await Order.find({ seller: sellerId })
      .populate("buyer", "name email")
      .populate("seller", "name email")
      .sort({ placed_at: -1 })
      .lean();

    console.log("✅ Orders fetched:", orders.length);

    res.json({ success: true, count: orders.length, data: orders });
  } catch (err) {
    console.error("❌ Error fetching seller orders:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get seller breakups
export const getOrderBreakups = async (req, res) => {
  try {
    const { sellerId } = req.params;
    console.log("📡 API HIT: getSellerBreakups with sellerId =", sellerId);

    if (!ObjectId.isValid(sellerId)) {
      console.error("❌ Invalid sellerId:", sellerId);
      return res.status(400).json({ error: "Invalid sellerId" });
    }

    const breakups = await BreakupFileModel.find({ sellerId })
      .populate("orderId", "transaction_type order_total_amount status placed_at")
      .populate("buyerId", "name email")
      .populate("sellerId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    console.log("✅ Breakups fetched:", breakups.length);

    res.json({ success: true, count: breakups.length, data: breakups });
  } catch (err) {
    console.error("❌ Error fetching seller breakups:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get Parent Breakup
export const getParentBreakup = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ error: "Order ID is required" });

    const breakup = await BreakupFileModel.findOne({
      orderId,
      breakupType: "parent",
    }).lean();

    if (!breakup) {
      return res.status(404).json({ error: "Parent breakup not found for this order" });
    }

    res.json({
      orderId: breakup.orderId,
      orderType: breakup.orderType,
      orderAmount: breakup.orderAmount,
      actualAmount: breakup.actualAmount,
      buyerId: breakup.buyerId,
      sellerId: breakup.sellerId,
      breakupType: breakup.breakupType,
      lines: breakup.lines || [],
      totalDebit: breakup.totalDebit,
      totalCredit: breakup.totalCredit,
    });
  } catch (err) {
    console.error("❌ Error in getParentBreakup:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get Buyer Breakup
export const getBuyerBreakup = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ error: "Order ID is required" });

    const breakup = await BreakupFileModel.findOne({
      orderId,
      breakupType: "buyer",
    }).lean();

    if (!breakup) {
      return res.status(404).json({ error: "Buyer breakup not found for this order" });
    }

    res.json({
      orderId: breakup.orderId,
      buyerId: breakup.buyerId,
      sellerId: breakup.sellerId,
      breakupType: breakup.breakupType,
      lines: breakup.lines || [],
      totalDebit: breakup.totalDebit,
      totalCredit: breakup.totalCredit,
    });
  } catch (err) {
    console.error("❌ Error in getBuyerBreakup:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get Seller Breakup
export const getSellerBreakup = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ error: "Order ID is required" });

    const breakup = await BreakupFileModel.findOne({
      orderId,
      breakupType: "seller",
    }).lean();

    if (!breakup) {
      return res.status(404).json({ error: "Seller breakup not found for this order" });
    }

    res.json({
      orderId: breakup.orderId,
      buyerId: breakup.buyerId,
      sellerId: breakup.sellerId,
      breakupType: breakup.breakupType,
      lines: breakup.lines || [],
      totalDebit: breakup.totalDebit,
      totalCredit: breakup.totalCredit,
    });
  } catch (err) {
    console.error("❌ Error in getSellerBreakup:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
