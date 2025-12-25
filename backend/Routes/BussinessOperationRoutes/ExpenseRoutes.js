import express from "express";
import {authenticate,authorize} from "../../middlewares/authMiddlewares.js";
import { 
    generateExpenseReportByCycle,
    groupTransactionsByMonthController,
    generateExpenseReportByMonthsController

} from "../../contollers/FinanceControllers/ExpenseReportControllers.js";

const router = express.Router();
router.use(authenticate);

// /api/expenseReports..
router.post("/cycle", generateExpenseReportByCycle);
router.get("/groupExpenseTransactions", groupTransactionsByMonthController);
router.post("/generate-Reports-ByMonths", generateExpenseReportByMonthsController);

export default router;
