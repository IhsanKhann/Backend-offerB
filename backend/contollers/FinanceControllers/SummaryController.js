// controllers/FinanceControllers/SummaryController.js
import mongoose from "mongoose";
import SummaryModel from "../../models/FinanceModals/SummaryModel.js";
import SummaryFieldLineModel from "../../models/FinanceModals/SummaryFieldLinesModel.js";

export const getSummaries = async (req, res) => {
  try {
    const summaries = await SummaryModel.find().lean();
    res.status(200).json(summaries);
  } catch (error) {
    console.error("Error fetching summaries:", error);
    res.status(500).json({ message: "Error fetching summaries", error });
  }
};

export const resetSummaries = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await SummaryModel.updateMany(
      {},
      { $set: { startingBalance: 0, endingBalance: 0 } },
      { session }
    );
    await SummaryFieldLineModel.updateMany(
      {},
      { $set: { balance: 0 } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: "All summaries and field lines reset to 0." });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error resetting summaries:", err);
    res.status(500).json({ error: err.message });
  }
};

export const initCapitalCash = async (req, res) => {
  try {
    const { capitalAmount, cashAmount } = req.body;

    if (typeof capitalAmount !== "number" || typeof cashAmount !== "number") {
      return res
        .status(400)
        .json({ error: "capitalAmount and cashAmount must be numbers." });
    }

    // Use correct ObjectIds for capital and cash summaries
    const capitalSummary = await SummaryModel.findOne({ summaryId: 1600 });
    const cashSummary = await SummaryModel.findOne({ summaryId: 1500 });

    if (!capitalSummary || !cashSummary) {
      return res.status(404).json({ error: "Capital or Cash summary not found." });
    }

    await Promise.all([
      SummaryModel.updateOne(
        { _id: capitalSummary._id },
        { $set: { startingBalance: capitalAmount, endingBalance: capitalAmount } }
      ),
      SummaryModel.updateOne(
        { _id: cashSummary._id },
        { $set: { startingBalance: cashAmount, endingBalance: cashAmount } }
      ),
    ]);

    res.status(200).json({
      message: "Capital and Cash initialized successfully",
      capital: capitalAmount,
      cash: cashAmount,
    });
  } catch (err) {
    console.error("Error initializing Capital/Cash:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getSummariesWithFieldLines = async (req, res) => {
  try {
    const [summaries, fieldLines] = await Promise.all([
      SummaryModel.find().lean(),
      SummaryFieldLineModel.find().lean(),
    ]);

    const grouped = summaries.map((summary) => {
      const relatedLines = fieldLines
        .filter((fl) => fl.summaryId?.toString() === summary._id?.toString())
        .map((fl) => ({
          ...fl,
          balance: fl.balance ?? 0,
          isExpense: summary.accountType === "expense",
        }))
        .sort((a, b) => (a.fieldLineId || 0) - (b.fieldLineId || 0));

      return {
        ...summary,
        fieldLines: relatedLines,
      };
    });

    res.status(200).json(grouped);
  } catch (error) {
    console.error("Error fetching summaries with lines:", error);
    res.status(500).json({ message: "Error fetching summaries with lines", error });
  }
};

// GET all summaries with populated fieldLines
export const getAllSummaries = async (req, res) => {
  try {
    const summaries = await SummaryModel.find()
      .lean()
      .populate({
        path: "fieldLines",
        model: SummaryFieldLineModel,
        select: "fieldLineId name accountNumber balance isExpense summaryId"
      });

    res.status(200).json(summaries);
  } catch (err) {
    console.error("Error fetching summaries:", err);
    res.status(500).json({ error: "Failed to fetch summaries" });
  }
};

// GET all summary field lines
export const getAllFieldLines = async (req, res) => {
  try {
    const fieldLines = await SummaryFieldLineModel.find().lean();
    res.status(200).json(fieldLines);
  } catch (err) {
    console.error("Error fetching field lines:", err);
    res.status(500).json({ error: "Failed to fetch field lines" });
  }
};