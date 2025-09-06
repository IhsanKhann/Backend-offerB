// controllers/FinanceControllers/SummaryController.js
import mongoose from "mongoose";
import SummaryModel from "../../models/FinanceModals/SummaryModel.js";
import SummaryFieldLineModel from "../../models/FinanceModals/SummaryFieldLinesModel.js";

// GET /api/summaries → fetch all summaries (plain)
export const getSummaries = async (req, res) => {
  try {
    const summaries = await SummaryModel.find().lean();
    res.status(200).json(summaries);
  } catch (error) {
    console.error("Error fetching summaries:", error);
    res.status(500).json({ message: "Error fetching summaries", error });
  }
};

// GET /api/summaries-with-lines → fetch summaries with their field lines
export const getSummariesWithLines = async (req, res) => {
  try {
    const [summaries, fieldLines] = await Promise.all([
      SummaryModel.find().lean(),
      SummaryFieldLineModel.find().lean()
    ]);

    const grouped = summaries.map(summary => {
      const relatedLines = fieldLines
        .filter(f => f.summaryId?.toString() === summary._id?.toString())
        .map(f => ({
          ...f,
          balance: f.balance ?? 0
        }))
        .sort((a, b) => (a.fieldLineId || 0) - (b.fieldLineId || 0));

      return {
        ...summary,
        fieldLines: relatedLines
      };
    });

    res.status(200).json(grouped);
  } catch (error) {
    console.error("Error fetching summaries with lines:", error);
    res.status(500).json({ message: "Error fetching summaries with lines", error });
  }
};

// GET /api/summary-field-lines → fetch all field lines (plain)
export const getSummaryFieldLines = async (req, res) => {
  try {
    const fieldLines = await SummaryFieldLineModel.find().lean();
    res.status(200).json(fieldLines);
  } catch (error) {
    console.error("Error fetching summary field lines:", error);
    res.status(500).json({ message: "Error fetching summary field lines", error });
  }
};

// POST /api/reset-summaries → reset all balances
export const resetSummaries = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await SummaryModel.updateMany({}, { $set: { startingBalance: 0, endingBalance: 0 } }, { session });
    await SummaryFieldLineModel.updateMany({}, { $set: { balance: 0 } }, { session });

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

// POST /api/init-capital-cash → initialize capital & cash
export const initCapitalCash = async (req, res) => {
  try {
    const { capitalAmount, cashAmount } = req.body;

    if (typeof capitalAmount !== "number" || typeof cashAmount !== "number") {
      return res.status(400).json({ error: "capitalAmount and cashAmount must be numbers." });
    }

    // Example summaryIds
    const CAPITAL_ID = 1600;
    const CASH_ID = 1500;

    await Promise.all([
      SummaryModel.updateOne({ summaryId: CAPITAL_ID }, { $set: { startingBalance: capitalAmount, endingBalance: capitalAmount } }),
      SummaryModel.updateOne({ summaryId: CASH_ID }, { $set: { startingBalance: cashAmount, endingBalance: cashAmount } }),
    ]);

    res.status(200).json({
      message: "Capital and Cash initialized successfully",
      capital: capitalAmount,
      cash: cashAmount
    });
  } catch (err) {
    console.error("Error initializing Capital/Cash:", err);
    res.status(500).json({ error: err.message });
  }
};
