import express from "express";

import {
  syncSellersFromBusiness,
  getAllSellers,
  getSingleSeller,
} from "../../contollers/FinanceControllers/SellerController.js";

import { authenticate,authorize } from "../../middlewares/authMiddlewares.js";

const router = express.Router();
router.use(authenticate());

// Admin/manual sync
router.get("/sync", syncSellersFromBusiness);

// Frontend usage
router.get("/sellers", getAllSellers);
router.get("/:id", getSingleSeller);

export default router;
