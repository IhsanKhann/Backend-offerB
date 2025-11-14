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

// Receiver: Testing.. Done (soon remove it.)
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

// Account Statement Creation, Calculation and the Deletion of the Account Statements..

// ---------- Helpers ----------

// Parse date string into a Date object while preserving time if provided.
// If the incoming string is date-only (YYYY-MM-DD), start => 00:00:00.000, end => 23:59:59.999
const parseNormalizeRange = (startStr, endStr) => {
  if (!startStr || !endStr) throw new Error("startDate and endDate required");

  const isDateOnly = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

  const start = new Date(startStr);
  const end = new Date(endStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error("Invalid date format");

  // if user sent date-only strings, make them full-day bounds
  const normStart = isDateOnly(startStr) ? new Date(start.setHours(0, 0, 0, 0)) : start;
  const normEnd = isDateOnly(endStr) ? new Date(end.setHours(23, 59, 59, 999)) : end;

  if (normStart > normEnd) throw new Error("startDate must be <= endDate");

  return { start: normStart, end: normEnd };
};

// Calculate receivables — but return ALL matching breakups (including paid/processing) and also computed totals.
// Important: caller will choose to include only unpaid breakups when creating statements.
export const calculateSellerReceivables = async (sellerId, start, end) => {
  // Accept sellerId possibly string/number
  const sellerIdNormalized = typeof sellerId === "number" ? sellerId : Number(sellerId) || sellerId;

  // Use the exact range passed by caller (no additional extension here).
  // Caller should call parseNormalizeRange to decide day-or-time behavior.
  const breakups = await BreakupFile.find({
    $or: [{ sellerId: sellerIdNormalized }, { sellerId: sellerIdNormalized.toString() }],
    breakupType: "parent",
    createdAt: { $gte: start, $lte: end },
  }).sort({ createdAt: 1 });

  let sellerNetReceivable = 0;
  let paidOrders = 0;
  let pendingOrders = 0;

  for (const b of breakups) {
    for (const line of b.lines || []) {
      if (line.category === "receivable") {
        sellerNetReceivable += Number(line.amount || 0);
      }
    }
    if (b.paymentStatus === "paid") paidOrders++;
    else pendingOrders++;
  }

  return {
    sellerNetReceivable,
    totalOrders: breakups.length,
    paidOrders,
    pendingOrders,
    breakups,
  };
};

// ---------- Creation controllers (normalized + dedupe + unpaid filtering) ----------

// 1) Individual seller
export const createAccountStatementForSeller = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const businessSellerId = Number(req.params.sellerId);
    if (isNaN(businessSellerId)) return res.status(400).json({ message: "Invalid sellerId" });

    const { start, end } = parseNormalizeRange(startDate, endDate);

    const seller = await Seller.findOne({ businessSellerId });
    if (!seller) return res.status(404).json({ message: "Seller not found" });

    // Get all breakups in range
    const allBreakups = await BreakupFile.find({
      $or: [{ sellerId: businessSellerId }, { sellerId: businessSellerId.toString() }],
      breakupType: "parent",
      createdAt: { $gte: start, $lte: end },
    }).sort({ createdAt: 1 });

    // Include only unpaid & unlinked breakups
    const unpaidBreakups = allBreakups.filter(
      (b) => b.paymentStatus !== "paid" && !b.linkedStatementId
    );

    if (!unpaidBreakups.length) {
      return res.status(400).json({ message: "No unpaid breakups in this range" });
    }

    // Create statement
    const orders = unpaidBreakups.map((b) => ({
      breakupId: b._id,
      orderId: b.orderId,
      sellerNetReceivable: b.lines
        .filter((l) => l.category === "receivable")
        .reduce((sum, l) => sum + Number(l.amount || 0), 0),
      orderDate: b.createdAt,
    }));

    const totalAmount = orders.reduce((sum, o) => sum + Number(o.sellerNetReceivable), 0);

    const statement = new AccountStatementSeller({
      businessSellerId,
      sellerName: seller.name,
      totalAmount,
      periodStart: start,
      periodEnd: end,
      orderCount: orders.length,
      paidOrders: 0,
      pendingOrders: orders.length,
      breakupIds: unpaidBreakups.map((b) => b._id),
      orders,
      status: "pending",
      generatedAt: new Date(),
    });

    await statement.save();

    // Mark only included breakups as processing
    await BreakupFile.updateMany(
      { _id: { $in: unpaidBreakups.map((b) => b._id) } },
      { $set: { paymentStatus: "processing", linkedStatementId: statement._id } }
    );

    return res.status(201).json({ success: true, data: statement });
  } catch (err) {
    console.error("createAccountStatementForSeller error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 2) Selected sellers (bulk)
export const createAccountStatementsForSelected = async (req, res) => {
  try {
    const { sellerIds, startDate, endDate } = req.body;
    if (!Array.isArray(sellerIds) || sellerIds.length === 0)
      return res.status(400).json({ message: "No sellerIds provided" });

    const { start, end } = parseNormalizeRange(startDate, endDate);

    const results = [];
    const conflicts = [];

    for (const id of sellerIds) {
      const businessSellerId = Number(id);
      if (isNaN(businessSellerId)) {
        conflicts.push({ id, reason: "invalid id" });
        continue;
      }

      const seller = await Seller.findOne({ businessSellerId });
      if (!seller) {
        conflicts.push({ businessSellerId, reason: "seller not found" });
        continue;
      }

      const allBreakups = await BreakupFile.find({
        $or: [{ sellerId: businessSellerId }, { sellerId: businessSellerId.toString() }],
        breakupType: "parent",
        createdAt: { $gte: start, $lte: end },
      }).sort({ createdAt: 1 });

      // Only unpaid & unlinked
      const unpaidBreakups = allBreakups.filter(
        (b) => b.paymentStatus !== "paid" && !b.linkedStatementId
      );

      if (!unpaidBreakups.length) {
        conflicts.push({ businessSellerId, reason: "no unpaid breakups in range" });
        continue;
      }

      const orders = unpaidBreakups.map((b) => ({
        breakupId: b._id,
        orderId: b.orderId,
        sellerNetReceivable: b.lines
          .filter((l) => l.category === "receivable")
          .reduce((s, l) => s + Number(l.amount || 0), 0),
        orderDate: b.createdAt,
      }));

      const totalAmount = orders.reduce((s, o) => s + Number(o.sellerNetReceivable || 0), 0);

      const statement = new AccountStatementSeller({
        businessSellerId,
        sellerName: seller.name,
        totalAmount,
        periodStart: start,
        periodEnd: end,
        orderCount: orders.length,
        paidOrders: 0,
        pendingOrders: orders.length,
        breakupIds: unpaidBreakups.map((b) => b._id),
        orders,
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

    return res.status(201).json({ success: true, created: results, conflicts });
  } catch (err) {
    console.error("createAccountStatementsForSelected error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 3) All sellers
export const createAccountStatementsForAll = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const { start, end } = parseNormalizeRange(startDate, endDate);

    const sellers = await Seller.find();
    const created = [];
    const skipped = [];

    for (const seller of sellers) {
      const businessSellerId = Number(seller.businessSellerId);
      if (isNaN(businessSellerId)) {
        skipped.push({ seller: seller._id, reason: "invalid businessSellerId" });
        continue;
      }

      // Get all breakups in the period
      const allBreakups = await BreakupFile.find({
        $or: [{ sellerId: businessSellerId }, { sellerId: businessSellerId.toString() }],
        breakupType: "parent",
        createdAt: { $gte: start, $lte: end },
      }).sort({ createdAt: 1 });

      // Only include unpaid & unlinked breakups
      const unpaidBreakups = allBreakups.filter(
        (b) => b.paymentStatus !== "paid" && !b.linkedStatementId
      );

      if (!unpaidBreakups.length) {
        skipped.push({ businessSellerId, reason: "no unpaid breakups in range" });
        continue;
      }

      // Build orders
      const orders = unpaidBreakups.map((b) => ({
        breakupId: b._id,
        orderId: b.orderId,
        sellerNetReceivable: b.lines
          .filter((l) => l.category === "receivable")
          .reduce((sum, l) => sum + Number(l.amount || 0), 0),
        orderDate: b.createdAt,
      }));

      const totalAmount = orders.reduce((sum, o) => sum + Number(o.sellerNetReceivable), 0);

      // Create statement
      const statement = new AccountStatementSeller({
        businessSellerId,
        sellerName: seller.name,
        totalAmount,
        periodStart: start,
        periodEnd: end,
        orderCount: orders.length,
        paidOrders: 0,
        pendingOrders: orders.length,
        breakupIds: unpaidBreakups.map((b) => b._id),
        orders,
        status: "pending",
        generatedAt: new Date(),
      });

      await statement.save();

      // Mark only included breakups as processing
      await BreakupFile.updateMany(
        { _id: { $in: unpaidBreakups.map((b) => b._id) } },
        { $set: { paymentStatus: "processing", linkedStatementId: statement._id } }
      );

      created.push(statement);
    }

    return res.status(201).json({ success: true, created, skipped });
  } catch (err) {
    console.error("createAccountStatementsForAll error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ---------- Send statements to business (mark paid, update sellers & breakups) ----------
export const sendAccountStatementsToBusiness = async (req, res) => {
  try {
    const { businessSellerId, businessSellerIds, all } = req.body;

    if (!all && !businessSellerId && (!businessSellerIds || businessSellerIds.length === 0)) {
      return res.status(400).json({ success: false, message: "Provide either businessSellerId, businessSellerIds[], or set all=true." });
    }

    const filter = { status: "pending" };
    if (businessSellerId) filter.businessSellerId = businessSellerId;
    else if (Array.isArray(businessSellerIds) && businessSellerIds.length > 0)
      filter.businessSellerId = { $in: businessSellerIds };

    const statements = await AccountStatementSeller.find(filter);
    if (!statements.length) return res.status(404).json({ success: false, message: "No pending account statements found." });

    const results = [];
    const failed = [];

    for (const st of statements) {
      try {
        // Build payload sent to business (you can customize)
        const payload = {
          businessSellerId: st.businessSellerId,
          sellerName: st.sellerName,
          periodStart: st.periodStart,
          periodEnd: st.periodEnd,
          totalAmount: st.totalAmount,
          orders: st.orders,
          generatedAt: st.generatedAt,
        };

        // Replace this with your real send call
        const fakeReq = { body: { accountStatements: [payload] } };
        const fakeRes = {
          status: (code) => ({ json: (data) => console.log(`Response (${code}):`, data) }),
        };
        await receiveAccountStatements(fakeReq, fakeRes); // if exists

        // Mark statement as paid
        const referenceId = `BUS-${Date.now()}`;
        const now = new Date();
        await AccountStatementSeller.findByIdAndUpdate(st._id, {
          status: "paid",
          referenceId,
          paidAt: now,
          madeAt: st.madeAt || now,
        });

        // Mark associated breakups as paid
        if (Array.isArray(st.breakupIds) && st.breakupIds.length) {
          await BreakupFile.updateMany(
            { _id: { $in: st.breakupIds } },
            { $set: { paymentStatus: "paid", paidAt: now } }
          );
        }

        // Update seller financials (safe increments)
        const totalPaidAmount = Number(st.totalAmount || 0);
        const totalPaidOrders = st.orders?.length || 0;
        await Seller.findOneAndUpdate(
          { businessSellerId: st.businessSellerId },
          {
            $inc: {
              paidReceivableAmount: totalPaidAmount,
              paidOrders: totalPaidOrders,
            },
            $set: {
              lastPaymentDate: now,
              lastUpdated: now,
            },
          },
          { new: true }
        );

        results.push({ id: st._id, businessSellerId: st.businessSellerId, sellerName: st.sellerName, status: "paid", referenceId });
      } catch (err) {
        console.error("sendAccountStatementsToBusiness failed for", st.businessSellerId, err);
        failed.push({ businessSellerId: st.businessSellerId, error: err.message });
      }
    }

    return res.status(200).json({ success: true, results, failed });
  } catch (err) {
    console.error("sendAccountStatementsToBusiness error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Reverse operation: unmark breakups and rollback seller financials (safe non-negative)
export const reverseAccountStatement = async (statement) => {
  try {
    // Revert BreakupFile statuses
    if (Array.isArray(statement.breakupIds) && statement.breakupIds.length) {
      await BreakupFile.updateMany(
        { _id: { $in: statement.breakupIds } },
        { $set: { paymentStatus: "unpaid", linkedStatementId: null, paidAt: null } }
      );
    }

    // Revert seller financials (only if the statement was 'paid' previously)
    if (statement.status === "paid") {
      const seller = await Seller.findOne({ businessSellerId: statement.businessSellerId });
      if (seller) {
        // decide which fields you actually update in Seller model; use safe decrements
        const decAmount = Number(statement.totalAmount || 0);
        const decOrders = statement.orders?.length || 0;

        // Example fields from your Seller schema: paidReceivableAmount, paidOrders, remainingReceivableAmount, currentBalance
        const newPaidReceivable = Math.max(0, (seller.paidReceivableAmount || 0) - decAmount);
        const newPaidOrders = Math.max(0, (seller.paidOrders || 0) - decOrders);

        // Try to increment back remainingReceivableAmount and currentBalance conservatively:
        const newRemaining = Math.max(0, (seller.remainingReceivableAmount || 0) + decAmount);
        const newBalance = (typeof seller.currentBalance === "number") ? seller.currentBalance + decAmount : seller.currentBalance;

        await Seller.updateOne(
          { businessSellerId: statement.businessSellerId },
          {
            $set: {
              paidReceivableAmount: newPaidReceivable,
              paidOrders: newPaidOrders,
              remainingReceivableAmount: newRemaining,
              currentBalance: newBalance,
              lastUpdated: new Date(),
            },
          }
        );
      }
    }

    return true;
  } catch (err) {
    console.error("reverseAccountStatement error:", err);
    throw err;
  }
};

export const deleteAccountStatement = async (req, res) => {
  try {
    const { id } = req.params;
    const statement = await AccountStatementSeller.findById(id);
    if (!statement) return res.status(404).json({ success: false, message: "Statement not found" });

    // Reverse financial effects / breakup flags
    await reverseAccountStatement(statement);

    // Remove the statement
    await AccountStatementSeller.findByIdAndDelete(id);

    return res.status(200).json({ success: true, message: "Account statement deleted and reversed" });
  } catch (err) {
    console.error("deleteAccountStatement error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Controller to get orders grouped by payment status
export const getSellerOrdersStatus = async (req, res) => {
  try {
    const businessSellerId = Number(req.params.sellerId);
    if (isNaN(businessSellerId)) {
      return res.status(400).json({ success: false, message: "Invalid sellerId" });
    }

    // Fetch ONLY parent-type breakups for this seller
    const breakups = await BreakupFile.find({
      sellerId: businessSellerId,
      breakupType: "parent"       // <-- IMPORTANT
    }).sort({ createdAt: -1 });

    const paid = [];
    const unpaid = [];
    const processing = [];

    breakups.forEach((b) => {
      const orderObj = {
        breakupId: b._id,
        orderId: b.orderId,
        orderType: b.orderType,
        orderAmount: b.orderAmount,
        actualAmount: b.actualAmount,
        buyerId: b.buyerId,
        sellerId: b.sellerId,
        breakupType: b.breakupType,  // always "parent"
        lines: b.lines,
        totalDebit: b.totalDebit,
        totalCredit: b.totalCredit,
        paymentStatus: b.paymentStatus,
        paymentClearedDate: b.paymentClearedDate,
        linkedStatementId: b.linkedStatementId,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      };

      if (b.paymentStatus === "paid") {
        paid.push(orderObj);
      } else if (b.paymentStatus === "processing") {
        processing.push(orderObj);
      } else {
        // unpaid
        unpaid.push(orderObj);
      }
    });

    return res.status(200).json({
      success: true,
      sellerId: businessSellerId,
      paid,
      processing,
      unpaid,
    });
  } catch (err) {
    console.error("getSellerOrdersStatus error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};