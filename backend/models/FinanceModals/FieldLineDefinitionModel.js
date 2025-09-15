// models/FinanceModals/FieldLineDefinitionModel.js
import mongoose from "mongoose";

const SummaryFieldLineDefinitionSchema = new mongoose.Schema(
  {
    fieldLineNumericId: { type: Number, unique: true, required: true },
    name: { type: String, required: true },
    accountNumber: { type: String },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ✅ Define the virtual BEFORE compiling the model
SummaryFieldLineDefinitionSchema.virtual("instances", {
  ref: "SummaryFieldLineInstance",   // the model to populate
  localField: "_id",                 // definition._id
  foreignField: "definitionId",      // instance.definitionId
});

// ✅ Use cached model to avoid OverwriteModelError
const SummaryFieldLineDefinition =
  mongoose.models.SummaryFieldLineDefinition ||
  mongoose.model("SummaryFieldLineDefinition", SummaryFieldLineDefinitionSchema);

export default SummaryFieldLineDefinition;
