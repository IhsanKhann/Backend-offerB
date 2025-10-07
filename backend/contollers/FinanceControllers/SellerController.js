// controllers/sellerController.js
import axios from "axios";
import cron from "node-cron";
import Seller from "../../models/FinanceModals/SellersModel.js";
import dotenv from "dotenv";
dotenv.config();

// manual sync sellers - use bussiness api
export const syncSellersFromBusiness = async (req, res) => {
  try {
    console.log("[SYNC] Manual seller sync started...");

    const { data: businessSellers } = await axios.get(
      `${process.env.BUSINESS_API_BASE}/sellers`
    );

    let newCount = 0;
    let updatedCount = 0;

    for (const s of businessSellers) {
      const result = await Seller.updateOne(
        { businessSellerId: s.id },
        {
          $set: {
            name: s.name,
            email: s.email ?? null,
            lastSyncedAt: new Date(),
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) newCount++;
      else updatedCount++;
    }

    console.log(
      `[SYNC] Completed. New: ${newCount}, Updated: ${updatedCount}, Total: ${businessSellers.length}`
    );

    res.status(200).json({
      success: true,
      message: "Sellers synced successfully",
      summary: { newCount, updatedCount, totalFetched: businessSellers.length },
    });
  } catch (error) {
    console.error("❌ [SYNC ERROR]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to sync sellers",
      error: error.message,
    });
  }
};

// cron job - fetch seller after every 6 hour 
cron.schedule("0 */6 * * *", async () => {
  try {
    console.log("[CRON] Seller auto-sync started...");
    const { data: businessSellers } = await axios.get(
      `${process.env.BUSINESS_API_BASE}/sellers`
    );

    let newCount = 0;
    let updatedCount = 0;

    for (const s of businessSellers) {
      const result = await Seller.updateOne(
        { businessSellerId: s.id },
        {
          $set: {
            name: s.name,
            email: s.email ?? null,
            lastSyncedAt: new Date(),
          },
        },
        { upsert: true }
      );
      if (result.upsertedCount > 0) newCount++;
      else updatedCount++;
    }

    console.log(
      `[CRON] Seller data synced. New: ${newCount}, Updated: ${updatedCount}, Total: ${businessSellers.length}`
    );
  } catch (err) {
    console.error("❌ [CRON ERROR]:", err.message);
  }
});
 
// seller Dashboard - fetch sellers from the database - local Database
export const getAllSellers = async (req, res) => {
  try {
    await syncSellersFromBusiness();
    const sellers = await Seller.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: sellers.length,
      data: sellers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching sellers",
      error: error.message,
    });
  }
};

// fetch single seller - local Database
export const getSingleSeller = async (req, res) => {
  try {
    const { id } = req.params;
    const seller = await Seller.findById(id);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    res.status(200).json({
      success: true,
      data: seller,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching seller",
      error: error.message,
    });
  }
};

// order makes seller if dosent exist - bussiness api called - use in orderController.
export const ensureSellerExists = async (businessSellerId) => {
  let seller = await Seller.findOne({ businessSellerId });

  if (!seller) {
    console.log(`[INFO] Seller ${businessSellerId} not found. Fetching from Business API...`);
    const { data: businessSeller } = await axios.get(
      `${process.env.BUSINESS_API_BASE}/sellers/${businessSellerId}`
    );

    if (!businessSeller || !businessSeller.id) {
      throw new Error("Seller not found on business side");
    }

    seller = await Seller.create({
      businessSellerId: businessSeller.id,
      name: businessSeller.name,
      email: businessSeller.email ?? null,
      totalOrders: 0,
      totalPending: 0,
      totalPaid: 0,
      currentBalance: 0,
      lastPaymentDate: null,
      lastUpdated: new Date(),
      lastSyncedAt: new Date(),
    });

    console.log(`[INFO] Seller ${seller.businessSellerId} created locally.`);
  }

  return seller;
};
