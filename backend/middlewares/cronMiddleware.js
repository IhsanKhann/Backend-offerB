import cron from "node-cron";
import {syncSellers} from "../contollers/FinanceControllers/SellerController.js";
import {processReturnExpiryTransactions} from "../contollers/FinanceControllers/OrderControllers.js";

// ✅ Cron job
// cron.schedule("0 */6 * * *", async () => {
//   try {
//     console.log("[CRON] Seller auto-sync started...");
//     await processReturnExpiryTransactions();
//     await syncSellers();
//   } catch (err) {
//     console.error("❌ [CRON ERROR]:", err.message);
//   }
// });

// ✅ Cron job
// cron.schedule("*/30 * * * * *", async () => {
//   try {
//     console.log("[CRON] Seller auto-sync started...");
//     await processReturnExpiryTransactions();
//     // await syncSellers();
//   } catch (err) {
//     console.error("❌ [CRON ERROR]:", err.message);
//   }
// });
