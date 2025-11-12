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
    const businessSellerId = Number(req.params.sellerId);
    console.log(`\n🚀 Creating statement for seller ${businessSellerId}`);

    if (isNaN(businessSellerId))
      return res.status(400).json({ message: "Invalid sellerId" });

    const start = parseDate(startDate);
    const end = parseDate(endDate);

    const seller = await Seller.findOne({ businessSellerId });
    if (!seller)
      return res.status(404).json({ message: "Seller not found" });

    // Fetch and filter breakups
    const {
      sellerNetReceivable,
      totalOrders,
      paidOrders,
      pendingOrders,
      breakups,
    } = await calculateSellerReceivables(businessSellerId, start, end);

    // Filter out paid ones
    const unpaidBreakups = breakups.filter((b) => b.paymentStatus !== "paid");
    const alreadyPaidBreakups = breakups.filter((b) => b.paymentStatus === "paid");

    if (alreadyPaidBreakups.length > 0) {
      console.warn(`⚠️ ${alreadyPaidBreakups.length} orders already paid`);
      return res.status(409).json({
        success: false,
        message: "Some orders were already paid.",
        alreadyPaidOrders: alreadyPaidBreakups.map((b) => b.orderId),
      });
    }

    const statement = new AccountStatementSeller({
      businessSellerId,
      sellerName: seller.name,
      totalAmount: sellerNetReceivable,
      periodStart: start,
      periodEnd: end,
      orderCount: totalOrders,
      paidOrders,
      pendingOrders,
      breakupIds: unpaidBreakups.map((b) => b._id),
      orders: unpaidBreakups.map((b) => ({
        breakupId: b._id,
        orderId: b.orderId,
        amount: b.lines
          .filter((l) => l.category === "receivable")
          .reduce((sum, l) => sum + (l.amount || 0), 0),
      })),
      status: "pending",
      generatedAt: new Date(),
    });

    await statement.save();

    // Mark breakups as processing
    await BreakupFile.updateMany(
      { _id: { $in: unpaidBreakups.map((b) => b._id) } },
      { $set: { paymentStatus: "processing", linkedStatementId: statement._id } }
    );

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
      const businessSellerId = Number(id);
      const seller = await Seller.findOne({ businessSellerId });
      if (!seller) continue;

      const {
        sellerNetReceivable,
        totalOrders,
        paidOrders,
        pendingOrders,
        breakups,
      } = await calculateSellerReceivables(businessSellerId, start, end);

      const unpaidBreakups = breakups.filter((b) => b.paymentStatus !== "paid");
      const alreadyPaidBreakups = breakups.filter((b) => b.paymentStatus === "paid");

      if (alreadyPaidBreakups.length > 0) {
        console.warn(`⚠️ Skipping ${alreadyPaidBreakups.length} paid orders for seller ${seller.name}`);
        continue;
      }

      const statement = new AccountStatementSeller({
        businessSellerId,
        sellerName: seller.name,
        totalAmount: sellerNetReceivable,
        periodStart: start,
        periodEnd: end,
        orderCount: totalOrders,
        paidOrders,
        pendingOrders,
        breakupIds: unpaidBreakups.map((b) => b._id),
        orders: unpaidBreakups.map((b) => ({
          breakupId: b._id,
          orderId: b.orderId,
          amount: b.lines
            .filter((l) => l.category === "receivable")
            .reduce((sum, l) => sum + (l.amount || 0), 0),
        })),
        status: "pending",
        generatedAt: new Date(),
      });

      await statement.save();

      await BreakupFile.updateMany(
        { _id: { $in: unpaidBreakups.map((b) => b._id) } },
        { $set: { paymentStatus: "processing", linkedStatementId: statement._id } }
      );

      results.push(statement);
    }

    res.status(201).json({ success: true, data: results });
  } catch (error) {
    console.error("❌ Error creating statements for selected sellers:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};


// ✅ 3️⃣ createAccountStatementsForAll
export const createAccountStatementsForAll = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const start = parseDate(startDate);
    const end = parseDate(endDate);

    const sellers = await Seller.find();
    const results = [];

    for (const seller of sellers) {
      const businessSellerId = Number(seller.businessSellerId);
      if (isNaN(businessSellerId)) continue;

      const {
        sellerNetReceivable,
        totalOrders,
        paidOrders,
        pendingOrders,
        breakups,
      } = await calculateSellerReceivables(businessSellerId, start, end);

      const unpaidBreakups = breakups.filter((b) => b.paymentStatus !== "paid");
      if (!unpaidBreakups.length) continue;

      const statement = new AccountStatementSeller({
        businessSellerId,
        sellerName: seller.name,
        totalAmount: sellerNetReceivable,
        periodStart: start,
        periodEnd: end,
        orderCount: totalOrders,
        paidOrders,
        pendingOrders,
        breakupIds: unpaidBreakups.map((b) => b._id),
        orders: unpaidBreakups.map((b) => ({
          breakupId: b._id,
          orderId: b.orderId,
          amount: b.lines
            .filter((l) => l.category === "receivable")
            .reduce((sum, l) => sum + (l.amount || 0), 0),
        })),
        status: "pending",
        generatedAt: new Date(),
      });

      await statement.save();
      await BreakupFile.updateMany(
        { _id: { $in: unpaidBreakups.map((b) => b._id) } },
        { $set: { paymentStatus: "processing", linkedStatementId: statement._id } }
      );

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

// send statements:
export const sendAccountStatementsToBusiness = async (req, res) => {
  try {
    const { businessSellerId, businessSellerIds, all } = req.body;

    if (!all && !businessSellerId && (!businessSellerIds || businessSellerIds.length === 0)) {
      return res.status(400).json({
        success: false,
        message: "Provide either businessSellerId, businessSellerIds[], or set all=true.",
      });
    }

    const filter = { status: "pending" };
    if (businessSellerId) filter.businessSellerId = businessSellerId;
    else if (Array.isArray(businessSellerIds) && businessSellerIds.length > 0)
      filter.businessSellerId = { $in: businessSellerIds };

    const statements = await AccountStatementSeller.find(filter);
    if (!statements.length)
      return res.status(404).json({ success: false, message: "No pending account statements found." });

    const results = [];
    const failedSellers = [];

    for (const st of statements) {
      try {
        const payload = {
          businessSellerId: st.businessSellerId,
          sellerName: st.sellerName,
          periodStart: st.periodStart,
          periodEnd: st.periodEnd,
          totalAmount: st.totalAmount,
          orders: st.orders,
          generatedAt: st.generatedAt,
        };

        const fakeReq = { body: { accountStatements: [payload] } };
        const fakeRes = { status: (code) => ({ json: (data) => console.log(`Response (${code}):`, data) }) };
        await receiveAccountStatements(fakeReq, fakeRes);

        await Seller.findOneAndUpdate(
          { businessSellerId: st.businessSellerId },
          {
            $inc: { paidReceivableAmount: st.totalAmount, paidOrders: st.orders.length },
            $set: { lastPaymentDate: new Date(), lastUpdated: new Date() },
          },
          { new: true, upsert: true }
        );

        const referenceId = `BUS-${Date.now()}`;
        await AccountStatementSeller.findByIdAndUpdate(st._id, {
          status: "paid",
          referenceId,
          paidAt: new Date(),
        });

        // ✅ Mark linked breakups as fully paid
        await BreakupFile.updateMany(
          { linkedStatementId: st._id },
          { $set: { paymentStatus: "paid", paymentClearedDate: new Date() } }
        );

        results.push({
          id: st._id,
          businessSellerId: st.businessSellerId,
          sellerName: st.sellerName,
          status: "paid",
          referenceId,
        });
      } catch (err) {
        console.error("Failed for seller:", st.businessSellerId, err.message);
        failedSellers.push({
          businessSellerId: st.businessSellerId,
          sellerName: st.sellerName,
          error: err.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `✅ Sent ${results.length} statement(s). ${failedSellers.length} failed.`,
      results,
      failedSellers,
    });
  } catch (error) {
    console.error("❌ Error sending statements:", error);
    res.status(500).json({ success: false, message: "Server error while sending account statements.", error: error.message });
  }
};

// Receiver:
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
