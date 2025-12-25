import mongoose from "mongoose";
import Transaction from "../../models/FinanceModals/TransactionModel.js";
import ExpenseReport from "../../models/FinanceModals/ExpenseReports.js";
import Cycle from "../../models/BussinessOperationModals/cyclesModel.js";

export const createExpenseReportController = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { fromDate, toDate } = req.body;

    if (!fromDate || !toDate) {
      throw new Error("fromDate and toDate are required");
    }

    const periodKey = `${fromDate}_${toDate}`;

    /* -------- FETCH UNREPORTED EXPENSE TRANSACTIONS -------- */
    const expenseTransactions = await Transaction.find({
      isExpense: true,
      "expenseDetails.reported": { $ne: true },
      date: {
        $gte: new Date(fromDate),
        $lte: new Date(toDate)
      }
    }).session(session);

    if (!expenseTransactions.length) {
      throw new Error("No unreported expense transactions found");
    }

    /* -------- CALCULATE TOTAL EXPENSE -------- */
    const totalAmount = expenseTransactions.reduce(
      (sum, tx) => sum + Number(tx.amount),
      0
    );

    /* -------- CREATE EXPENSE REPORT -------- */
    const [expenseReport] = await ExpenseReport.create(
      [{
        periodKey,
        fromDate,
        toDate,
        totalAmount,
        transactionIds: expenseTransactions.map(tx => tx._id),
        status: "calculated"
      }],
      { session }
    );

    /* -------- MARK TRANSACTIONS AS REPORTED -------- */
    await Transaction.updateMany(
      { _id: { $in: expenseReport.transactionIds } },
      { $set: { "expenseDetails.reported": true } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Expense report created successfully",
      expenseReport
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    res.status(500).json({
      error: error.message
    });
  }
};

// Method:1 of the report generating..
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
      "expenseDetails.isReported": false,
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
      fromDate: cycle.startDate,
      toDate: cycle.endDate,
      totalAmount,
      transactionIds: transactions.map(txn => txn._id),
      status: "calculated"
    });

    console.log("✅ ExpenseReport created:", newReport._id.toString());

    /* ======================================================
     * 5️⃣ MARK TRANSACTIONS AS REPORTED
     * ====================================================== */
    const updateResult = await Transaction.updateMany(
      { _id: { $in: transactions.map(txn => txn._id) }, "expenseDetails.isReported": false },
      { $set: { "expenseDetails.isReported": true } }
    );
    console.log(`✅ Transactions updated (marked reported): ${updateResult.modifiedCount}`);

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

// only groups them together..
export const groupTransactionsByMonthController = async (req, res) => {
  try {
    console.log("🚀 [Transactions] Group by month controller triggered");

    // Fetch all transactions sorted by date ascending
    const transactions = await Transaction.find({ type: "expense" }).sort({ date: 1 });

    const grouped = {};

    transactions.forEach(txn => {
      const monthKey = txn.date.toISOString().slice(0, 7); // YYYY-MM

      if (!grouped[monthKey]) {
        grouped[monthKey] = { reported: [], unreported: [] };
      }

      if (txn.expenseDetails?.isReported) {
        grouped[monthKey].reported.push(txn);
      } else {
        grouped[monthKey].unreported.push(txn);
      }
    });

    // Prepare arrays for easier UI consumption
    const unreportedMonths = [];
    const reportedMonths = [];

    for (const monthKey in grouped) {
      if (grouped[monthKey].unreported.length > 0) {
        unreportedMonths.push({ month: monthKey, transactions: grouped[monthKey].unreported });
      }
      if (grouped[monthKey].reported.length > 0) {
        reportedMonths.push({ month: monthKey, transactions: grouped[monthKey].reported });
      }
    }

    console.log("📦 Transactions grouped by month");

    return res.status(200).json({
      unreportedMonths,
      reportedMonths
    });

  } catch (error) {
    console.error("🔥 ERROR in groupTransactionsByMonthController:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

/* ======================================================
 * 2️⃣ Method-2: Generate report by selected months
 * ====================================================== */
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
        "expenseDetails.isReported": false,
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

    // Mark transactions as reported
    const updateResult = await Transaction.updateMany(
      { _id: { $in: allTransactions.map(txn => txn._id) }, "expenseDetails.isReported": false },
      { $set: { "expenseDetails.isReported": true } }
    );

    console.log(`✅ Transactions marked as reported: ${updateResult.modifiedCount}`);

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
    const { isReported, isPaid } = req.query;

    const query = {};

    /* -------- EXPENSE TYPE FILTER -------- */
    if (isExpense !== undefined) {
      query.isExpense = isExpense === "true";
    }

    /* -------- CLEARED FILTER -------- */
    if (isCleared !== undefined) {
      query["expenseDetails.isCleared"] = isCleared === "true";
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1 });

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

