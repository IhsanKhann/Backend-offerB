import mongoose from "mongoose";

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  salaryRules: {
    baseSalary: { type: Number, required: true },
    salaryType: { type: String, enum: ["monthly", "hourly"], default: "monthly" },
    terminalBenefits: [
      {
        name: String,
        type: String, // e.g., "fixed" or "percentage"
        value: Number, // amount or percentage
      },
    ],
    deductions: [
      {
        name: String,
        type: String, // "fixed" or "percentage"
        value: Number,
      },
    ],
    allowances: [
      {
        name: String,
        type: String, // "fixed" or "percentage"
        value: Number,
      },
    ],
  },
});

export default mongoose.model("allroles", RoleSchema);
