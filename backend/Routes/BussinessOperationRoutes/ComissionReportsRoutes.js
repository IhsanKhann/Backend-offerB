import express from "express";
import { authenticate,authorize } from "../../middlewares/authMiddlewares.js";
import {
    closeCommissionOnly,
    closeCommissionByDateRange,
    closeCommissionPeriodController,
} from "../../contollers/FinanceControllers/CommissionReportControllers.js";

const router = express.Router();
router.use(authenticate);

router.post("/cyclicReports", closeCommissionPeriodController);
router.post("/nonCyclicReports", closeCommissionByDateRange);
router.post("/directlyNoExpanses", closeCommissionOnly);

export default router;