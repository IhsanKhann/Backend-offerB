import express from "express";
import { authenticate,authorize } from "../../middlewares/authMiddlewares.js";
import {
    ExpenseTransactionController
}
from "../../contollers/FinanceControllers/TransactionController.js";

const router = express.Router();

router.post("/expense", ExpenseTransactionController);
router.use(authenticate);

export default router;


