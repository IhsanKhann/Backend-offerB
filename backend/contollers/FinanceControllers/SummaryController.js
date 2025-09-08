// controllers/FinanceControllers/SummaryController.js
import mongoose from "mongoose";
import SummaryModel from "../../models/FinanceModals/SummaryModel.js";
import SummaryFieldLineModel from "../../models/FinanceModals/SummaryFieldLinesModel.js";
import TransactionModel from "../../models/FinanceModals/TransactionModel.js";

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
    const summaries = await SummaryModel.find()
      .lean()
      .populate({
        path: "fieldLines", // <-- if you defined a virtual in Summary schema
        model: "SummaryFieldLine",
      });

    // If you don’t have a virtual, fallback to manual query
    const detailed = await Promise.all(
      summaries.map(async (summary) => {
        const fieldLines = await SummaryFieldLineModel.find({
          summaryId: summary._id,   // <-- use _id since summaryId in fieldLine is ObjectId
        }).lean();

        return {
          ...summary,
          fieldLines: fieldLines.map((fl) => ({
            ...fl,
            balance: fl.balance ?? 0,
            isExpense: summary.accountType === "expense",
          })),
        };
      })
    );

    res.status(200).json(detailed);
  } catch (error) {
    console.error("Error fetching summaries with lines:", error);
    res
      .status(500)
      .json({ message: "Error fetching summaries with lines", error });
  }
};

export const getSummariesAndFieldLines = async (req, res) => {
  try {
    const [summaries, fieldLines] = await Promise.all([
      SummaryModel.find().lean(),
      SummaryFieldLineModel.find().lean(),
    ]);

    res.status(200).json({
      summaries,
      fieldLines,
    });
  } catch (error) {
    console.error("Error fetching summaries & field lines:", error);
    res
      .status(500)
      .json({ message: "Error fetching summaries & field lines", error });
  }
};

const SID = {
  COMMISSION: 1700,
  CASH: 1500,
};

// Get ObjectId for summary
async function getSummaryObjectId(numericSummaryId, session) {
  const summary = await SummaryModel.findOne({ summaryId: numericSummaryId }).session(session);
  if (!summary) throw new Error(`Summary ${numericSummaryId} not found`);
  return summary._id;
}