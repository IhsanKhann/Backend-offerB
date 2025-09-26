// routes/financeRoutes.js
import express from "express";
import { authenticate, authorize } from "../../middlewares/authMiddlewares.js";

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
  getSellerOrders,
  getOrderBreakups,
  getParentBreakup,
  getBuyerBreakup,
  getSellerBreakup,
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
router.post("/order-process", createOrderWithTransaction);

// Seller: view all orders received
router.get("/orders/seller/:sellerId", getSellerOrders);

// Seller/Admin: view all breakup files for a specific order
router.get("/orders/:orderId/breakups", getOrderBreakups);

router.get("/order/:orderId/breakup/parent", getParentBreakup);
router.get("/order/:orderId/breakup/buyer", getBuyerBreakup);
router.get("/order/:orderId/breakup/seller", getSellerBreakup);

// the transaction for - order return..
router.post("/return-process", returnOrderWithTransaction);

export default router;
