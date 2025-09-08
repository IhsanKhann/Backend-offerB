import mongoose from "mongoose";
import AllRolesModel from "../../models/HRModals/AllRoles.model.js";
import FinalizedEmployeeModel from "../../models/HRModals/FinalizedEmployees.model.js";
import BreakupFile from "../../models/FinanceModals/BreakupfileModel.js";

// 1. Get employee salary rules (from role collection)
export const getEmployeeRules = async (req, res) => {
  const { roleName } = req.params;

  try {
    const role = await AllRolesModel.findOne({ name: roleName });

    if (!role) return res.status(404).json({ message: "Role not found" });

    res.json({
      success: true,
      data: role.salaryRules,
      roleId: role._id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// 2. Create breakup file
export const createBreakupFile = async (req, res) => {
  const { employeeId } = req.params;
  const { salaryRules } = req.body; // can be edited or default from frontend

  try {
    // Calculate breakup
    let totalAllowances = 0, totalDeductions = 0, breakdown = [];
    
    salaryRules.allowances.forEach(a => {
      const value = a.type === "percentage" ? (salaryRules.baseSalary * a.value) / 100 : a.value;
      totalAllowances += value;
      breakdown.push({ name: a.name, type: "allowance", value });
    });

    salaryRules.deductions.forEach(d => {
      const value = d.type === "percentage" ? (salaryRules.baseSalary * d.value) / 100 : d.value;
      totalDeductions += value;
      breakdown.push({ name: d.name, type: "deduction", value });
    });

    salaryRules.terminalBenefits.forEach(t => {
      const value = t.type === "percentage" ? (salaryRules.baseSalary * t.value) / 100 : t.value;
      breakdown.push({ name: t.name, type: "terminal", value });
    });

    const netSalary = salaryRules.baseSalary + totalAllowances - totalDeductions;

    const breakupFile = new BreakupFile({
      employeeId,
      roleId: req.body.roleId,
      salaryRules,
      calculatedBreakup: { totalAllowances, totalDeductions, netSalary, breakdown },
    });

    await breakupFile.save();

    res.json({ success: true, data: breakupFile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create breakup file" });
  }
};

// 3. Get breakup file for employee
export const getBreakupFile = async (req, res) => {
  const { employeeId } = req.params;
  try {
    const breakup = await BreakupFile.findOne({ employeeId }).sort({ createdAt: -1 });
    if (!breakup) return res.status(404).json({ message: "Breakup file not found" });
    res.json({ success: true, data: breakup });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// 4. Initiate salary transaction (handler placeholder)
export const initiateSalaryTransaction = async (req, res) => {
  const { employeeId } = req.params;
  // Later: Implement transaction logic using breakupFile
  res.json({ success: true, message: `Salary transaction initiated for ${employeeId}` });
};
