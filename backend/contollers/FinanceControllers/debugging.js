import mongoose from "mongoose";
import SummaryFieldLineModel from "../../models/FinanceModals/SummaryFieldLinesModel.js" // update path if needed
import TablesModel from "../../models/FinanceModals/TablesModel.js";

const MONGO_URI = "mongodb+srv://IhsanDB:mintfever@cluster0.lj1ezwx.mongodb.net/employee-form"; // replace with your DB

async function checkFieldLines() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    // Fetch all fieldLineIds in DB
    const dbFieldLines = await SummaryFieldLineModel.find({}, { fieldLineId: 1 }).lean();
    const dbFieldLineIds = dbFieldLines.map(f => Number(f.fieldLineId));
    console.log("DB FieldLine IDs:", dbFieldLineIds);

    // Fetch all expense rules
    const rules = await TablesModel.find({ transactionType: "Expense" }).lean();
    const ruleFieldLineIds = [];
    rules.forEach(rule => {
      (rule.splits || []).forEach(split => {
        if (split.fieldLineId != null) ruleFieldLineIds.push(Number(split.fieldLineId));
      });
    });

    console.log("Rules FieldLine IDs:", ruleFieldLineIds);

    // Find missing ones
    const missing = ruleFieldLineIds.filter(id => !dbFieldLineIds.includes(id));
    if (missing.length === 0) {
      console.log("✅ All fieldLineIds in rules exist in DB.");
    } else {
      console.log("❌ Missing fieldLineIds in DB:", missing);
    }
  } catch (err) {
    console.error("Error checking fieldLineIds:", err);
  } finally {
    mongoose.disconnect();
  }
}

checkFieldLines();
