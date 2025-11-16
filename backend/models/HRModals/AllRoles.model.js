import mongoose from "mongoose";

const ComponentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["fixed", "percentage"], required: true },
  value: { type: Number, required: true },
}, { _id: false });


const SalaryRulesSchema = new mongoose.Schema({
  baseSalary: { type: Number, required: true },
  salaryType: { type: String, enum: ["monthly", "hourly"], default: "monthly" },
  allowances: { type: [ComponentSchema], default: [] },
  deductions: { type: [ComponentSchema], default: [] },
  terminalBenefits: { type: [ComponentSchema], default: [] },
}, { _id: false });

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  salaryRules: SalaryRulesSchema,
});

export default mongoose.model("AllRoles", RoleSchema);
