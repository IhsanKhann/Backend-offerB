// models/Cycle.js
import mongoose from "mongoose";

const CycleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },             // Example: "1–15 January"
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    description: { type: String },                      // Optional
    type: { type: String, enum: ["periodic", "custom"], default: "custom" }
  },
  { timestamps: true }
);

export default mongoose.model("Cycle", CycleSchema);
