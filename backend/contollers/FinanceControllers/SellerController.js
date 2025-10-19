// controllers/sellerController.js
import axios from "axios";
import cron from "node-cron";
import Seller from "../../models/FinanceModals/SellersModel.js";
import dotenv from "dotenv";
dotenv.config();

const PHP_BASE_URL = process.env.BUSINESS_API_BASE || "https://your-php-server.com/api";

// ✅ Helper to make consistent API calls
const callPhpApi = async (endpoint, method = "GET", data = null, params = {}) => {
  try {
    const res = await axios({
      url: `${PHP_BASE_URL}${endpoint}`,
      method,
      data,
      params,
      headers: { "Content-Type": "application/json" },
      timeout: 8000,
    });
    return res.data;
  } catch (err) {
    console.error(`🔥 PHP API error at ${endpoint}:`, err.response?.data || err.message);
    throw new Error(err.response?.data?.message || "PHP API call failed");
  }
};

// 🧠 Helper function
export const syncSellers = async () => {
  console.log("[SYNC] Syncing sellers...");

  const response = await axios.get(`${process.env.BUSINESS_API_BASE}/seller/all_sellers`) || await axios.get("https://offersberries.com/api/v2/seller/all_sellers");

  const businessSellers = response.data.data || [];

  let newCount = 0;
  let updatedCount = 0;

  for (const s of businessSellers) {
    const result = await Seller.updateOne(
      { businessSellerId: s.id },
      {
        $set: {
          name: `${s.f_name} ${s.l_name}`.trim(),
          email: s.email ?? null,
          phone: s.phone ?? null,
          lastSyncedAt: new Date(),
        },
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) newCount++;
    else updatedCount++;
  }

  console.log(`[SYNC] Done. New: ${newCount}, Updated: ${updatedCount}, Total: ${businessSellers.length}`);
};

// 🚀 Route handler
export const syncSellersFromBusiness = async (req, res) => {
  try {
    await syncSellers();
    res.status(200).json({ success: true, message: "Sellers synced successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to sync sellers", error: err.message });
  }
};

// ✅ Fetch all sellers (with smart sync)
export const getAllSellers = async (req, res) => {
  try {
    // Get latest seller record (for checking last sync)
    const latestSeller = await Seller.findOne().sort({ lastSyncedAt: -1 });

    // If sellers exist and were synced within last 6 hours, just return them
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    if (latestSeller && latestSeller.lastSyncedAt > sixHoursAgo) {
      const sellers = await Seller.find().sort({ createdAt: -1 });
      return res.status(200).json({
        success: true,
        message: "✅ Returning cached sellers (recent sync)",
        count: sellers.length,
        data: sellers,
      });
    }

    // Otherwise, perform a fresh sync from the business API
    console.log("[SYNC] Sellers outdated — syncing fresh data...");
    await syncSellers();
    const sellers = await Seller.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "✅ Sellers synced and returned successfully",
      count: sellers.length,
      data: sellers,
    });
  } catch (error) {
    console.error("[ERROR] Fetching sellers:", error.message);
    res.status(500).json({
      success: false,
      message: "Error fetching sellers",
      error: error.message,
    });
  }
};

// ✅ Cron job
cron.schedule("0 */6 * * *", async () => {
  try {
    console.log("[CRON] Seller auto-sync started...");
    await syncSellers();
  } catch (err) {
    console.error("❌ [CRON ERROR]:", err.message);
  }
});

// ✅ Fetch single seller (local + fallback)
export const getSingleSeller = async (req, res) => {
  try {
    const { id } = req.params;
    let seller = await Seller.findById(id);

    if (!seller) {
      const response = await axios.get(`${process.env.BUSINESS_API_BASE}/seller/single_seller/${id}`) || await axios.get(`https://offersberries.com/api/v2/seller/single_seller/${id}`);
      
      const businessSeller = response.data.data;

      if (!businessSeller) return res.status(404).json({ success: false, message: "Seller not found" });

      seller = await Seller.create({
        businessSellerId: businessSeller.id,
        name: `${businessSeller.f_name} ${businessSeller.l_name}`.trim(),
        email: businessSeller.email ?? null,
        phone: businessSeller.phone ?? null,
        lastSyncedAt: new Date(),
      });
    }

    res.status(200).json({ success: true, data: seller });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching seller", error: error.message });
  }
};

// ✅ Ensure seller exists (used by orders)
export const ensureSellerExists = async (businessSellerId) => {
  let seller = await Seller.findOne({ businessSellerId });

  if (!seller) {
    console.log(`[INFO] Seller ${businessSellerId} not found. Fetching from Business API...`);

    // 🧠 Convert to numeric ID if needed
    const numericId = /^\d+$/.test(businessSellerId)
      ? businessSellerId
      : businessSellerId.replace(/\D/g, ""); // remove non-digits

    const response =
      await axios.get(`${process.env.BUSINESS_API_BASE}/seller/single_seller/${numericId}`)
        .catch(() =>
          axios.get(`https://offersberries.com/api/v2/seller/single_seller/${numericId}`)
        );

    const businessSeller = response.data?.data;

    if (!businessSeller || !businessSeller.id) {
      throw new Error("Seller not found on business side");
    }

    seller = await Seller.create({
      businessSellerId: businessSeller.id,
      name: `${businessSeller.f_name} ${businessSeller.l_name}`.trim(),
      email: businessSeller.email ?? null,
      phone: businessSeller.phone ?? null,
      totalOrders: 0,
      totalPending: 0,
      totalPaid: 0,
      currentBalance: 0,
      lastPaymentDate: null,
      lastUpdated: new Date(),
      lastSyncedAt: new Date(),
    });

    console.log(`[INFO] ✅ Seller ${seller.businessSellerId} created locally.`);
  }

  return seller;
};

export const approveSeller = async (req, res) => {
  try {
    const { sellerId } = req.params;
    if (!sellerId) return res.status(400).json({ success: false, message: "sellerId is required" });

    const phpResponse = await callPhpApi(`/seller/approve/${sellerId}`, "POST");

    return res.status(200).json({
      success: true,
      message: phpResponse.message || "Seller approved successfully",
      data: phpResponse.data || null,
    });
  } catch (error) {
    console.error("approveSeller error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectSeller = async (req, res) => {
  try {
    const { sellerId } = req.params;
    if (!sellerId) return res.status(400).json({ success: false, message: "sellerId is required" });

    const phpResponse = await callPhpApi(`/seller/reject/${sellerId}`, "POST");

    return res.status(200).json({
      success: true,
      message: phpResponse.message || "Seller rejected successfully",
    });
  } catch (error) {
    console.error("rejectSeller error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const blockSeller = async (req, res) => {
  try {
    const { sellerId } = req.params;
    if (!sellerId) return res.status(400).json({ success: false, message: "sellerId is required" });

    const phpResponse = await callPhpApi(`/seller/block/${sellerId}`, "POST");

    return res.status(200).json({
      success: true,
      message: phpResponse.message || "Seller blocked successfully",
    });
  } catch (error) {
    console.error("blockSeller error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const terminateSeller = async (req, res) => {
  try {
    const { sellerId } = req.params;
    if (!sellerId) return res.status(400).json({ success: false, message: "sellerId is required" });

    const phpResponse = await callPhpApi(`/seller/terminate/${sellerId}`, "POST");

    return res.status(200).json({
      success: true,
      message: phpResponse.message || "Seller terminated successfully",
    });
  } catch (error) {
    console.error("terminateSeller error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const suspendSeller = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { duration, reason } = req.body;

    if (!sellerId) return res.status(400).json({ success: false, message: "sellerId is required" });

    const phpResponse = await callPhpApi(`/seller/suspend/${sellerId}`, "POST", { duration, reason });

    return res.status(200).json({
      success: true,
      message: phpResponse.message || "Seller suspended successfully",
      data: phpResponse.data || null,
    });
  } catch (error) {
    console.error("suspendSeller error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

