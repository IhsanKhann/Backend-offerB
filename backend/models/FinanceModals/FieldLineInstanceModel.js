// models/FinanceModals/FieldLineInstanceModel.js
import mongoose from "mongoose";

const SummaryFieldLineInstanceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  summaryId: { type: mongoose.Schema.Types.ObjectId, ref: "Summary" },
  definitionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SummaryFieldLineDefinition",
  },
  fieldLineNumericId: Number,
  balance: { type: Number, default: 0 },
});

const SummaryFieldLineInstance =
  mongoose.models.SummaryFieldLineInstance ||
  mongoose.model(
    "SummaryFieldLineInstance",
    SummaryFieldLineInstanceSchema
  );

export default SummaryFieldLineInstance;


