import mongoose from "mongoose";
import Transaction from "../../models/FinanceModals/TransactionModel.js";
import ExpenseReport from "../../models/FinanceModals/ExpenseReports.js";
import Cycle from "../../models/BussinessOperationModals/cyclesModel.js";
import Rule from "../../models/FinanceModals/TablesModel.js";

import {
  computeLineAmount,
  resolveInstanceForEntry,
  resolveSummaryIdForEntry,
  resolveDefinitionIdForEntry,
  buildLine,
  applyBalanceChange,
} from "../../contollers/FinanceControllers/TransactionController.js";

/* ---------- Helper: mark expenses as PAID (cash flow) ---------- */
async function updateExpenseFlags({
  expenseTxIds,
  expenseReportIds = [],
  periodKey,
  paidBy,
  session
}) {
  if (!expenseTxIds?.length) return;

  await Transaction.updateMany(
    { _id: { $in: expenseTxIds } },
    {
      $set: {
        "expenseDetails.isPaid": true,
        "expenseDetails.isPaidAt": new Date(),
        "expenseDetails.paidPeriodKey": periodKey,
        "expenseDetails.paidBy": paidBy
      }
    },
    { session }
  );

  if (expenseReportIds.length) {
    await ExpenseReport.updateMany(
      { _id: { $in: expenseReportIds } },
      {
        status: "paid",
        paidAt: new Date()
      },
      { session }
    );
  }
}

// actually pay the reports using cash: cyclic
export const payExpensePeriodController = async (req, res) => {

  console.log("Inside PayExpensePeriodController..");

  const paidBy = req.user._id;
  const {
    fromDate,toDate,periodKey
  } = req.body;

  /* ===============================
     FETCH UNPAID EXPENSE TXS
  =============================== */
  const expenseTxs = await Transaction.find({
    type: "expense",
    "expenseDetails.isPaid": false,
    date: { $gte: fromDate, $lte: toDate }
  });

  if (!expenseTxs.length) {
    return res.json({ message: "No unpaid expenses found" });
  }

  const baseAmount = expenseTxs.reduce(
    (s, t) => s + Number(t.amount),
    0
  );

  /* ===============================
     FETCH RULE
  =============================== */
  const rule = await Rule.findOne({ transactionType: "EXPENSE_PAY_LATER" }).lean();
  if (!rule) throw new Error("EXPENSE_PAY_LATER rule missing");

  const session = await mongoose.startSession();
  await session.withTransaction(async () => {

    const tx = new Transaction({
      type: "journal",
      transactionType: "EXPENSE_PAY_LATER",
      amount: baseAmount,
      createdBy: paidBy,
      lines: []
    });

    const totalPercent = rule.splits.reduce(
      (s, sp) => s + Number(sp.percentage || 0),
      0
    );

    /* ===============================
       BUILD LINES USING HELPERS
    =============================== */
    for (const split of rule.splits) {
      const amount = computeLineAmount(
        split,
        baseAmount,
        rule.incrementType,
        totalPercent
      );

      if (!amount) continue;

      const instanceId = await resolveInstanceForEntry(split, session);
      const summaryId = await resolveSummaryIdForEntry(
        { instanceId },
        session
      );
      const definitionId = await resolveDefinitionIdForEntry(split, session);

      const line = buildLine({
        instanceId,
        summaryId,
        definitionId,
        debitOrCredit: split.debitOrCredit,
        amount,
        description: split.fieldName,
        isReflection: split.isReflection
      });

      tx.lines.push(line);

      await applyBalanceChange(
        {
          instanceId,
          summaryId,
          debitOrCredit: split.debitOrCredit,
          amount
        },
        session
      );

      /* ---------- MIRRORS ---------- */
      for (const mirror of split.mirrors || []) {
        const mInst = await resolveInstanceForEntry(mirror, session);
        const mSum = await resolveSummaryIdForEntry(
          { instanceId: mInst },
          session
        );
        const mDef = await resolveDefinitionIdForEntry(mirror, session);

        const mirrorLine = buildLine({
          instanceId: mInst,
          summaryId: mSum,
          definitionId: mDef,
          debitOrCredit: mirror.debitOrCredit,
          amount,
          description: `${split.fieldName} mirror`,
          isReflection: mirror.isReflection
        });

        tx.lines.push(mirrorLine);

        await applyBalanceChange(
          {
            instanceId: mInst,
            summaryId: mSum,
            debitOrCredit: mirror.debitOrCredit,
            amount
          },
          session
        );
      }
    }

    await tx.save({ session });

    /* ===============================
       UPDATE FLAGS
    =============================== */
    const expenseReportIds = await ExpenseReport.distinct("_id", {
      transactionIds: { $in: expenseTxs.map(t => t._id) }
    });

    await updateExpenseFlags({
      expenseTxIds: expenseTxs.map(t => t._id),
      expenseReportIds,
      periodKey,
      paidBy,
      session
    });
  });

  console.log("Expenses Paid. End of Report");
  session.endSession();

  res.json({
    paidTransactions: expenseTxs.length,
    totalPaid: baseAmount
  });
};

// Method:1 of the report generating: cyclic/periodic
export const generateExpenseReportByCycle = async (req, res) => {
  console.log("==============================================");
  console.log("🚀 [ExpenseReport] Controller triggered");
  console.log("📥 Request body:", req.body);

  try {
    const { cycleId } = req.body;

    if (!cycleId) {
      console.log("❌ cycleId missing in request");
      return res.status(400).json({ message: "cycleId is required" });
    }

    /* ======================================================
     * 1️⃣ FETCH CYCLE
     * ====================================================== */
    const cycle = await Cycle.findById(cycleId);
    if (!cycle) {
      console.log("❌ Cycle not found");
      return res.status(404).json({ message: "Cycle not found." });
    }
    console.log("✅ Cycle found:", { name: cycle.name, startDate: cycle.startDate, endDate: cycle.endDate });

    /* ======================================================
     * 2️⃣ FETCH UNREPORTED TRANSACTIONS
     * ====================================================== */
    const transactions = await Transaction.find({
      type: "expense",
      "expenseDetails.includedInPnL": false,
      date: { $gte: cycle.startDate, $lte: cycle.endDate }
    });

    console.log(`📦 Unreported transactions found: ${transactions.length}`);

    if (transactions.length === 0) {
      console.log("ℹ️ No new unreported expense transactions in this cycle");
      return res.status(200).json({
        message: "No new transactions found for this cycle.",
        cycle
      });
    }

    /* ======================================================
     * 3️⃣ CALCULATE TOTAL AMOUNT
     * ====================================================== */
    let totalAmount = 0;
    transactions.forEach((txn, index) => {
      const amount = parseFloat(txn.amount.toString());
      totalAmount += amount;
      if (index < 5) console.log(`   ↳ txn[${index}] amount = ${amount}`);
    });
    console.log("💰 Total Expense Amount:", totalAmount);

    /* ======================================================
     * 4️⃣ CREATE NEW EXPENSE REPORT
     * ====================================================== */
    const fromStr = cycle.startDate.toISOString().split("T")[0];
    const toStr = cycle.endDate.toISOString().split("T")[0];
    const periodKey = `${fromStr}_${toStr}_${Date.now()}`; // unique key for every report

    const newReport = await ExpenseReport.create({
      periodKey,
      fromStr: cycle.startDate,
      toStr: cycle.endDate,
      totalAmount,
      transactionIds: transactions.map(txn => txn._id),
      status: "calculated"
    });

    console.log("✅ ExpenseReport created:", newReport._id.toString());

    /* ======================================================
     * 5️⃣ MARK TRANSACTIONS AS REPORTED
     * ====================================================== */
    // const updateResult = await Transaction.updateMany(
    //   { _id: { $in: transactions.map(txn => txn._id) }, "expenseDetails.isReported": false },
    //   { $set: { "expenseDetails.isReported": true } }
    // );

    // console.log(`✅ Transactions updated (marked reported): ${updateResult.modifiedCount}`);

    console.log("🎉 Expense report generation completed successfully");
    console.log("==============================================");

    return res.status(201).json({
      message: "Expense report generated successfully.",
      report: newReport,
      transactionsCount: transactions.length
    });

  } catch (error) {
    console.error("🔥 ERROR in generateExpenseReportByCycle");
    console.error(error);
    console.log("==============================================");
    return res.status(500).json({
      message: "Server error while generating expense report.",
      error: error.message
    });
  }
};

// Method-2: Generate report by selected months
export const generateExpenseReportByMonthsController = async (req, res) => {
  try {
      console.log("📥 Request body:", req.body);

        const { months } = req.body || {}; // fallback to {}
        if (!months || !months.length) {
            return res.status(400).json({ message: "months array is required in request body" });
        }

    console.log("📥 Months received:", months);

    // Build date ranges for the selected months
    const monthRanges = months.map(m => {
      const startDate = new Date(`${m}-01T00:00:00.000Z`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setMilliseconds(endDate.getMilliseconds() - 1);
      return { month: m, startDate, endDate };
    });

    // Fetch all unreported transactions in these months
    const allTransactions = [];
    for (const range of monthRanges) {
      const txns = await Transaction.find({
        type: "expense",
        "expenseDetails.includedInPnL": false,
        date: { $gte: range.startDate, $lte: range.endDate }
      });
      allTransactions.push(...txns);
      console.log(`📦 ${txns.length} transactions found for month ${range.month}`);
    }

    if (allTransactions.length === 0) {
      return res.status(200).json({ message: "No unreported transactions found for the selected months." });
    }

    // Calculate total amount
    let totalAmount = 0;
    allTransactions.forEach(txn => {
      totalAmount += parseFloat(txn.amount.toString());
    });

    // Create period key for the report (from first to last selected month)
    const periodKey = `${months[0]}_${months[months.length - 1]}_${Date.now()}`;

    // Create Expense Report
    const newReport = await ExpenseReport.create({
      periodKey,
      fromDate: monthRanges[0].startDate,
      toDate: monthRanges[monthRanges.length - 1].endDate,
      totalAmount,
      transactionIds: allTransactions.map(txn => txn._id),
      status: "calculated"
    });

    console.log("✅ ExpenseReport created:", newReport._id.toString());

    // // Mark transactions as reported
    // const updateResult = await Transaction.updateMany(
    //   { _id: { $in: allTransactions.map(txn => txn._id) }, "expenseDetails.isReported": false },
    //   { $set: { "expenseDetails.isReported": true } }
    // );

    // console.log(`✅ Transactions marked as reported: ${updateResult.modifiedCount}`);

    return res.status(201).json({
      message: "Expense report generated successfully for selected months.",
      report: newReport,
      transactionsCount: allTransactions.length
    });

  } catch (error) {
    console.error("🔥 ERROR in generateExpenseReportByMonthsController:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// only groups them together based on months
export const groupTransactionsByMonthController = async (req, res) => {
  try {
    console.log("🚀 Group by month controller triggered");

    const transactions = await Transaction.find({
      type: { $regex: /^expense$/i } // case-safe
    }).sort({ date: 1 });

    console.log("🧪 Transactions found:", transactions.length);

    const grouped = {};

    transactions.forEach(txn => {
      if (!txn.date) {
        console.warn("⚠️ Missing date for txn:", txn._id);
        return;
      }

      const monthKey = new Date(txn.date).toISOString().slice(0, 7);

      if (!grouped[monthKey]) {
        grouped[monthKey] = { reported: [], unreported: [] };
      }

      if (txn.expenseDetails?.isPaid === true) {
        grouped[monthKey].reported.push(txn);
      } else {
        grouped[monthKey].unreported.push(txn);
      }
    });

    const unreportedMonths = [];
    const reportedMonths = [];

    Object.entries(grouped).forEach(([month, data]) => {
      if (data.unreported.length)
        unreportedMonths.push({ month, transactions: data.unreported });

      if (data.reported.length)
        reportedMonths.push({ month, transactions: data.reported });
    });

    console.log("📦 Grouped result:", {
      unreportedMonths: unreportedMonths.length,
      reportedMonths: reportedMonths.length
    });

    return res.json({ unreportedMonths, reportedMonths });

  } catch (error) {
    console.error("🔥 Grouping error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const fetchExpenseReportsController = async (req, res) => {
  try {
    const { status } = req.query;

    if (!["calculated", "paid"].includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Use calculated or paid."
      });
    }

    const reports = await ExpenseReport.find({ status })
      .populate("transactionIds")
      .sort({ createdAt: -1 });

    res.json({
      count: reports.length,
      reports
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

export const fetchExpenseTransactionsController = async (req, res) => {
  try {
    const { includedInPnL, isPaid } = req.query;
    const query = {};

    /* -------- EXPENSE TYPE FILTER -------- */
    if (includedInPnL !== undefined) {
      query.includedInPnL = includedInPnL === "true";
    }

    /* -------- CLEARED FILTER -------- */
    if (isPaid !== undefined) {
      query["expenseDetails.isPaid"] = isPaid === "true";
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1 });

    console.log("Length: ", transactions.length);
    console.log("Transactions: ", transactions);
    
    res.json({
      count: transactions.length,
      transactions
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

