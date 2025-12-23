<<<<<<< HEAD
import cron from "node-cron"
import express from "express";

=======
import cron from "node-cron";
import express from "express";
>>>>>>> a6ead15 (made changes to the orderController and working on the commission flow)
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

// ✅ Cron job
<<<<<<< HEAD
<<<<<<< HEAD
// cron.schedule("*/30 * * * * *", async () => {
//   try {
//     console.log("[CRON] Seller auto-sync started...");
//     await processReturnExpiryTransactions();
//     // await syncSellers();
//   } catch (err) {
//     console.error("❌ [CRON ERROR]:", err.message);
//   }
// });



// ✅ Manual trigger for cron job
router.post("/trigger-return-expiry", async (req, res) => {
  try {
    await processReturnExpiryTransactions();
    res.status(200).json({ success: true, message: "Return expiry transactions processed manually" });
  } catch (err) {
    console.error("❌ [MANUAL CRON ERROR]:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

=======
cron.schedule("*/30 * * * * *", async () => {
=======
cron.schedule("0 0 */6 * * *", async () => {
>>>>>>> 358bf42 (Fix order finance handling and cron middleware logic)
  try {
    console.log("🕒 [CRON] Seller auto-sync started...");
    await processReturnExpiryTransactions(false);
    await syncSellers();
  } catch (err) {
    console.error("❌ [CRON ERROR]:", err.message);
  }
});
<<<<<<< HEAD

>>>>>>> a6ead15 (made changes to the orderController and working on the commission flow)
=======
>>>>>>> 358bf42 (Fix order finance handling and cron middleware logic)
