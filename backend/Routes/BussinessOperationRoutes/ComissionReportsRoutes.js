import express from "express";
import { authenticate,authorize } from "../../middlewares/authMiddlewares.js";
import {
    closeCommissionOnly,
    closeCommissionByDateRange,
    closeCommissionPeriodController,
    groupCommissionTransactionsByMonthController,

    fetchCommissionReportsByStatusController,
    fetchCommissionTransactionsByStatusController,

} from "../../contollers/FinanceControllers/CommissionReportControllers.js";

const router = express.Router();
router.use(authenticate);

router.post("/cyclicReports", closeCommissionPeriodController);
router.post("/nonCyclicReports", closeCommissionByDateRange);
router.post("/directlyNoExpanses", closeCommissionOnly);
router.get("/groupTransactionsForCommission", groupCommissionTransactionsByMonthController);

router.get("/fetchReportsByStatus" , fetchCommissionReportsByStatusController);
router.get("/fetchTransactionsByStatus", fetchCommissionTransactionsByStatusController);

export default router;