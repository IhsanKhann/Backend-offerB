import cron from "node-cron";
import express from "express";
import {syncSellers} from "../contollers/FinanceControllers/SellerController.js";
import {processReturnExpiryTransactions} from "../contollers/FinanceControllers/OrderControllers.js";
const router = express.Router();

// ✅ Manual trigger for cron job
router.post("/trigger-return-expiry", async (req, res) => {
  try {
    await processReturnExpiryTransactions(true);
    res.status(200).json({ success: true, message: "Return expiry transactions processed manually" });
  } catch (err) {
    console.error("❌ [MANUAL CRON ERROR]:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

// cron.schedule("* * */6 * * *", async () => {
//   try {
//     console.log("[CRON] Seller auto-sync started...");
//     await processReturnExpiryTransactions();
    // await syncSellers();
//   } catch (err) {
//     console.error("❌ [CRON ERROR]:", err.message);
//   }
// });

