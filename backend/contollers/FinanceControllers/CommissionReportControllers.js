// models/FinanceModels/CommissionReport.js
import mongoose from "mongoose";
import TransactionModel from "../../models/FinanceModals/TransactionModel.js";
import ExpenseReport from "../../models/FinanceModals/ExpenseReports.js";
import CommissionReport from "../../models/FinanceModals/CommissionReports.js";
import Rule from "../../models/FinanceModals/TablesModel.js"; // Rules
import SummaryFieldLineInstance from "../../models/FinanceModals/FieldLineInstanceModel.js";

import {computeLineAmount,
  resolveInstanceForEntry,
  resolveSummaryIdForEntry,
  resolveDefinitionIdForEntry,
  buildLine,
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
  meta = {} // optional: { commissionReportId, periodKey }
}) {
  const rules = await Rule.find({ transactionType }).lean().session(session);
  if (!rules.length) {
    throw new Error(`No rules found for transaction type: ${transactionType}`);
  }

  let revenueAmount = 0;
  const createdTransactionIds = [];

  for (const rule of rules) {
    const lines = [];
    const splits = rule.splits || [];

    const totalPercent =
      splits.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0) || 100;

    for (const split of splits) {
      const splitAmount = computeLineAmount(
        split,
        baseAmount,
        rule.incrementType,
        totalPercent
      );

      if (!splitAmount || splitAmount <= 0) continue;

      const instanceId = await resolveInstanceForEntry(split, session);
      const summaryId = await resolveSummaryIdForEntry(split, session);
      const definitionId = await resolveDefinitionIdForEntry(split, session);

      if (!instanceId || !summaryId || !definitionId) continue;

      lines.push(buildLine({
        instanceId,
        summaryId,
        definitionId,
        debitOrCredit: split.debitOrCredit,
        amount: splitAmount,
        description: split.fieldName,
        isReflection: !!split.isReflection
      }));

      // 🔑 Revenue detection (VERY IMPORTANT)
      if (split.isRevenue && split.debitOrCredit === "credit") {
        revenueAmount += splitAmount;
      }

      // Mirrors
      if (Array.isArray(split.mirrors)) {
        for (const mirror of split.mirrors) {
          const mi = await resolveInstanceForEntry(mirror, session);
          const ms = await resolveSummaryIdForEntry(mirror, session);
          const md = await resolveDefinitionIdForEntry(mirror, session);

          if (!mi || !ms || !md) continue;

          lines.push(buildLine({
            instanceId: mi,
            summaryId: ms,
            definitionId: md,
            debitOrCredit: mirror.debitOrCredit,
            amount: splitAmount,
            description: mirror.fieldName || `${split.fieldName} Mirror`,
            isReflection: !!mirror.isReflection
          }));
        }
      }
    }

    if (!lines.length) continue;

    /* ===============================
       CREATE JOURNAL TRANSACTION
    ================================ */
    const [tx] = await TransactionModel.create([{
      type: "journal",
      description: `Rule Applied: ${transactionType}`,
      amount: decimal(baseAmount),
      lines,
      ...meta
    }], { session });

    createdTransactionIds.push(tx._id);

    /* ===============================
       APPLY BALANCES (SUMMARIES)
    ================================ */
    const bulkOps = lines.map(line => ({
      updateOne: {
        filter: { _id: line.instanceId },
        update: {
          $inc: {
            [`balances.${line.debitOrCredit}`]:
              Number(line.amount.toString())
          }
        }
      }
    }));

    await SummaryFieldLineInstance.bulkWrite(bulkOps, { session });
  }

  return {
    revenueAmount,
    transactionIds: createdTransactionIds
  };
};

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

  console.log("INSIDE CONTROLLER");

  /* ================================
     SAFETY: Cycle already closed?
  ================================= */
  const alreadyClosed = await CommissionReport.findOne({
    periodKey,
    status: "settled"
  });

  if (alreadyClosed) {
    return res.status(409).json({ error: "Commission cycle already settled" });
  }

  /* ================================
     STAGE A — COMMISSION REVENUE
  ================================= */
  let commissionAmount = 0;
  let commissionTxIds = [];
  let commissionReport;

  const sessionA = await mongoose.startSession();
  await sessionA.withTransaction(async () => {

    // const prodFilter = {
    //   type: "journal",
    //   "orderDetails.orderDeliveredAt": { $gte: fromDate, $lte: toDate },
    //   "orderDetails.expiryReached": true,               // only include expired
    //   "orderDetails.readyForRetainedEarning": false     // only include not yet ready
    // };

    // const eligibleOrders = await TransactionModel.find(prodFilter);
    // if (!eligibleOrders.length) {
    //   throw new Error("No eligible orders found for commission closing");
    // }

    // console.log("Eligible orders:", eligibleOrders.length);
      
    const testFilter = {
      type: "journal",
      "orderDetails.orderDeliveredAt": { $gte: fromDate, $lte: toDate },
      // skip the strict flags for testing
      // "orderDetails.expiryReached": true,
      // "orderDetails.readyForRetainedEarning": false
    };

    const orders = await TransactionModel.find(testFilter);
    console.log("Testing fetched orders:", orders.length);

    commissionTxIds = orders.map(t => t._id);

    const baseAmount = orders.reduce(
      (s, t) => s + Number(t.commissionAmount || 0),
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
      status: "locked"
    }], { session: sessionA });
  });

  sessionA.endSession();

  /* ================================
     STAGE B — EXPENSE AGGREGATION
  ================================= */
//   const prodExpenseFilter = {
//   status: "calculated",   // only include reports not yet paid
//   fromDate: { $gte: fromDate },
//   toDate: { $lte: toDate }
// };

// const eligibleExpenseReports = await ExpenseReport.find(prodExpenseFilter).lean();

// if (!eligibleExpenseReports.length) {
//   throw new Error("No eligible expense reports found for the period");
// }

// console.log("Eligible expense reports:", eligibleExpenseReports.length);

 const testExpenseFilter = {
  status: "calculated",   // only include reports that are not yet paid
  fromDate: { $gte: fromDate }, 
  toDate: { $lte: toDate }
};

const expenseReports = await ExpenseReport.find(testExpenseFilter).lean();
console.log("Testing fetched expense reports:", expenseReports.length);

  const expenseAmount = expenseReports.reduce(
    (s, r) => s + Number(r.totalAmount),
    0
  );

  const net = commissionAmount - expenseAmount;

  /* ================================
     STAGE C — NET SETTLEMENT
  ================================= */
  const sessionC = await mongoose.startSession();
  await sessionC.withTransaction(async () => {

    if (net !== 0) {
      await applyRulesEngine({
        transactionType: "COMMISSION_SETTLEMENT",
        baseAmount: Math.abs(net),
        session: sessionC
      });

      const capitalRuleType = net > 0 ? "Profit" : "Loss";

      const capitalRule = await Rule.findOne({ transactionType: capitalRuleType }).lean();
      if (!capitalRule) throw new Error(`${capitalRuleType} rule not found`);

      await applyRulesEngine({
        transactionType: capitalRuleType,
        baseAmount: Math.abs(net),
        session: sessionC
      });
    }

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
  });

  sessionC.endSession();

  /* ================================
     STAGE D — FINAL FLAGS
  ================================= */
  const sessionD = await mongoose.startSession();
  await sessionD.withTransaction(async () => {

    // Update expense reports
    await ExpenseReport.updateMany(
      { _id: { $in: expenseReports.map(r => r._id) } },
      {
        status: "paid",
        paidAt: new Date(),
        linkedCommissionReport: commissionReport._id
      },
      { session: sessionD }
    );

    // Update transactions linked to expense reports
    await TransactionModel.updateMany(
      { _id: { $in: expenseReports.flatMap(r => r.transactionIds) } },
      {
        $set: {
          "expenseDetails.isPaid": true,
          "expenseDetails.isPaidAt": new Date(),
          "expenseDetails.paidPeriodKey": periodKey
        }
      },
      { session: sessionD }
    );

    // Mark orders as processed for commission
    await TransactionModel.updateMany(
      { _id: { $in: commissionTxIds } },
      { $set: { commissionReportId: commissionReport._id } },
      { session: sessionD }
    );
  });

  sessionD.endSession();

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

// -----------------------------------------------------------------------------------------
// export const closeCommissionPeriodController = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const {
//       fromDate,
//       toDate,
//       expenseReportIds = [],
//       confirmCapitalUsage = false
//     } = req.body;

//     const periodKey = `${fromDate}_${toDate}`;

//     /* --------------------------------------------------
//        1️⃣ FETCH ELIGIBLE COMMISSION TRANSACTIONS
//        -------------------------------------------------- */
//     const commissionTxs = await TransactionModel.find({
//       "orderDetails.returnWindowExpired": true,
//       "orderDetails.commissionClosed": false,
//       date: { $gte: new Date(fromDate), $lte: new Date(toDate) }
//     }).session(session);

//     if (!commissionTxs.length) {
//       throw new Error("No eligible commission transactions found");
//     }

//     /* --------------------------------------------------
//        2️⃣ APPLY COMMISSION CLEARANCE RULE
//        -------------------------------------------------- */
//     const {
//       revenueAmount: commissionRevenue
//     } = await applyRulesEngine({
//       transactionType: "CommissionClearance",
//       baseAmount: commissionTxs.length, // or computed commission base
//       session
//     });

//     if (!commissionRevenue || commissionRevenue <= 0) {
//       throw new Error("Commission revenue evaluated to zero");
//     }

//     /* --------------------------------------------------
//        3️⃣ FETCH & PAY EXPENSE REPORTS
//        -------------------------------------------------- */
//     let expenseAmount = 0;

//     const expenseReports = await ExpenseReport.find({
//       _id: { $in: expenseReportIds },
//       status: "calculated"
//     }).session(session);

//     for (const report of expenseReports) {
//       expenseAmount += Number(report.totalAmount.toString());

//       await ExpenseReport.updateOne(
//         { _id: report._id },
//         {
//           $set: {
//             status: "paid",
//             paidAt: new Date(),
//             linkedCommissionPeriod: periodKey
//           }
//         },
//         { session }
//       );

//       await TransactionModel.updateMany(
//         { _id: { $in: report.transactionIds } },
//         {
//           $set: {
//             "expenseDetails.isCleared": true,
//             "expenseDetails.clearedAt": new Date(),
//             "expenseDetails.clearedPeriodKey": periodKey
//           }
//         },
//         { session }
//       );
//     }

//     /* --------------------------------------------------
//        4️⃣ NET RESULT
//        -------------------------------------------------- */
//     const netResult = commissionRevenue - expenseAmount;

//     if (netResult < 0 && !confirmCapitalUsage) {
//       throw new Error("Loss detected. Capital usage confirmation required.");
//     }

//     /* --------------------------------------------------
//        5️⃣ APPLY FINAL PROFIT / LOSS RULES
//        -------------------------------------------------- */
//     if (netResult > 0) {
//       await applyRulesEngine({
//         transactionType: "CommissionIncomeToCapital",
//         baseAmount: netResult,
//         session
//       });
//     }

//     if (netResult < 0) {
//       await applyRulesEngine({
//         transactionType: "CapitalToCommissionLoss",
//         baseAmount: Math.abs(netResult),
//         session
//       });
//     }

//     /* --------------------------------------------------
//        6️⃣ CREATE COMMISSION REPORT (DERIVED)
//        -------------------------------------------------- */
//     const [commissionReport] = await CommissionReport.create([{
//       periodKey,
//       fromDate,
//       toDate,
//       commissionRevenue,
//       expenseAmount,
//       netResult,
//       resultType:
//         netResult > 0 ? "profit" :
//         netResult < 0 ? "loss" :
//         "breakeven",
//       status: "settled",
//       settledAt: new Date(),
//       commissionTransactionIds: commissionTxs.map(t => t._id)
//     }], { session });

//     /* --------------------------------------------------
//        7️⃣ LOCK COMMISSION TRANSACTIONS
//        -------------------------------------------------- */
//     await TransactionModel.updateMany(
//       { _id: { $in: commissionTxs.map(t => t._id) } },
//       {
//         $set: {
//           "orderDetails.commissionClosed": true,
//           "orderDetails.commissionClosedAt": new Date(),
//           "orderDetails.commissionPeriodKey": periodKey,
//           "orderDetails.commissionReportId": commissionReport._id
//         }
//       },
//       { session }
//     );

//     await session.commitTransaction();
//     session.endSession();

//     return res.json({
//       message: "Commission period closed successfully",
//       commissionReportId: commissionReport._id,
//       commissionRevenue,
//       expenseAmount,
//       netResult
//     });

//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     return res.status(500).json({ error: error.message });
//   }
// };