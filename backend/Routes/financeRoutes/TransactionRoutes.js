// routes/financeRoutes.js
import express from "express";
import { authenticate, authorize, verifyPartner } from "../../middlewares/authMiddlewares.js";
import {
  ExpensePayLaterController,
  ExpensePayNowController,

  CommissionTransactionController,
  transferCommissionToRetained,
  transferRetainedIncomeToCapital,
  SalaryTransactionController,
  summariesInitCapitalCash,
} from "../../contollers/FinanceControllers/TransactionController.js";

import {
  createOrderWithTransaction,
  returnOrderWithTransaction,
  
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
router.post("/commission/close-to-retained", transferCommissionToRetained);
router.post("/transfer-retained-to-capital", transferRetainedIncomeToCapital);
router.post("/salary/:employeeId", SalaryTransactionController);
router.post("/init-capital-cash", summariesInitCapitalCash);
// --------------------
// 🔹 Order Transactions
// --------------------

// Create + process order with breakups & transaction
router.post("/order-process",createOrderWithTransaction);

// the transaction for - order return..
router.post("/return-process",returnOrderWithTransaction);


export default router;
