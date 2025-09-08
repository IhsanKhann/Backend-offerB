import express from "express";
import { authenticate,authorize } from "../../middlewares/authMiddlewares.js";
import {
    ExpenseTransactionController,
    CommissionTransactionController,
    transferCommissionToRetained,  
    transferRetainedIncomeToCapital,
}
from "../../contollers/FinanceControllers/TransactionController.js";

const router = express.Router();

router.post("/expense", ExpenseTransactionController);
router.post("/commission/test", CommissionTransactionController);

router.post('/commission/close-to-retained', transferCommissionToRetained);
router.post('/transfer-retained-to-capital', transferRetainedIncomeToCapital);

router.use(authenticate);

export default router;


