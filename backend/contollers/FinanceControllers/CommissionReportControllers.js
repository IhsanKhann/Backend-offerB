// models/FinanceModels/CommissionReport.js
import mongoose from "mongoose";
import TransactionModel from "../../models/FinanceModals/TransactionModel.js";
import ExpenseReport from "../../models/FinanceModals/ExpenseReports.js";
import CommissionReport from "../../models/FinanceModals/CommissionReports.js";
import Rule from "../../models/FinanceModals/TablesModel.js"; // Rules
import SummaryFieldLineInstance from "../../models/FinanceModals/FieldLineInstanceModel.js";

import {
  computeLineAmount,
  resolveInstanceForEntry,
  resolveSummaryIdForEntry,
  resolveDefinitionIdForEntry,
  buildLine,
  applyBalanceChange,
} from "../../contollers/FinanceControllers/TransactionController.js";
// ------------------------------ HELPER FUNCTIONS ------------------------------------

const decimal = (v) =>
  mongoose.Types.Decimal128.fromString(Number(v).toFixed(2));

const getResultType = (net) =>
  net > 0 ? "profit" : net < 0 ? "loss" : "breakeven";

export async function applyRulesEngine({
  transactionType,
  baseAmount,
  session,
  meta = {}
}) {
  console.log(`\n🧠 APPLY RULES ENGINE → ${transactionType}`);
  console.log("Base Amount:", baseAmount);

  const rules = await Rule.find({ transactionType }).session(session).lean();

  if (!rules.length) {
    throw new Error(`❌ No rules found for ${transactionType}`);
  }

  let revenueAmount = 0;
  const createdTransactionIds = [];

  for (const rule of rules) {
    console.log(`\n📘 Rule: ${rule._id}`);
    const splits = rule.splits || [];
    const lines = [];

    const totalPercent =
      splits.reduce((s, sp) => s + (Number(sp.percentage) || 0), 0) || 100;

    for (const split of splits) {
      console.log("\n➡️ Processing split:", split.fieldName);

      const splitAmount = computeLineAmount(
        split,
        baseAmount,
        rule.incrementType,
        totalPercent
      );

      console.log("Computed amount:", splitAmount);

      if (!splitAmount || splitAmount <= 0) {
        console.log("⏭️ Skipped (amount <= 0)");
        continue;
      }

      const instanceId = await resolveInstanceForEntry(split, session);
      const summaryId = await resolveSummaryIdForEntry(split, session);
      const definitionId = await resolveDefinitionIdForEntry(split, session);

      console.log("Resolved IDs:", {
        instanceId,
        summaryId,
        definitionId
      });

      if (!instanceId || !summaryId || !definitionId) {
        console.log("❌ Split skipped due to unresolved IDs");
        continue;
      }

      lines.push(buildLine({
        instanceId,
        summaryId,
        definitionId,
        debitOrCredit: split.debitOrCredit,
        amount: splitAmount,
        description: split.fieldName,
        isReflection: !!split.isReflection
      }));

      if (split.isRevenue && split.debitOrCredit === "credit") {
        revenueAmount += splitAmount;
        console.log("💰 Revenue detected:", splitAmount);
      }

      if (Array.isArray(split.mirrors)) {
        for (const mirror of split.mirrors) {
          console.log("↪️ Mirror split");

          const mi = await resolveInstanceForEntry(mirror, session);
          const ms = await resolveSummaryIdForEntry(mirror, session);
          const md = await resolveDefinitionIdForEntry(mirror, session);

          console.log("Mirror IDs:", { mi, ms, md });

          if (!mi || !ms || !md) {
            console.log("❌ Mirror skipped (IDs unresolved)");
            continue;
          }

          lines.push(buildLine({
            instanceId: mi,
            summaryId: ms,
            definitionId: md,
            debitOrCredit: mirror.debitOrCredit,
            amount: splitAmount,
            description: mirror.fieldName || "Mirror",
            isReflection: !!mirror.isReflection
          }));
        }
      }
    }

    if (!lines.length) {
      console.log("⚠️ No lines generated for this rule");
      continue;
    }

    const [tx] = await TransactionModel.create([{
      type: "journal",
      description: `Rule Applied: ${transactionType}`,
      amount: decimal(baseAmount),
      lines,
      ...meta
    }], { session });

    console.log("✅ Transaction created:", tx._id);

    createdTransactionIds.push(tx._id);
    console.log("\nApplying Balance Changes (Rules Engine)...");

    for (const line of lines) {
      console.log("Applying Balance:", {
        instanceId: line.instanceId,
        summaryId: line.summaryId,
        debitOrCredit: line.debitOrCredit,
        amount: Number(line.amount),
        isReflection: line.isReflection
      });

      await applyBalanceChange({
        instanceId: line.instanceId,
        summaryId: line.summaryId,
        debitOrCredit: line.debitOrCredit,
        amount: Number(line.amount)
      }, session);
    }
  }

  console.log("🏁 Rules engine completed");
  console.log("Total revenue:", revenueAmount);

  return {
    revenueAmount,
    transactionIds: createdTransactionIds
  };
}

/* ---------- Helper functions ---------- */
async function updateExpenseFlags({ expenseTxs, expenseReportId, periodKey, session }) {
  if (!expenseTxs.length) return;
  await TransactionModel.updateMany(
    { _id: { $in: expenseTxs } },
    {
      $set: {
        "expenseDetails.isReported": true,
        "expenseDetails.isPaid": true,
        "expenseDetails.isPaidAt": new Date(),
        "expenseDetails.paidPeriodKey": periodKey
      }
    },
    { session }
  );

  await ExpenseReport.findByIdAndUpdate(
    expenseReportId,
    { status: "paid", paidAt: new Date() },
    { session }
  );
}

async function finalizeCommissionReport({ reportId, net, commissionTxIds, session }) {
  await CommissionReport.findByIdAndUpdate(
    reportId,
    {
      status: "locked",
      settledAt: new Date(),
      commissionTransactionIds: commissionTxIds,
      capitalImpactAmount: decimal(Math.abs(net))
    },
    { session }
  );

  if (commissionTxIds.length) {
    await TransactionModel.updateMany(
      { _id: { $in: commissionTxIds } },
      { $set: { commissionReportId: reportId } },
      { session }
    );
  }
}

async function applyPunchToCapital({ netAmount, reportId }) {
  const ruleType = netAmount >= 0 ? "Profit" : "Loss";
  const rule = await RuleModel.findOne({ transactionType: ruleType, isActive: true });
  if (!rule) throw new Error(`${ruleType} rule not found`);

  const absAmount = Math.abs(netAmount);
  const lines = rule.splits.map(split => ({
    debitOrCredit: split.debitOrCredit,
    amount: decimal(absAmount),
    description: `${ruleType} Punch`,
    isReflection: false
  }));

  return TransactionModel.create({
    type: "journal",
    description: `${ruleType} Punch To Capital`,
    amount: decimal(absAmount),
    lines,
    commissionReportId: reportId
  });
}

/* ---------- Controllers ---------- */
export const closeCommissionPeriodController = async (req, res) => {
  const { periodKey, fromDate, toDate } = req.body;
  const userId = req.user._id;

  /* ===============================
     SAFETY — already settled?
  =============================== */
  const alreadyClosed = await CommissionReport.findOne({
    periodKey,
    status: "settled"
  });

  if (alreadyClosed) {
    return res.status(409).json({ error: "Commission cycle already settled" });
  }

  let commissionAmount = 0;
  let commissionTxIds = [];
  let commissionReport;
  let expenseReports = [];
  let expenseTxIds = [];

  /* ===============================
     STAGE A — COMMISSION REVENUE
  =============================== */
  const sessionA = await mongoose.startSession();
  await sessionA.withTransaction(async () => {

    const orderFilter = {
      type: "journal",
      "orderDetails.orderDeliveredAt": { $gte: fromDate, $lte: toDate },
      "orderDetails.readyForRetainedEarning": false,
      // enable later in prod
      // "orderDetails.expiryReached": true,
    };

    const orders = await TransactionModel.find(orderFilter).session(sessionA);
    if (!orders.length) throw new Error("No eligible orders");

    commissionTxIds = orders.map(o => o._id);

    const baseAmount = orders.reduce(
      (sum, t) => sum + Number(t.commissionAmount || 0),
      0
    );

    const { revenueAmount } = await applyRulesEngine({
      transactionType: "COMMISSION_REVENUE",
      baseAmount,
      session: sessionA
    });

    commissionAmount = revenueAmount;

    [commissionReport] = await CommissionReport.create([{
      periodKey,
      fromDate,
      toDate,
      commissionAmount: decimal(commissionAmount),
      status: "locked",
      closedBy: userId,
      closedAt: new Date()
    }], { session: sessionA });
  });
  sessionA.endSession();

  /* ===============================
     STAGE B — EXPENSE P&L (OPTIONAL)
  =============================== */
  expenseReports = await ExpenseReport.find({
    status: "calculated",
    fromDate: { $gte: fromDate },
    toDate: { $lte: toDate }
  }).lean();

  if (expenseReports.length) {
    expenseTxIds = expenseReports.flatMap(r => r.transactionIds || []);
  }

  const expenseAmount = expenseReports.reduce(
    (sum, r) => sum + Number(r.totalAmount || 0),
    0
  );

  const net = commissionAmount - expenseAmount;

  /* ===============================
     STAGE C — SETTLEMENT
  =============================== */
  const sessionC = await mongoose.startSession();
  await sessionC.withTransaction(async () => {

    /* ---- P&L Settlement ---- */
    if (net !== 0) {
      await applyRulesEngine({
        transactionType: "COMMISSION_SETTLEMENT",
        baseAmount: Math.abs(net),
        session: sessionC
      });

      await applyRulesEngine({
        transactionType: net > 0 ? "Profit" : "Loss",
        baseAmount: Math.abs(net),
        session: sessionC
      });
    }

    /* ---- Commission Report ---- */
    await CommissionReport.findByIdAndUpdate(
      commissionReport._id,
      {
        expenseAmount: decimal(expenseAmount),
        netResult: decimal(net),
        resultType: getResultType(net),
        capitalImpactAmount: decimal(Math.abs(net)),
        status: "settled",
        settledAt: new Date(),
        commissionTransactionIds: commissionTxIds
      },
      { session: sessionC }
    );

    /* ===============================
       UPDATE COMMISSION TRANSACTIONS
       (ALWAYS)
    =============================== */
    await TransactionModel.updateMany(
      { _id: { $in: commissionTxIds } },
      {
        $set: {
          "orderDetails.readyForRetainedEarning": true,
          "orderDetails.retainedLocked": true,
          "orderDetails.retainedLockedAt": new Date(),
          "orderDetails.isReported": true,
          commissionReportId: commissionReport._id
        }
      },
      { session: sessionC }
    );

    /* ===============================
       UPDATE EXPENSE TRANSACTIONS
       (ONLY IF EXPENSES EXIST)
    =============================== */
    if (expenseTxIds.length) {
      await TransactionModel.updateMany(
        { _id: { $in: expenseTxIds } },
        {
          $set: {
            "expenseDetails.isReported": true,
            "expenseDetails.includedInPnL": true,
            "expenseDetails.isPaid": false,       // NOT cash-paid here
            "expenseDetails.paidPeriodKey": periodKey
          }
        },
        { session: sessionC }
      );

      await ExpenseReport.updateMany(
        { _id: { $in: expenseReports.map(r => r._id) } },
        {
          status: "paid",
          paidAt: new Date()
        },
        { session: sessionC }
      );
    }
  });
  sessionC.endSession();

  return res.json({
    reportId: commissionReport._id,
    commissionAmount,
    expenseAmount,
    net,
    resultType: getResultType(net)
  });
};


export const closeCommissionByDateRange = async (req, res) => {
  const { fromDate, toDate, expenseIds = [], periodKey } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const commissionTxs = await TransactionModel.find(
      { date: { $gte: fromDate, $lte: toDate } },
      { _id: 1, commissionAmount: 1 }
    ).lean().session(session);

    const expenseTxs = await TransactionModel.find(
      { _id: { $in: expenseIds } },
      { _id: 1, amount: 1 }
    ).lean().session(session);

    const commissionAmount = commissionTxs.reduce((s,t)=>s+Number(t.commissionAmount||0),0);
    const expenseAmount = expenseTxs.reduce((s,t)=>s+Number(t.amount||0),0);
    const net = calcNet(commissionAmount, expenseAmount);

    const [expenseReport] = await ExpenseReport.create([{
      periodKey,
      fromDate, toDate,
      totalAmount: decimal(expenseAmount),
      transactionIds: expenseIds
    }], { session });

    const [commissionReport] = await CommissionReport.create([{
      periodKey,
      fromDate, toDate,
      commissionAmount: decimal(commissionAmount),
      expenseAmount: decimal(expenseAmount),
      netResult: decimal(net),
      resultType: getReportStatus(net)
    }], { session });

    await updateExpenseFlags({ expenseTxs: expenseIds, expenseReportId: expenseReport._id, periodKey, session });
    
    // apply rules on the expanses..
    await applyRulesEngine({
      transactionType: "EXPENSE_PAY_LATER",
      baseAmount: expenseAmount,
      session,
      meta: {
        periodKey,
        commissionReportId: commissionReport._id
      }
    });

    await applyPunchToCapital({ netAmount: net, reportId: commissionReport._id });
    await finalizeCommissionReport({ reportId: commissionReport._id, net, commissionTxIds: commissionTxs.map(t => t._id), session });

    await session.commitTransaction();
    res.json({ reportId: commissionReport._id, commissionAmount, expenseAmount, net });

  } catch(e) {
    await session.abortTransaction();
    res.status(500).json({ error: e.message });
  } finally { session.endSession(); }
};

export const closeCommissionOnly = async (req, res) => {
  const { fromDate, toDate, periodKey } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const commissionTxs = await TransactionModel.find(
      { date: { $gte: fromDate, $lte: toDate } },
      { _id: 1, commissionAmount: 1 }
    ).lean().session(session);

    const commissionAmount = commissionTxs.reduce((s,t)=>s+Number(t.commissionAmount||0),0);
    const net = commissionAmount;

    const [commissionReport] = await CommissionReport.create([{
      periodKey,
      fromDate, toDate,
      commissionAmount: decimal(commissionAmount),
      expenseAmount: decimal(0),
      netResult: decimal(net),
      resultType: getReportStatus(net)
    }], { session });

    await applyPunchToCapital({ netAmount: net, reportId: commissionReport._id });
    await finalizeCommissionReport({ reportId: commissionReport._id, net, commissionTxIds: commissionTxs.map(t => t._id), session });

    await session.commitTransaction();
    res.json({ reportId: commissionReport._id, commissionAmount, expenseAmount: 0, net });

  } catch(e) {
    await session.abortTransaction();
    res.status(500).json({ error: e.message });
  } finally { session.endSession(); }
};

export const fetchCommissionReportsController = async (req, res) => {
  try {
    const { status } = req.query;

    if (!["locked", "settled"].includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Use locked or settled."
      });
    }

    const reports = await CommissionReport.find({ status })
      .sort({ createdAt: -1 });

    res.json({
      count: reports.length,
      reports
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3️⃣ FETCH COMMISSION TRANSACTIONS BY FLAGS
export const fetchCommissionTransactionsController = async (req, res) => {
  try {
    const {
      expiryReached,
      readyForRetainedEarning,
      retainedLocked
    } = req.query;

    const query = {};

    if (expiryReached !== undefined) {
      query["orderDetails.expiryReached"] = expiryReached === "true";
    }

    if (readyForRetainedEarning !== undefined) {
      query["orderDetails.readyForRetainedEarning"] =
        readyForRetainedEarning === "true";
    }

    if (retainedLocked !== undefined) {
      query["orderDetails.retainedLocked"] =
        retainedLocked === "true";
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1 });

    res.json({
      count: transactions.length,
      transactions
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// group the transactions based on Months: into 3 categories
export const groupCommissionTransactionsByMonthController = async (req, res) => {
  try {
    console.log("🚀 [Commission] Group by month controller triggered");

    // Fetch all journal transactions sorted by date ascending
    const transactions = await TransactionModel.find({ type: "journal" }).sort({ date: 1 });

    const grouped = {};

    transactions.forEach(txn => {
      const monthKey = txn.date.toISOString().slice(0, 7); // YYYY-MM

      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          readyForCommission: [],
          waitingForReturn: [],
          settled: []
        };
      }

      const isSettled = txn.orderDetails?.isReported;
      const isReturnExpired = txn.orderDetails?.expiryReached;

      if (isSettled) {
        grouped[monthKey].settled.push(txn);
      } else if (isReturnExpired) {
        grouped[monthKey].readyForCommission.push(txn);
      } else {
        grouped[monthKey].waitingForReturn.push(txn);
      }
    });

    // Convert grouped object to array for easier UI consumption
    const result = Object.entries(grouped).map(([month, data]) => ({
      month,
      ...data
    }));

    console.log("📦 Commission transactions grouped by month");

    return res.status(200).json({ months: result });

  } catch (error) {
    console.error("🔥 ERROR in groupCommissionTransactionsByMonthController:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const fetchCommissionTransactionsByStatusController = async (req, res) => {
  try {
    const transactions = await TransactionModel.find({
      type: "journal",
      orderDetails: { $exists: true }
    }).sort({ date: 1 });

    const readyForCommission = [];
    const waitingForReturn = [];
    const settled = [];

    transactions.forEach(tx => {
      const expiryReached = tx.orderDetails?.expiryReached;
      const hasReport = tx.expenseDetails?.includedInPnL;

      if (hasReport) {
        settled.push(tx);
      } else if (expiryReached) {
        readyForCommission.push(tx);
      } else {
        waitingForReturn.push(tx);
      }
    });

    return res.json({
      readyForCommission,
      waitingForReturn,
      settled
    });

  } catch (error) {
    console.error("❌ fetchCommissionTransactionsByStatusController", error);
    res.status(500).json({ error: error.message });
  }
};

export const fetchCommissionReportsByStatusController = async (req, res) => {
  try {
    const locked = await CommissionReport.find({ status: "locked" }).sort({ createdAt: -1 });
    const settled = await CommissionReport.find({ status: "settled" }).sort({ settledAt: -1 });

    return res.json({
      locked,
      settled
    });

  } catch (error) {
    console.error("❌ fetchCommissionReportsByStatusController", error);
    res.status(500).json({ error: error.message });
  }
};

