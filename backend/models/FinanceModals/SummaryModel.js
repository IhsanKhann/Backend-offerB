import mongoose from "mongoose";

const SummarySchema = new mongoose.Schema({
  summaryId: { type: Number, unique: true },  // e.g. 1100, 1200
  name: { type: String, required: true },     // Expense, Cash, Allowance, Capital
  accountType: { 
    type: String, 
    enum: ["asset", "liability", "income", "expense", "equity"], 
    required: true 
  },
  parentId: { type: Number, default: null },
  startingBalance: { type: Number, default: 0 },
  endingBalance: { type: Number, default: 0 }
});

SummarySchema.virtual("fieldLines", {
  ref: "SummaryFieldLine",
  localField: "_id",       // Summary _id
  foreignField: "summaryId", // fieldLine.summaryId
});

SummarySchema.set("toObject", { virtuals: true });
SummarySchema.set("toJSON", { virtuals: true });

const SummaryModel = mongoose.model("Summary", SummarySchema);
export default SummaryModel;

