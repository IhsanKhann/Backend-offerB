import mongoose from "mongoose";

const SummaryFieldLineInstanceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  summaryId: { type: mongoose.Schema.Types.ObjectId, ref: "Summary", required: true },
  definitionId: { type: mongoose.Schema.Types.ObjectId, ref: "SummaryFieldLineDefinition", required: true },
  fieldLineNumericId: Number, // optional if you want direct numeric mapping
  balance: { type: Number, default: 0 }
});

const SummaryFieldLineInstance = mongoose.model(
  "SummaryFieldLineInstance",
  SummaryFieldLineInstanceSchema
);

export default SummaryFieldLineInstance;