import {
    createAccountStatementForAll,
    createAccountStatementForSeller,
    createAccountStatementForSelected,
    sendAccountStatementsToBusiness,

    getAllAccountStatements,
    getSingleAccountStatement,
    updateAccountStatementStatus,
    initializeAccountStatements,
    getAccountStatementsByStatus,

} from "../../contollers/FinanceControllers/AccountStatementControllers.js";

import express from "express";
import { authenticate,authorize } from "../../middlewares/authMiddlewares.js";
const router = express.Router();

// Apply authentication for all finance routes
router.use(authenticate);

// --------------------
// 🧾 Account Statements Routes
// --------------------
router.post("/create/all", createAccountStatementForAll);
router.post("/create/selected", createAccountStatementForSelected);
router.post("/create/seller/:sellerId", createAccountStatementForSeller);
router.post("/send/all", sendAccountStatementsToBusiness);

router.get("/", getAllAccountStatements);
router.get("/:id", getSingleAccountStatement);
router.patch("/:id/status", updateAccountStatementStatus);
router.get("/", getAccountStatementsByStatus);

// testing:
router.post("/initialize", initializeAccountStatements);

export default router;