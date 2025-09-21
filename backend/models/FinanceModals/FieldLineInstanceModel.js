// models/FinanceModals/FieldLineInstanceModel.js
import mongoose from "mongoose";

const SummaryFieldLineInstanceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    summaryId: { type: mongoose.Schema.Types.ObjectId, ref: "Summary", required: true },
    definitionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SummaryFieldLineDefinition",
      required: true,
    },
    fieldLineNumericId: { type: Number },
    balance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ✅ Compound unique index to avoid duplicates
SummaryFieldLineInstanceSchema.index(
  { summaryId: 1, definitionId: 1, name: 1 },
  { unique: true }
);

const SummaryFieldLineInstance =
  mongoose.models.SummaryFieldLineInstance ||
  mongoose.model("SummaryFieldLineInstance", SummaryFieldLineInstanceSchema);

export default SummaryFieldLineInstance;
