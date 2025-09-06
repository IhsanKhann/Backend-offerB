import mongoose from "mongoose";

const SummaryFieldLineSchema = new mongoose.Schema({
  fieldLineId: { type: Number, unique: true },  // e.g. 1101, 1102, 2101 etc.
  name: { type: String, required: true },       // e.g. "Administrative Expense"
  summaryId: { type: mongoose.Schema.Types.ObjectId, ref: "Summary", required: true }, // true relation
  accountNumber: { type: String },              // optional COA-style numbering
  balance: {type: Number, default: 0},
});

const SummaryFieldLineModel = mongoose.model("SummaryFieldLine", SummaryFieldLineSchema);
export default SummaryFieldLineModel;
