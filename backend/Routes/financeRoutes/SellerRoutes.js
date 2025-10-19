import express from "express";

import {
  syncSellersFromBusiness,
  getAllSellers,
  getSingleSeller,

  suspendSeller,
  terminateSeller,
  blockSeller,
  rejectSeller,
  approveSeller

} from "../../contollers/FinanceControllers/SellerController.js";

import { authenticate,authorize } from "../../middlewares/authMiddlewares.js";

const router = express.Router();
router.use(authenticate);

// Admin/manual sync
router.get("/sync", syncSellersFromBusiness);

// Frontend usage
router.get("/all", getAllSellers);
router.get("/:id", getSingleSeller);

router.post("/:sellerId/suspend", suspendSeller);
router.post("/:sellerId/terminate", terminateSeller);
router.post("/:sellerId/block", blockSeller);
router.post("/:sellerId/reject", rejectSeller);
router.post("/:sellerId/approve", approveSeller);

export default router;
