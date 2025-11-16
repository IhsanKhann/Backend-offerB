// routes/financeRoutes.js
import express from "express";
import { authenticate, authorize, verifyPartner } from "../../middlewares/authMiddlewares.js";


import {
  ExpenseTransactionController,
  CommissionTransactionController,
  transferCommissionToRetained,
  transferRetainedIncomeToCapital,
  SalaryTransactionController,
} from "../../contollers/FinanceControllers/TransactionController.js";

import {
  createOrderWithTransaction,
  returnOrderWithTransaction,
  
} from "../../contollers/FinanceControllers/OrderControllers.js";

const router = express.Router();

// Apply authentication for all finance routes
router.use(authenticate);

// --------------------
// 🔹 Finance Transactions
// --------------------
router.post("/transaction/expense", ExpenseTransactionController);
router.post("/transaction/commission/test", CommissionTransactionController);
router.post("/transaction/commission/close-to-retained", transferCommissionToRetained);
router.post("/transaction/transfer-retained-to-capital", transferRetainedIncomeToCapital);
router.post("/transaction/salary/:employeeId", SalaryTransactionController);

// --------------------
// 🔹 Order Transactions
// --------------------

// Create + process order with breakups & transaction
router.post("/order-process", verifyPartner,createOrderWithTransaction);

// the transaction for - order return..
router.post("/return-process", verifyPartner,returnOrderWithTransaction);


export default router;
