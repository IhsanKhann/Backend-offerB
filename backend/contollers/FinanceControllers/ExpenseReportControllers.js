import mongoose from "mongoose";
import Transaction from "../../models/FinanceModals/TransactionModel";
import ExpenseReport from "../../models/FinanceModals/ExpenseReports.js";

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
    const { isExpense, isCleared } = req.query;

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
