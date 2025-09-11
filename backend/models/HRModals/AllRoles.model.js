import mongoose from "mongoose";

const AllowanceSchema = new mongoose.Schema({
  name: String,
  type: { type: String, enum: ["fixed", "percentage"] },
  value: Number,
}, { _id: false });

const SalaryRulesSchema = new mongoose.Schema({
  baseSalary: { type: Number, required: true },
  salaryType: { type: String, enum: ["monthly", "hourly"], default: "monthly" },
  allowances: [AllowanceSchema],
}, { _id: false });

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  salaryRules: SalaryRulesSchema
});

export default mongoose.model("AllRoles", RoleSchema);
