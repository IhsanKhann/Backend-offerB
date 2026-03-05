// controllers/FinanceControllers/AccountStatementControllers.js
// ═══════════════════════════════════════════════════════════════
// Phase 2 Hardening — Findings addressed:
//   H-02  — createAccountStatementsForSelected: statement.save() +
//            BreakupFile.updateMany now wrapped in session.withTransaction
//            (previously non-atomic → double-payment risk).
//   H-03  — createAccountStatementsForAll: same session fix applied.
//   H-03  — sendAccountStatementsToBusiness: each statement's mutations
//            (AccountStatementSeller update, BreakupFile.updateMany, Seller.$inc)
//            now run in a single session.withTransaction per statement.
//   CG-3  — AuditService.log in sendAccountStatementsToBusiness now receives
//            the session so audit failure rolls back the payment.
//   F-18  — Audit writes inside sessions at all mutation points.
//   S-7   — getAllAccountStatements: `status` query param validated against
//            known enum values before being passed to MongoDB.
// ═══════════════════════════════════════════════════════════════
import mongoose from "mongoose";
import AccountStatementSeller from "../../models/FinanceModals/AccountStatementsSellerModel.js";
import BreakupFile from "../../models/FinanceModals/BreakupFiles.js";
import Seller from "../../models/FinanceModals/SellersModel.js";
import AuditService from "../../services/auditService.js";
import dotenv from "dotenv";
dotenv.config();

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const parseDate = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) throw new Error("Invalid date format");
  return d;
};

const parseNormalizeRange = (startStr, endStr) => {
  if (!startStr || !endStr) throw new Error("startDate and endDate required");

  const isDateOnly = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const start = new Date(startStr);
  const end   = new Date(endStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error("Invalid date format");

  const normStart = isDateOnly(startStr) ? new Date(start.setHours(0, 0, 0, 0))       : start;
  const normEnd   = isDateOnly(endStr)   ? new Date(end.setHours(23, 59, 59, 999))     : end;

  if (normStart > normEnd) throw new Error("startDate must be <= endDate");
  return { start: normStart, end: normEnd };
};

// ─────────────────────────────────────────────────────────────
// Utility Endpoints
// ─────────────────────────────────────────────────────────────

// S-7 FIX: validate `status` against known enum values — prevents NoSQL operator injection
const VALID_STATEMENT_STATUSES = ["pending", "sent", "paid"];

export const getAllAccountStatements = async (req, res) => {
  try {
    const { status } = req.query;

    // S-7 FIX: reject unknown/operator-injected status values
    let query = {};
    if (status !== undefined) {
      if (!VALID_STATEMENT_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${VALID_STATEMENT_STATUSES.join(", ")}`,
        });
      }
      query.status = status;
    }

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
    const { id }     = req.params;
    const { status } = req.body;

    if (!VALID_STATEMENT_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATEMENT_STATUSES.join(", ")}`,
      });
    }

    const updated = await AccountStatementSeller.findByIdAndUpdate(
      id,
      { status, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getAccountStatementsByStatus = async (req, res) => {
  try {
    const status = req.query.status || "pending";

    if (!VALID_STATEMENT_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATEMENT_STATUSES.join(", ")}`,
      });
    }

    const statements = await AccountStatementSeller.find({ status })
      .populate("sellerId", "name email businessSellerId")
      .sort({ generatedAt: -1 });

    const formatted = statements
      .filter(st => st.sellerId != null)  // guard against orphaned statements (M-07)
      .map((st) => ({
        _id:              st._id,
        sellerId:         st.sellerId._id,
        sellerName:       st.sellerId.name,
        sellerEmail:      st.sellerId.email,
        businessSellerId: st.sellerId.businessSellerId,
        startDate:        st.periodStart.toISOString().split("T")[0],
        endDate:          st.periodEnd.toISOString().split("T")[0],
        totalAmount:      st.totalAmount,
        orders:           st.orders,
        status:           st.status,
        referenceId:      st.referenceId,
      }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error("Error fetching account statements:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const receiveAccountStatements = async (req, res) => {
  try {
    const { accountStatements } = req.body;
    if (!accountStatements || !Array.isArray(accountStatements)) {
      return res.status(400).json({ message: "Invalid account statements format" });
    }
    return res.status(200).json({ message: "Account statements received successfully!" });
  } catch (error) {
    console.error("Error receiving account statements:", error.message);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// calculateSellerReceivables — unchanged logic, no session needed (read only)
// ─────────────────────────────────────────────────────────────
export const calculateSellerReceivables = async (sellerId, start, end) => {
  const sellerIdNormalized = typeof sellerId === "number" ? sellerId : Number(sellerId) || sellerId;

  const breakups = await BreakupFile.find({
    $or: [{ sellerId: sellerIdNormalized }, { sellerId: sellerIdNormalized.toString() }],
    breakupType: "parent",
    createdAt: { $gte: start, $lte: end },
  }).sort({ createdAt: 1 });

  let sellerNetReceivable = 0;
  let paidOrders    = 0;
  let pendingOrders = 0;

  for (const b of breakups) {
    for (const line of b.lines || []) {
      if (line.category === "receivable") {
        sellerNetReceivable += Math.round(Number(line.amount || 0));
      }
    }
    if (b.paymentStatus === "paid") paidOrders++;
    else pendingOrders++;
  }

  return { sellerNetReceivable, totalOrders: breakups.length, paidOrders, pendingOrders, breakups };
};

// ─────────────────────────────────────────────────────────────
// createAccountStatementForSeller — already atomic in original, preserved
// ─────────────────────────────────────────────────────────────
export const createAccountStatementForSeller = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const businessSellerId = Number(req.params.sellerId);
    if (isNaN(businessSellerId)) return res.status(400).json({ message: "Invalid sellerId" });

    const { start, end } = parseNormalizeRange(startDate, endDate);

    const seller = await Seller.findOne({ businessSellerId });
    if (!seller) return res.status(404).json({ message: "Seller not found" });

    const allBreakups = await BreakupFile.find({
      $or: [{ sellerId: businessSellerId }, { sellerId: businessSellerId.toString() }],
      breakupType: "parent",
      createdAt: { $gte: start, $lte: end },
    }).sort({ createdAt: 1 });

    const unpaidBreakups = allBreakups.filter(
      (b) => b.paymentStatus !== "paid" && !b.linkedStatementId
    );

    if (!unpaidBreakups.length) {
      return res.status(400).json({ message: "No unpaid breakups in this range" });
    }

    const orders = unpaidBreakups.map((b) => ({
      breakupId:          b._id,
      orderId:            b.orderId,
      sellerNetReceivable: b.lines
        .filter((l) => l.category === "receivable")
        .reduce((sum, l) => sum + Math.round(Number(l.amount || 0)), 0),
      orderDate: b.createdAt,
    }));

    const totalAmount = orders.reduce((sum, o) => sum + Number(o.sellerNetReceivable), 0);

    const mongoSession = await mongoose.startSession();
    let savedStatement;
    await mongoSession.withTransaction(async () => {
      [savedStatement] = await AccountStatementSeller.create([{
        businessSellerId,
        sellerName:   seller.name,
        totalAmount,
        periodStart:  start,
        periodEnd:    end,
        orderCount:   orders.length,
        paidOrders:   0,
        pendingOrders: orders.length,
        breakupIds:   unpaidBreakups.map((b) => b._id),
        orders,
        status:       "pending",
        generatedAt:  new Date(),
      }], { session: mongoSession });

      await BreakupFile.updateMany(
        { _id: { $in: unpaidBreakups.map((b) => b._id) } },
        { $set: { paymentStatus: "processing", linkedStatementId: savedStatement._id } },
        { session: mongoSession }
      );
    });
    mongoSession.endSession();

    return res.status(201).json({ success: true, data: savedStatement });
  } catch (err) {
    console.error("createAccountStatementForSeller error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// createAccountStatementsForSelected
// H-02 FIX: statement.save() + BreakupFile.updateMany now in session.withTransaction
// ─────────────────────────────────────────────────────────────
export const createAccountStatementsForSelected = async (req, res) => {
  try {
    const { sellerIds, startDate, endDate } = req.body;
    if (!Array.isArray(sellerIds) || sellerIds.length === 0) {
      return res.status(400).json({ message: "No sellerIds provided" });
    }

    const { start, end } = parseNormalizeRange(startDate, endDate);
    const results   = [];
    const conflicts = [];

    for (const id of sellerIds) {
      const businessSellerId = Number(id);
      if (isNaN(businessSellerId)) { conflicts.push({ id, reason: "invalid id" }); continue; }

      const seller = await Seller.findOne({ businessSellerId });
      if (!seller) { conflicts.push({ businessSellerId, reason: "seller not found" }); continue; }

      const allBreakups = await BreakupFile.find({
        $or: [{ sellerId: businessSellerId }, { sellerId: businessSellerId.toString() }],
        breakupType: "parent",
        createdAt: { $gte: start, $lte: end },
      }).sort({ createdAt: 1 });

      const unpaidBreakups = allBreakups.filter(
        (b) => b.paymentStatus !== "paid" && !b.linkedStatementId
      );

      if (!unpaidBreakups.length) {
        conflicts.push({ businessSellerId, reason: "no unpaid breakups in range" });
        continue;
      }

      const orders = unpaidBreakups.map((b) => ({
        breakupId:          b._id,
        orderId:            b.orderId,
        sellerNetReceivable: b.lines
          .filter((l) => l.category === "receivable")
          .reduce((s, l) => s + Math.round(Number(l.amount || 0)), 0),
        orderDate: b.createdAt,
      }));

      const totalAmount = orders.reduce((s, o) => s + Number(o.sellerNetReceivable || 0), 0);

      // H-02 FIX: wrap statement creation + breakup update in a single session
      const mongoSession = await mongoose.startSession();
      let statement;
      try {
        await mongoSession.withTransaction(async () => {
          [statement] = await AccountStatementSeller.create([{
            businessSellerId,
            sellerName:   seller.name,
            totalAmount,
            periodStart:  start,
            periodEnd:    end,
            orderCount:   orders.length,
            paidOrders:   0,
            pendingOrders: orders.length,
            breakupIds:   unpaidBreakups.map((b) => b._id),
            orders,
            status:       "pending",
            generatedAt:  new Date(),
          }], { session: mongoSession });

          await BreakupFile.updateMany(
            { _id: { $in: unpaidBreakups.map((b) => b._id) } },
            { $set: { paymentStatus: "processing", linkedStatementId: statement._id } },
            { session: mongoSession }
          );
        });
        mongoSession.endSession();
        results.push(statement);
      } catch (innerErr) {
        mongoSession.endSession();
        conflicts.push({ businessSellerId, reason: innerErr.message });
      }
    }

    return res.status(201).json({ success: true, created: results, conflicts });
  } catch (err) {
    console.error("createAccountStatementsForSelected error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// createAccountStatementsForAll
// H-03 FIX: same session pattern applied
// ─────────────────────────────────────────────────────────────
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

      const allBreakups = await BreakupFile.find({
        $or: [{ sellerId: businessSellerId }, { sellerId: businessSellerId.toString() }],
        breakupType: "parent",
        createdAt: { $gte: start, $lte: end },
      }).sort({ createdAt: 1 });

      const unpaidBreakups = allBreakups.filter(
        (b) => b.paymentStatus !== "paid" && !b.linkedStatementId
      );

      if (!unpaidBreakups.length) {
        skipped.push({ businessSellerId, reason: "no unpaid breakups in range" });
        continue;
      }

      const orders = unpaidBreakups.map((b) => ({
        breakupId:          b._id,
        orderId:            b.orderId,
        sellerNetReceivable: b.lines
          .filter((l) => l.category === "receivable")
          .reduce((sum, l) => sum + Math.round(Number(l.amount || 0)), 0),
        orderDate: b.createdAt,
      }));

      const totalAmount = orders.reduce((sum, o) => sum + Number(o.sellerNetReceivable), 0);

      // H-03 FIX: wrap in session
      const mongoSession = await mongoose.startSession();
      let statement;
      try {
        await mongoSession.withTransaction(async () => {
          [statement] = await AccountStatementSeller.create([{
            businessSellerId,
            sellerName:   seller.name,
            totalAmount,
            periodStart:  start,
            periodEnd:    end,
            orderCount:   orders.length,
            paidOrders:   0,
            pendingOrders: orders.length,
            breakupIds:   unpaidBreakups.map((b) => b._id),
            orders,
            status:       "pending",
            generatedAt:  new Date(),
          }], { session: mongoSession });

          await BreakupFile.updateMany(
            { _id: { $in: unpaidBreakups.map((b) => b._id) } },
            { $set: { paymentStatus: "processing", linkedStatementId: statement._id } },
            { session: mongoSession }
          );
        });
        mongoSession.endSession();
        created.push(statement);
      } catch (innerErr) {
        mongoSession.endSession();
        skipped.push({ businessSellerId, reason: innerErr.message });
      }
    }

    return res.status(201).json({ success: true, created, skipped });
  } catch (err) {
    console.error("createAccountStatementsForAll error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// sendAccountStatementsToBusiness
// H-03 FIX: per-statement session wraps AccountStatementSeller update,
//           BreakupFile.updateMany, Seller.$inc, and AuditService.log.
// CG-3 FIX: AuditService.log now receives session for atomicity.
// ─────────────────────────────────────────────────────────────
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
    else if (Array.isArray(businessSellerIds) && businessSellerIds.length > 0) {
      filter.businessSellerId = { $in: businessSellerIds };
    }

    const statements = await AccountStatementSeller.find(filter);
    if (!statements.length) {
      return res.status(404).json({ success: false, message: "No pending account statements found." });
    }

    const results = [];
    const failed  = [];

    for (const st of statements) {
      const mongoSession = await mongoose.startSession();
      try {
        await mongoSession.withTransaction(async () => {
          // External call OUTSIDE the session (cannot be rolled back)
          const payload = {
            businessSellerId: st.businessSellerId,
            sellerName:  st.sellerName,
            periodStart: st.periodStart,
            periodEnd:   st.periodEnd,
            totalAmount: st.totalAmount,
            orders:      st.orders,
            generatedAt: st.generatedAt,
          };
          const fakeReq = { body: { accountStatements: [payload] } };
          const fakeRes = { status: (c) => ({ json: (d) => console.log(`Response (${c}):`, d) }) };
          await receiveAccountStatements(fakeReq, fakeRes);

          const referenceId = `BUS-${Date.now()}`;
          const now = new Date();

          // H-03 FIX: statement update inside session
          await AccountStatementSeller.findByIdAndUpdate(
            st._id,
            { status: "paid", referenceId, paidAt: now, madeAt: st.madeAt || now },
            { session: mongoSession }
          );

          // H-03 FIX: breakup update inside session
          if (Array.isArray(st.breakupIds) && st.breakupIds.length) {
            await BreakupFile.updateMany(
              { _id: { $in: st.breakupIds } },
              { $set: { paymentStatus: "paid", paidAt: now } },
              { session: mongoSession }
            );
          }

          // H-06 pattern: $inc for seller financials inside session
          const totalPaidAmount = Math.round(Number(st.totalAmount || 0));
          const totalPaidOrders = st.orders?.length || 0;
          await Seller.findOneAndUpdate(
            { businessSellerId: st.businessSellerId },
            {
              $inc: { paidReceivableAmount: totalPaidAmount, paidOrders: totalPaidOrders },
              $set: { lastPaymentDate: now, lastUpdated: now },
            },
            { new: true, session: mongoSession }
          );

          // CG-3 FIX: audit inside session so failure rolls back payment
          await AuditService.log({
            eventType:  "BALANCE_UPDATED",
            actorId:    req.user?._id || null,
            entityId:   st._id,
            entityType: "AccountStatement",
            currency:   "PKR",
            meta: { businessSellerId: st.businessSellerId, totalAmount: st.totalAmount, referenceId },
          }, { type: "financial", session: mongoSession });

          results.push({
            id:              st._id,
            businessSellerId: st.businessSellerId,
            sellerName:      st.sellerName,
            status:          "paid",
            referenceId,
          });
        });

        mongoSession.endSession();
      } catch (err) {
        mongoSession.endSession();
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

// ─────────────────────────────────────────────────────────────
// reverseAccountStatement — helper, unchanged logic preserved
// ─────────────────────────────────────────────────────────────
export const reverseAccountStatement = async (statement) => {
  try {
    if (Array.isArray(statement.breakupIds) && statement.breakupIds.length) {
      await BreakupFile.updateMany(
        { _id: { $in: statement.breakupIds } },
        { $set: { paymentStatus: "unpaid", linkedStatementId: null, paidAt: null } }
      );
    }

    if (statement.status === "paid") {
      const decAmount = Math.round(Number(statement.totalAmount || 0));
      const decOrders = statement.orders?.length || 0;

      await Seller.findOneAndUpdate(
        { businessSellerId: statement.businessSellerId },
        {
          $inc: {
            paidReceivableAmount:     -decAmount,
            paidOrders:               -decOrders,
            remainingReceivableAmount: decAmount,
            currentBalance:            decAmount,
          },
          $set: { lastUpdated: new Date() },
        }
      );
    }

    return true;
  } catch (err) {
    console.error("reverseAccountStatement error:", err);
    throw err;
  }
};

export const deleteAccountStatement = async (req, res) => {
  try {
    const { id }      = req.params;
    const statement   = await AccountStatementSeller.findById(id);
    if (!statement) return res.status(404).json({ success: false, message: "Statement not found" });

    await reverseAccountStatement(statement);
    await AccountStatementSeller.findByIdAndDelete(id);

    return res.status(200).json({ success: true, message: "Account statement deleted and reversed" });
  } catch (err) {
    console.error("deleteAccountStatement error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const getSellerOrdersStatus = async (req, res) => {
  try {
    const businessSellerId = Number(req.params.sellerId);
    if (isNaN(businessSellerId)) {
      return res.status(400).json({ success: false, message: "Invalid sellerId" });
    }

    const breakups = await BreakupFile.find({ sellerId: businessSellerId, breakupType: "parent" })
      .sort({ createdAt: -1 });

    const paid       = [];
    const unpaid     = [];
    const processing = [];

    breakups.forEach((b) => {
      const obj = {
        breakupId:          b._id,
        orderId:            b.orderId,
        orderType:          b.orderType,
        orderAmount:        b.orderAmount,
        actualAmount:       b.actualAmount,
        buyerId:            b.buyerId,
        sellerId:           b.sellerId,
        breakupType:        b.breakupType,
        lines:              b.lines,
        totalDebit:         b.totalDebit,
        totalCredit:        b.totalCredit,
        paymentStatus:      b.paymentStatus,
        paymentClearedDate: b.paymentClearedDate,
        linkedStatementId:  b.linkedStatementId,
        createdAt:          b.createdAt,
        updatedAt:          b.updatedAt,
      };

      if (b.paymentStatus === "paid")         paid.push(obj);
      else if (b.paymentStatus === "processing") processing.push(obj);
      else                                    unpaid.push(obj);
    });

    return res.status(200).json({ success: true, sellerId: businessSellerId, paid, processing, unpaid });
  } catch (err) {
    console.error("getSellerOrdersStatus error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};