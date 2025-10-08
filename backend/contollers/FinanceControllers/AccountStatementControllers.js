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
