import mongoose from "mongoose";

const SummaryFieldLineDefinitionSchema = new mongoose.Schema({
  fieldLineNumericId: { type: Number, unique: true, required: true }, 
  name: { type: String, required: true },
  accountNumber: { type: String }
});

const SummaryFieldLineDefinition = mongoose.model(
  "SummaryFieldLineDefinition",
  SummaryFieldLineDefinitionSchema
);

export default SummaryFieldLineDefinition;