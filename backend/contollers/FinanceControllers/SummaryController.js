// controllers/FinanceControllers/SummaryController.js
import mongoose from "mongoose";
import SummaryModel from "../../models/FinanceModals/SummaryModel.js";
import SummaryFieldLineModel from "../../models/FinanceModals/FieldLineInstanceModel.js";
import TransactionModel from "../../models/FinanceModals/TransactionModel.js";
import SummaryFieldLineDefinition from "../../models/FinanceModals/FieldLineDefinitionModel.js";
import SummaryFieldLineInstance from "../../models/FinanceModals/FieldLineInstanceModel.js";


export const summariesGetAll = async (req, res) => {
  try {
    console.log("[summariesGetAll] Fetching all summaries");
    const summaries = await SummaryModel.find().lean();
    console.log(`[summariesGetAll] Found ${summaries.length} summaries`);
    res.status(200).json(summaries);
  } catch (error) {
    console.error("[summariesGetAll] Error:", error.stack || error);
    res.status(500).json({ message: "Error fetching summaries", error: error.message });
  }
};

export const summariesReset = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    console.log("[summariesReset] Resetting all summaries and field lines");

    const sRes = await SummaryModel.updateMany({}, { $set: { startingBalance: 0, endingBalance: 0 } }, { session });
    const fRes = await SummaryFieldLineModel.updateMany({}, { $set: { balance: 0 } }, { session });

    console.log(`[summariesReset] Updated ${sRes.modifiedCount} summaries, ${fRes.modifiedCount} field lines`);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: "All summaries and field lines reset to 0." });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("[summariesReset] Error:", err.stack || err);
    res.status(500).json({ error: err.message });
  }
};

export const summariesInitCapitalCash = async (req, res) => {
  try {
    console.log("[summariesInitCapitalCash] Body:", req.body);
    const { capitalAmount, cashAmount } = req.body;

    if (typeof capitalAmount !== "number" || typeof cashAmount !== "number") {
      console.warn("[summariesInitCapitalCash] Invalid input types");
      return res.status(400).json({ error: "capitalAmount and cashAmount must be numbers." });
    }

    const capitalSummary = await SummaryModel.findOne({ summaryId: 1600 });
    const cashSummary = await SummaryModel.findOne({ summaryId: 1500 });

    console.log("[summariesInitCapitalCash] Found summaries:", { capitalSummary: !!capitalSummary, cashSummary: !!cashSummary });

    if (!capitalSummary || !cashSummary) {
      return res.status(404).json({ error: "Capital or Cash summary not found." });
    }

    await Promise.all([
      SummaryModel.updateOne({ _id: capitalSummary._id }, { $set: { startingBalance: capitalAmount, endingBalance: capitalAmount } }),
      SummaryModel.updateOne({ _id: cashSummary._id }, { $set: { startingBalance: cashAmount, endingBalance: cashAmount } }),
    ]);

    res.status(200).json({
      message: "Capital and Cash initialized successfully",
      capital: capitalAmount,
      cash: cashAmount,
    });
  } catch (err) {
    console.error("[summariesInitCapitalCash] Error:", err.stack || err);
    res.status(500).json({ error: err.message });
  }
};

export const summariesGetById = async (req, res) => {
  try {
    console.log("[summariesGetById] Params:", req.params);
    const { summaryId } = req.params;

    const numericId = Number(summaryId);
    console.log("[summariesGetById] Parsed numericId:", numericId);

    const summary = await SummaryModel.findOne({ summaryId: numericId }).lean();
    console.log("[summariesGetById] Found summary:", summary ? summary._id : "NOT FOUND");

    if (!summary) return res.status(404).json({ message: "Summary not found" });

    const fieldLines = await SummaryFieldLineInstance.find({ summaryId: summary._id })
      .populate("definitionId", "fieldLineNumericId name accountNumber")
      .lean();

    console.log(`[summariesGetById] Found ${fieldLines.length} field lines`);

    return res.json({
      ...summary,
      fieldLines: fieldLines.map(line => ({
        id: line._id,
        fieldLineNumericId: line.fieldLineNumericId,
        name: line.name,
        definition: line.definitionId,
        balance: line.balance,
      }))
    });
  } catch (error) {
    console.error("[summariesGetById] Error:", error.stack || error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const summariesGetWithFieldLines = async (req, res) => {
  try {
    console.log("[summariesGetWithFieldLines] Fetching summaries + field lines");

    const summaries = await SummaryModel.find().lean();
    const fieldLines = await SummaryFieldLineInstance.find()
      .populate("definitionId", "fieldLineNumericId name accountNumber")
      .lean();

    console.log(`[summariesGetWithFieldLines] Found ${summaries.length} summaries, ${fieldLines.length} field lines`);

    const fieldLinesBySummary = {};
    fieldLines.forEach(line => {
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

    const result = summaries.map(summary => ({
      ...summary,
      fieldLines: fieldLinesBySummary[summary._id.toString()] || []
    }));

    return res.json(result);
  } catch (error) {
    console.error("[summariesGetWithFieldLines] Error:", error.stack || error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const summariesGetAllFieldLines = async (req, res) => {
  try {
    console.log("[summariesGetAllFieldLines] Fetching all field lines");

    const fieldLines = await SummaryFieldLineInstance.find()
      .populate("definitionId", "fieldLineNumericId name accountNumber")
      .populate("summaryId", "summaryId name accountType")
      .lean();

    console.log(`[summariesGetAllFieldLines] Found ${fieldLines.length} field lines`);

    return res.json(fieldLines.map(line => ({
      id: line._id,
      summary: line.summaryId,
      definition: line.definitionId,
      fieldLineNumericId: line.fieldLineNumericId,
      name: line.name,
      balance: line.balance
    })));
  } catch (error) {
    console.error("[summariesGetAllFieldLines] Error:", error.stack || error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const summariesCreateDefinition = async (req, res) => {
  try {
    console.log("[summariesCreateDefinition] Body:", req.body);
    const { fieldLineNumericId, name, accountNumber } = req.body;

    if (!fieldLineNumericId || !name || !accountNumber) {
      console.warn("[summariesCreateDefinition] Missing required fields");
      return res.status(400).json({ error: "All fields are required" });
    }

    const fieldDefinition = new SummaryFieldLineDefinition({
      fieldLineNumericId,
      name,
      accountNumber,
    });

    await fieldDefinition.save();
    console.log("[summariesCreateDefinition] Created field definition:", fieldDefinition._id);

    res.status(200).json({ message: "Field definition created successfully" });
  } catch (error) {
    console.error("[summariesCreateDefinition] Error:", error.stack || error);
    res.status(500).json({ error: error.message });
  }
};

export const getSummariesWithEntries = async (req, res) => {
  try {
    const transactions = await TransactionModel.find({})
      .populate("lines.summaryId", "name") // populate summary names
      .populate("lines.fieldLineId", "name"); // populate line names

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

        // counterparty = all other lines in same transaction
        const counterparties = tx.lines
          .filter(l => l !== line)
          .map(l => ({
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

    res.json(Object.values(summaries));
  } catch (err) {
    console.error("Error in getSummariesWithEntries:", err);
    res.status(500).json({ message: "Server error" });
  }
};
