import {
    createAccountStatementsForAll,
    createAccountStatementForSeller,
    createAccountStatementsForSelected,
    sendAccountStatementsToBusiness,

    getAllAccountStatements,
    getSingleAccountStatement,
    updateAccountStatementStatus,
    getAccountStatementsByStatus,

    receiveAccountStatements,

} from "../../contollers/FinanceControllers/AccountStatementControllers.js";

import express from "express";
import { authenticate,authorize } from "../../middlewares/authMiddlewares.js";
const router = express.Router();

// Apply authentication for all finance routes
router.use(authenticate);

// --------------------
// 🧾 Account Statements Routes
// --------------------
router.post("/create/all", createAccountStatementsForAll);
router.post("/create/selected", createAccountStatementsForSelected);
router.post("/create/seller/:sellerId", createAccountStatementForSeller);
router.post("/send/all", sendAccountStatementsToBusiness);

router.get("/", getAllAccountStatements);
router.get("/:id", getSingleAccountStatement);
router.patch("/:id/status", updateAccountStatementStatus);
router.get("/", getAccountStatementsByStatus);
router.post("/receive", receiveAccountStatements);

export default router;
