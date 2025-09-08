import mongoose from "mongoose";

const BreakupSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: "allroles", required: true },
  salaryRules: {
    baseSalary: { type: Number, required: true },
    salaryType: { type: String, enum: ["monthly", "hourly"], default: "monthly" },
    terminalBenefits: [{ name: String, type: String, value: Number }],
    deductions: [{ name: String, type: String, value: Number }],
    allowances: [{ name: String, type: String, value: Number }],
  },
  calculatedBreakup: {
    totalAllowances: Number,
    totalDeductions: Number,
    netSalary: Number,
    breakdown: [
      {
        name: String,
        type: String, // allowance/deduction/terminal
        value: Number,
      },
    ],
  },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("BreakupFile", BreakupSchema);