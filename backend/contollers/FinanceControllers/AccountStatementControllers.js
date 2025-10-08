import AccountStatementSeller from "../../models/FinanceModals/AccountStatementsSellerModel.js";
import BreakupFile from "../../models/FinanceModals/BreakupFiles.js";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

// Helper: group breakups by sellerId
function groupBySeller(breakups) {
  const grouped = {};
  breakups.forEach((b) => {
    if (!grouped[b.sellerId]) grouped[b.sellerId] = [];
    grouped[b.sellerId].push(b);
  });
  return grouped;
}

// create Account Statement for all sellers
export const createAccountStatementForAll = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    const breakupFiles = await BreakupFile.find({
      orderDate: { $gte: startDate, $lte: endDate },
    });

    const grouped = groupBySeller(breakupFiles);

    const statements = [];

    for (const sellerId in grouped) {
      const sellerBreakups = grouped[sellerId];
      const totalAmount = sellerBreakups.reduce(
        (sum, b) => sum + b.sellerNetReceivable,
        0
      );

      const statement = new AccountStatementSeller({
        sellerId,
        periodStart: startDate,
        periodEnd: endDate,
        totalAmount,
        orders: sellerBreakups.map((b) => ({
          orderId: b.orderId,
          sellerNetReceivable: b.sellerNetReceivable,
          orderDate: b.orderDate,
        })),
      });

      await statement.save();
      statements.push(statement);
    }

    return res.status(201).json({
      success: true,
      message: "Account statements generated successfully",
      count: statements.length,
      statements,
    });
  } catch (error) {
    console.error("Error generating statements:", error);
    res.status(500).json({ error: error.message });
  }
};

// create Account Statement for one single seller
export const createAccountStatementForSeller = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { startDate, endDate } = req.body;

    const breakupFiles = await BreakupFile.find({
      sellerId,
      orderDate: { $gte: startDate, $lte: endDate },
    });

    const totalAmount = breakupFiles.reduce(
      (sum, b) => sum + b.sellerNetReceivable,
      0
    );

    const statement = await AccountStatementSeller.create({
      sellerId,
      periodStart: startDate,
      periodEnd: endDate,
      totalAmount,
      orders: breakupFiles.map((b) => ({
        orderId: b.orderId,
        sellerNetReceivable: b.sellerNetReceivable,
        orderDate: b.orderDate,
      })),
    });

    res.status(201).json({ success: true, statement });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 👥 Create account statements for selected sellers
export const createAccountStatementForSelected = async (req, res) => {
  try {
    const { sellerIds, startDate, endDate } = req.body;
    const breakupFiles = await BreakupFile.find({
      sellerId: { $in: sellerIds },
      orderDate: { $gte: startDate, $lte: endDate },
    });

    const grouped = groupBySeller(breakupFiles);
    const statements = [];

    for (const sellerId of sellerIds) {
      const sellerBreakups = grouped[sellerId] || [];
      if (sellerBreakups.length === 0) continue;

      const totalAmount = sellerBreakups.reduce(
        (sum, b) => sum + b.sellerNetReceivable,
        0
      );

      const statement = new AccountStatementSeller({
        sellerId,
        periodStart: startDate,
        periodEnd: endDate,
        totalAmount,
        orders: sellerBreakups.map((b) => ({
          orderId: b.orderId,
          sellerNetReceivable: b.sellerNetReceivable,
          orderDate: b.orderDate,
        })),
      });

      await statement.save();
      statements.push(statement);
    }

    res.status(201).json({
      success: true,
      count: statements.length,
      statements,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// send account Statements to bussiness side api - call the bussiness api.
export const sendAccountStatementsToBusiness = async (req, res) => {
  try {
    const { ids } = req.body; // list of statement IDs to send

    const statements = await AccountStatementSeller.find({ _id: { $in: ids } });

    const results = [];

    for (const st of statements) {
      const response = await axios.post(
        `${process.env.BUSINESS_API_BASE}/payments/account-statement`,
        st
      );

      await AccountStatement.findByIdAndUpdate(st._id, {
        status: "sent",
        referenceId: response.data.referenceId,
      });

      results.push({
        id: st._id,
        status: "sent",
        referenceId: response.data.referenceId,
      });
    }

    res.status(200).json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 1️⃣ Fetch all account statements
export const getAllAccountStatements = async (req, res) => {
  try {
    const { status } = req.query; // optional filter (e.g. ?status=pending)
    const query = status ? { status } : {};
    const statements = await AccountStatementSeller.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: statements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2️⃣ Fetch a single account statement
export const getSingleAccountStatement = async (req, res) => {
  try {
    const { id } = req.params;
    const statement = await AccountStatementSeller.findById(id);
    if (!statement) return res.status(404).json({ message: "Statement not found" });
    res.status(200).json({ success: true, data: statement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3️⃣ Update statement status (e.g. mark as paid)
export const updateAccountStatementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await AccountStatementSeller.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const testStatements = [
  {
    sellerId: "68e55612de71cd2a235943a2",
    periodStart: new Date("2025-09-01"),
    periodEnd: new Date("2025-09-15"),
    totalAmount: 32000,
    orders: [
      { orderId: "ORD-1001", sellerNetReceivable: 12000, orderDate: new Date("2025-09-03") },
      { orderId: "ORD-1002", sellerNetReceivable: 20000, orderDate: new Date("2025-09-10") },
    ],
    status: "sent",
    referenceId: "REF-SENT-001"
  },
  {
    sellerId: "68e55612de71cd2a235943a2",
    periodStart: new Date("2025-09-16"),
    periodEnd: new Date("2025-09-30"),
    totalAmount: 27000,
    orders: [
      { orderId: "ORD-1010", sellerNetReceivable: 15000, orderDate: new Date("2025-09-20") },
      { orderId: "ORD-1011", sellerNetReceivable: 12000, orderDate: new Date("2025-09-25") },
    ],
    status: "paid",
    referenceId: "REF-PAID-001"
  },
  // Add other sellers' statements as needed...
];

export const initializeAccountStatements = async (req, res) => {
  try {
    // Optional: clear existing statements first
    await AccountStatementSeller.deleteMany({});

    // Insert test statements
    const inserted = await AccountStatementSeller.insertMany(testStatements);

    res.status(200).json({
      success: true,
      message: "Account statements collection initialized successfully!",
      data: inserted,
    });
  } catch (error) {
    console.error("Error initializing account statements:", error);
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