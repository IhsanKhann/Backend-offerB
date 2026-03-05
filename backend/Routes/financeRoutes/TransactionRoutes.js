// routes/financeRoutes.js
import express from "express";
import { authenticate, authorize, verifyPartner } from "../../middlewares/authMiddlewares.js";
import {
  ExpensePayLaterController,
  ExpensePayNowController,

  CommissionTransactionController,
  SalaryTransactionController,
  summariesInitCapitalCash,
} from "../../contollers/FinanceControllers/TransactionController.js";

import {
  createOrderWithTransaction,
  
} from "../../contollers/FinanceControllers/OrderControllers.js";

// import {
//   generateExpenseReportByCycle
// } from "../../contollers/FinanceControllers/ExpenseReportControllers.js";

const router = express.Router();

// Apply authentication for all finance routes
router.use(authenticate);

// --------------------
// 🔹 Finance Transactions
// --------------------

// Expense Transactions:
router.post("/ExpensePayLater", ExpensePayLaterController);
router.post("/ExpensePayNow", ExpensePayNowController);

router.post("/commission/test", CommissionTransactionController);
router.post("/salary/:employeeId", SalaryTransactionController);
router.post("/init-capital-cash", summariesInitCapitalCash);
// --------------------
// 🔹 Order Transactions
// --------------------

// Create + process order with breakups & transaction
router.post("/order-process",createOrderWithTransaction);

export default router;
