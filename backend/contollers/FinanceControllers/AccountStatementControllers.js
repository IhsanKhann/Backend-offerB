import AccountStatementSeller from "../../models/FinanceModals/AccountStatementsSellerModel.js";
import BreakupFile from "../../models/FinanceModals/BreakupFiles.js";
import Seller from "../../models/FinanceModals/SellersModel.js";
import dotenv from "dotenv";
dotenv.config();

// 🧩 Helper: Validate and parse date
const parseDate = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) throw new Error("Invalid date format");
  return d;
};

// 🧩 Helper: Calculate seller receivables and order stats
const calculateSellerReceivables = async (sellerId, start, end) => {
  console.log("🔍 [calculateSellerReceivables] Fetching parent breakups for seller:", sellerId);

  // Extend end date to 23:59:59.999 to include today’s latest breakups
  const endOfDay = new Date(new Date(end).setHours(23, 59, 59, 999));

  // ONLY fetch parent breakups
  const breakups = await BreakupFile.find({
    $or: [{ sellerId }, { sellerId: sellerId.toString() }],
    breakupType: "parent", // <-- parent only
    createdAt: { $gte: start, $lte: endOfDay },
  });

  console.log(`📦 Found ${breakups.length} parent breakup(s) for seller ${sellerId} between ${start.toISOString()} - ${endOfDay.toISOString()}`);

  if (breakups.length === 0) {
    const sample = await BreakupFile.findOne().sort({ createdAt: -1 });
    console.log("🧾 Sample breakup from DB:", {
      id: sample?._id,
      sellerId: sample?.sellerId,
      type: typeof sample?.sellerId,
      breakupType: sample?.breakupType,
      createdAt: sample?.createdAt,
    });
  }

  let sellerNetReceivable = 0;
  let paidOrders = 0;
  let pendingOrders = 0;

  for (const breakup of breakups) {
    console.log(`🧾 Breakup ID: ${breakup._id}, sellerId: ${breakup.sellerId}, Lines: ${breakup.lines?.length || 0}`);

    for (const line of breakup.lines || []) {
      if (line.category === "receivable") {
        console.log(`➡️ Adding receivable line amount: ${line.amount}`);
        sellerNetReceivable += Number(line.amount) || 0;
      }
    }

    if (breakup.status === "paid") paidOrders++;
    else pendingOrders++;
  }

  const totalOrders = breakups.length;
  console.log(`💰 Seller ${sellerId} receivable total (parent only): ${sellerNetReceivable}`);
  console.log(`📊 Orders (parent only): total=${totalOrders}, paid=${paidOrders}, pending=${pendingOrders}`);

  return {
    sellerNetReceivable,
    totalOrders,
    paidOrders,
    pendingOrders,
    breakups,
  };
};

// 1️⃣ createAccountStatementForSeller
export const createAccountStatementForSeller = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const sellerId = Number(req.params.sellerId);
    console.log(`\n🚀 Creating statement for seller ${sellerId}`);

    if (isNaN(sellerId)) return res.status(400).json({ message: "Invalid sellerId" });

    const start = parseDate(startDate);
    const end = parseDate(endDate);

    const seller = await Seller.findOne({ businessSellerId: sellerId });
    if (!seller) return res.status(404).json({ message: "Seller not found" });

    const { sellerNetReceivable, totalOrders, paidOrders, pendingOrders, breakups } =
      await calculateSellerReceivables(sellerId, start, end);

    console.log("🧮 Calculated totals, creating AccountStatement...");

    const statement = new AccountStatementSeller({
      sellerId,
      sellerName: seller.name,
      totalAmount: sellerNetReceivable,
      periodStart: start,
      periodEnd: end,
      orderCount: totalOrders,
      paidOrders,
      pendingOrders,
      breakupIds: breakups.map((b) => b._id),
      orders: breakups.map((b) => ({
        breakupId: b._id,
        orderId: b.orderId,
        amount: b.lines
          .filter((l) => l.category === "receivable")
          .reduce((sum, l) => sum + (l.amount || 0), 0),
      })),
      status: "pending",
      generatedAt: new Date(),
    });

    console.log(`✅ Statement prepared for ${seller.name} | Breakups attached: ${statement.orders.length}`);
    await statement.save();
    console.log("💾 Statement saved successfully.");

    res.status(201).json({ success: true, data: statement });
  } catch (error) {
    console.error("❌ Error creating statement for seller:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 2️⃣ createAccountStatementsForSelected
export const createAccountStatementsForSelected = async (req, res) => {
  try {
    const { sellerIds, startDate, endDate } = req.body;
    const start = parseDate(startDate);
    const end = parseDate(endDate);

    if (!Array.isArray(sellerIds) || sellerIds.length === 0)
      return res.status(400).json({ message: "No sellerIds provided" });

    const results = [];

    for (const id of sellerIds) {
      const sellerId = Number(id);
      console.log(`\n🚀 Processing seller ${sellerId}`);

      const seller = await Seller.findOne({ businessSellerId: sellerId });
      if (!seller) {
        console.warn(`⚠️ Seller ${sellerId} not found, skipping.`);
        continue;
      }

      const { sellerNetReceivable, totalOrders, paidOrders, pendingOrders, breakups } =
        await calculateSellerReceivables(sellerId, start, end);

      const statement = new AccountStatementSeller({
        sellerId,
        sellerName: seller.name,
        totalAmount: sellerNetReceivable,
        periodStart: start,
        periodEnd: end,
        orderCount: totalOrders,
        paidOrders,
        pendingOrders,
        breakupIds: breakups.map((b) => b._id),
        orders: breakups.map((b) => ({
          breakupId: b._id,
          orderId: b.orderId,
          amount: b.lines
            .filter((l) => l.category === "receivable")
            .reduce((sum, l) => sum + (l.amount || 0), 0),
        })),
        status: "pending",
        generatedAt: new Date(),
      });

      console.log(`✅ Statement ready for ${seller.name} | Orders attached: ${statement.orders.length}`);
      await statement.save();
      results.push(statement);
    }

    res.status(201).json({ success: true, data: results });
  } catch (error) {
    console.error("❌ Error creating statements for selected sellers:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 3️⃣ createAccountStatementsForAll
export const createAccountStatementsForAll = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const start = parseDate(startDate);
    const end = parseDate(endDate);

    console.log(`\n🌍 Generating statements for all sellers between ${start} - ${end}`);

    const sellers = await Seller.find();
    const results = [];

    for (const seller of sellers) {
      const sellerId = Number(seller.businessSellerId);
      if (isNaN(sellerId)) continue;

      console.log(`🚀 Processing seller ${sellerId} (${seller.name})`);

      const { sellerNetReceivable, totalOrders, paidOrders, pendingOrders, breakups } =
        await calculateSellerReceivables(sellerId, start, end);

      const statement = new AccountStatementSeller({
        sellerId,
        sellerName: seller.name,
        totalAmount: sellerNetReceivable,
        periodStart: start,
        periodEnd: end,
        orderCount: totalOrders,
        paidOrders,
        pendingOrders,
        breakupIds: breakups.map((b) => b._id),
        orders: breakups.map((b) => ({
          breakupId: b._id,
          orderId: b.orderId,
          amount: b.lines
            .filter((l) => l.category === "receivable")
            .reduce((sum, l) => sum + (l.amount || 0), 0),
        })),
        status: "pending",
        generatedAt: new Date(),
      });

      console.log(`✅ Statement created for ${seller.name} | ${statement.orders.length} parent orders`);
      await statement.save();
      results.push(statement);
    }

    res.status(201).json({ success: true, data: results });
  } catch (error) {
    console.error("❌ Error creating statements for all sellers:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Utility Endpoints (Fetch / Update Statements)
export const getAllAccountStatements = async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const statements = await AccountStatementSeller.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: statements });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getSingleAccountStatement = async (req, res) => {
  try {
    const { id } = req.params;
    const statement = await AccountStatementSeller.findById(id);
    if (!statement) return res.status(404).json({ success: false, message: "Not found" });
    res.status(200).json({ success: true, data: statement });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateAccountStatementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await AccountStatementSeller.findByIdAndUpdate(
      id,
      { status, updatedAt: new Date() },
      { new: true }
    );
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Fetch account statements by status
export const getAccountStatementsByStatus = async (req, res) => {
  try {
    const status = req.query.status || "pending"; // default to pending

    // Fetch statements and populate seller info
    const statements = await AccountStatementSeller.find({ status })
      .populate("sellerId", "name email businessSellerId")
      .sort({ generatedAt: -1 });

    // Map for frontend-friendly response
    const formatted = statements.map((st) => ({
      _id: st._id,
      sellerId: st.sellerId._id,
      sellerName: st.sellerId.name,
      sellerEmail: st.sellerId.email,
      businessSellerId: st.sellerId.businessSellerId,
      startDate: st.periodStart.toISOString().split("T")[0],
      endDate: st.periodEnd.toISOString().split("T")[0],
      totalAmount: st.totalAmount,
      orders: st.orders,
      status: st.status,
      referenceId: st.referenceId,
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error("Error fetching account statements:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// send account Statements..
export const sendAccountStatementsToBusiness = async (req, res) => {
  try {
    const { sellerId, sellerIds, all } = req.body;

    let filter = { status: "pending" };

    if (sellerId) {
      filter.sellerId = sellerId;
    } else if (sellerIds && Array.isArray(sellerIds) && sellerIds.length > 0) {
      filter.sellerId = { $in: sellerIds };
    } else if (!all) {
      return res.status(400).json({
        success: false,
        message: "Provide either sellerId, sellerIds[], or set all=true.",
      });
    }

    const statements = await AccountStatementSeller.find(filter);
    if (!statements.length) {
      return res.status(404).json({
        success: false,
        message: "No pending account statements found.",
      });
    }

    const results = [];
    const failedSellers = [];

    for (const st of statements) {
      try {
        const payload = {
          sellerId: st.sellerId,
          sellerName: st.sellerName,
          periodStart: st.periodStart,
          periodEnd: st.periodEnd,
          totalAmount: st.totalAmount,
          orders: st.orders,
          generatedAt: st.generatedAt,
        };

        // actual Endpoint..
        // const response = await axios.post(
        //   `${process.env.BUSINESS_API_BASE}/payments/account-statement`,
        //   payload
        // );

        // ✅ Fake req/res for internal call
        const fakeReq = { body: { accountStatements: [payload] } };
        const fakeRes = {
          status: (code) => ({
            json: (data) => console.log(`Response (${code}):`, data),
          }),
          json: (data) => console.log("Response:", data),
        };

        await receiveAccountStatements(fakeReq, fakeRes);

        const referenceId = `BUS-${Date.now()}`;

        await AccountStatementSeller.findByIdAndUpdate(st._id, {
          status: "paid",
          referenceId,
          paidAt: new Date(),
        });

        results.push({
          id: st._id,
          sellerId: st.sellerId,
          sellerName: st.sellerName,
          status: "paid",
          referenceId,
        });
      } catch (err) {
        console.error("Failed for seller:", st.sellerId, err.message);
        failedSellers.push({
          sellerId: st.sellerId,
          sellerName: st.sellerName,
        });
      }
    }

    const paidCount = results.length;
    const failedCount = failedSellers.length;

    res.status(200).json({
      success: true,
      message: `✅ Sent ${paidCount} statement(s). ${failedCount} failed.`,
      results,
      failedSellers,
    });
  } catch (error) {
    console.error("❌ Error sending statements:", error);
    res.status(500).json({
      success: false,
      message: "Server error while sending account statements.",
      error: error.message,
    });
  }
};

// ✅ Receiver
export const receiveAccountStatements = async (req, res) => {
  try {
    const { accountStatements } = req.body;
    console.log("Received account statements payload:", accountStatements);

    if (!accountStatements || !Array.isArray(accountStatements)) {
      return res.status(400).json({ message: "Invalid account statements format" });
    }

    console.log("📦 Received Account Statements:");
    console.log(JSON.stringify(accountStatements, null, 2));

    return res.status(200).json({ message: "Account statements received successfully!" });
  } catch (error) {
    console.error("Error receiving account statements:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
