// controllers/FinanceControllers/SummaryController.js
import mongoose from "mongoose";
import SummaryModel from "../../models/FinanceModals/SummaryModel.js";
import SummaryFieldLineInstance from "../../models/FinanceModals/FieldLineInstanceModel.js";
import TransactionModel from "../../models/FinanceModals/TransactionModel.js";
import SummaryFieldLineDefinition from "../../models/FinanceModals/FieldLineDefinitionModel.js";
import BreakupRule from "../../models/FinanceModals/BreakupRules.js";
import BreakupFile from "../../models/FinanceModals/BreakupFiles.js";

/**
 * Get all summaries (minimal)
 */
export const getAllSummaries = async (req, res) => {
  try {
    const summaries = await SummaryModel.find({}, "_id name").lean();
    return res.status(200).json({ success: true, data: summaries });
  } catch (err) {
    console.error("[getAllSummaries] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch summaries" });
  }
};

/**
 * Reset all balances to 0
 */
export const summariesReset = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    console.log("[summariesReset] Resetting all summaries and field lines");

    const sRes = await SummaryModel.updateMany({}, { $set: { startingBalance: 0, endingBalance: 0 } }, { session });
    const fRes = await SummaryFieldLineInstance.updateMany({}, { $set: { balance: 0 } }, { session });

    console.log(`[summariesReset] Updated ${sRes.modifiedCount} summaries, ${fRes.modifiedCount} field lines`);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ success: true, message: "All summaries and field lines reset to 0." });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("[summariesReset] Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Initialize capital & cash summaries
 */
export const summariesInitCapitalCash = async (req, res) => {
  try {
    console.log("[summariesInitCapitalCash] Body:", req.body);
    const { capitalAmount, cashAmount } = req.body;

    if (typeof capitalAmount !== "number" || typeof cashAmount !== "number") {
      return res.status(400).json({ success: false, message: "capitalAmount and cashAmount must be numbers." });
    }

    const [capitalSummary, cashSummary] = await Promise.all([
      SummaryModel.findOne({ summaryId: 1600 }),
      SummaryModel.findOne({ summaryId: 1500 }),
    ]);

    if (!capitalSummary || !cashSummary) {
      return res.status(404).json({ success: false, message: "Capital or Cash summary not found." });
    }

    await Promise.all([
      SummaryModel.updateOne({ _id: capitalSummary._id }, { $set: { startingBalance: capitalAmount, endingBalance: capitalAmount } }),
      SummaryModel.updateOne({ _id: cashSummary._id }, { $set: { startingBalance: cashAmount, endingBalance: cashAmount } }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Capital and Cash initialized successfully",
      data: { capital: capitalAmount, cash: cashAmount },
    });
  } catch (err) {
    console.error("[summariesInitCapitalCash] Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get a single summary by ID
 */
export const getSummaryById = async (req, res) => {
  try {
    const { summaryId } = req.params;
    const summary = await SummaryModel.findById(summaryId).lean();

    if (!summary) {
      return res.status(404).json({ success: false, message: "Summary not found" });
    }

    return res.status(200).json({ success: true, data: summary });
  } catch (err) {
    console.error("[getSummaryById] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch summary" });
  }
};

/**
 * Get summaries with their field lines
 */
export const summariesGetWithFieldLines = async (req, res) => {
  try {
    console.log("[summariesGetWithFieldLines] Fetching summaries + field lines");

    const summaries = await SummaryModel.find().lean();
    const fieldLines = await SummaryFieldLineInstance.find()
      .populate("definitionId", "fieldLineNumericId name accountNumber")
      .lean();

    const fieldLinesBySummary = {};
    fieldLines.forEach((line) => {
      const sid = line.summaryId.toString();
      if (!fieldLinesBySummary[sid]) fieldLinesBySummary[sid] = [];

      fieldLinesBySummary[sid].push({
        id: line._id,
        fieldLineNumericId: line.definitionId?.fieldLineNumericId || line.fieldLineNumericId,
        name: line.definitionId?.name || "Unnamed",
        accountNumber: line.definitionId?.accountNumber || "-",
        balance: line.balance || 0,
      });
    });

    const result = summaries.map((summary) => ({
      ...summary,
      fieldLines: fieldLinesBySummary[summary._id.toString()] || [],
    }));

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("[summariesGetWithFieldLines] Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Get all field line instances (across all summaries)
 */
export const summariesGetAllFieldLines = async (req, res) => {
  try {
    console.log("[summariesGetAllFieldLines] Fetching all field lines");

    const fieldLines = await SummaryFieldLineInstance.find()
      .populate("definitionId", "fieldLineNumericId name accountNumber")
      .populate("summaryId", "summaryId name accountType")
      .lean();

    return res.status(200).json({
      success: true,
      data: fieldLines.map((line) => ({
        id: line._id,
        summary: line.summaryId,
        definition: line.definitionId,
        fieldLineNumericId: line.fieldLineNumericId,
        name: line.name,
        balance: line.balance,
      })),
    });
  } catch (err) {
    console.error("[summariesGetAllFieldLines] Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Create a new field line definition
 */
export const summariesCreateDefinition = async (req, res) => {
  try {
    const { fieldLineNumericId, name, accountNumber } = req.body;

    if (!fieldLineNumericId || !name || !accountNumber) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const fieldDefinition = new SummaryFieldLineDefinition({
      fieldLineNumericId,
      name,
      accountNumber,
    });

    await fieldDefinition.save();

    return res.status(201).json({
      success: true,
      message: "Field definition created successfully",
      data: fieldDefinition,
    });
  } catch (err) {
    console.error("[summariesCreateDefinition] Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get summaries with their transactions/entries
 */
export const getSummariesWithEntries = async (req, res) => {
  try {
    const transactions = await TransactionModel.find({})
      .populate("lines.summaryId", "name")
      .populate("lines.fieldLineId", "name")
      .lean();

    const summaries = {};

    for (const tx of transactions) {
      for (const line of tx.lines) {
        const { summaryId, fieldLineId, debitOrCredit, amount } = line;
        const summaryKey = summaryId._id.toString();

        if (!summaries[summaryKey]) {
          summaries[summaryKey] = {
            summaryId: summaryId._id,
            summaryName: summaryId.name,
            lines: [],
          };
        }

        const counterparties = tx.lines
          .filter((l) => l !== line)
          .map((l) => ({
            summaryId: l.summaryId._id,
            summaryName: l.summaryId.name,
            debitOrCredit: l.debitOrCredit,
            amount: l.amount,
          }));

        summaries[summaryKey].lines.push({
          transactionId: tx._id,
          description: tx.description,
          date: tx.date,
          fieldLineName: fieldLineId?.name || "",
          debitOrCredit,
          amount,
          counterparties,
        });
      }
    }

    return res.status(200).json({ success: true, data: Object.values(summaries) });
  } catch (err) {
    console.error("[getSummariesWithEntries] Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

