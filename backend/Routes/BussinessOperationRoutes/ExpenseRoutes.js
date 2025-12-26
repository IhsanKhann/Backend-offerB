import express from "express";
import {authenticate,authorize} from "../../middlewares/authMiddlewares.js";
import { 
    generateExpenseReportByCycle,
    generateExpenseReportByMonthsController,

    // group transactions:
    groupTransactionsByMonthController,

    // pay the expanse with cash..
    payExpensePeriodController,

    // fetch Data
    fetchExpenseTransactionsController,
    fetchExpenseReportsController,
} from "../../contollers/FinanceControllers/ExpenseReportControllers.js";

const router = express.Router();
router.use(authenticate);

// /api/expenseReports..
router.post("/cycle", generateExpenseReportByCycle);
router.post("/generate-Reports-ByMonths", generateExpenseReportByMonthsController);

// group:
router.get("/groupExpenseTransactions", groupTransactionsByMonthController);

// pay:
router.post("/PayExpensesLater", payExpensePeriodController);

// different statuses: fetching..
router.get("/fetchExpenseReportsController" , fetchExpenseReportsController);
router.get("/fetchExpenseTransactionsController", fetchExpenseTransactionsController);


export default router;
