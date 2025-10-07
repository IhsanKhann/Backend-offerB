import cron from "node-cron";
import axios from "axios";
import SellerModel from "../models/FinanceModals/SellersModel.js";
import dotenv from "dotenv";
dotenv.config();

cron.schedule("0 */6 * * *", async () => { // every 6 hours
  const { data: businessSellers } = await axios.get(`${process.env.BUSINESS_API_BASE}/sellers`);
  for (const s of businessSellers) {
    await SellerModel.updateOne(
      { businessSellerId: s.id },
      { $set: { name: s.name } },
      { upsert: true }
    );
  }
  console.log("[CRON] Seller data synced successfully");
});
