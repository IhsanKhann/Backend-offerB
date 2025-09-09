import mongoose from "mongoose";
import AllRolesModel from "../../models/HRModals/AllRoles.model.js";
import FinalizedEmployeeModel from "../../models/HRModals/FinalizedEmployees.model.js";
import BreakupFile from "../../models/FinanceModals/BreakupfileModel.js";

export const getSalaryRulesByRoleName = async (req, res) => {
  try {
    const roleNameDecoded = decodeURIComponent(req.params.roleName).trim();

    const role = await AllRolesModel.findOne({
      name: { $regex: new RegExp(`^${roleNameDecoded}$`, "i") },
    });

    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    // Return only the salaryRules part
    return res.status(200).json({
      success: true,
      data: role.salaryRules || null, // Return ONLY salaryRules
    });
  } catch (err) {
    console.error("Error fetching salary rules:", err.stack || err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Helper function to calculate salary breakup
const calculateSalaryBreakup = (salaryRules) => {
  const { baseSalary, allowances = [], deductions = [], terminalBenefits = [] } = salaryRules;

  let totalAllowances = 0;
  let totalDeductions = 0;
  let totalTerminal = 0;
  const breakdown = [];

  // Calculate Allowances
  allowances.forEach(a => {
    const value = a.type === "percentage" ? (baseSalary * a.value) / 100 : a.value;
    totalAllowances += value;
    breakdown.push({
      type: "allowance",
      name: a.name,
      value,
      calculation: a.type === "percentage" ? `${a.value}% of ${baseSalary}` : "Fixed amount",
    });
  });

  // Calculate Deductions
  deductions.forEach(d => {
    const value = d.type === "percentage" ? (baseSalary * d.value) / 100 : d.value;
    totalDeductions += value;
    breakdown.push({
      type: "deduction",
      name: d.name,
      value,
      calculation: d.type === "percentage" ? `${d.value}% of ${baseSalary}` : "Fixed amount",
    });
  });

  // Calculate Terminal Benefits
  terminalBenefits.forEach(t => {
    const value = t.type === "percentage" ? (baseSalary * t.value) / 100 : t.value;
    totalTerminal += value;
    breakdown.push({
      type: "terminal",
      name: t.name,
      value,
      calculation: t.type === "percentage" ? `${t.value}% of ${baseSalary}` : "Fixed amount",
    });
  });

  // Final Net Salary
  const netSalary = baseSalary + totalAllowances + totalTerminal - totalDeductions;

  return {
    totalAllowances,
    totalDeductions,
    netSalary,
    breakdown
  };
};

// Controller to create a breakup file
export const createBreakupFile = async (req, res) => {
  try {
    const { roleId, salaryRules } = req.body;
    const { employeeId } = req.params;

    if (!roleId || !salaryRules) {
      return res.status(400).json({ success: false, message: "Missing roleId or salaryRules" });
    }

    console.log("Received salaryRules:", salaryRules);
    console.log("Received roleId:", roleId);

    const calculatedBreakup = calculateSalaryBreakup(salaryRules);

    const breakup = await BreakupFile.create({
      employeeId,
      roleId,
      salaryRules,
      calculatedBreakup
    });

    console.log("Breakup file created successfully:", breakup._id);

    res.status(201).json({ success: true, data: breakup });
  } catch (err) {
    console.error("Error creating breakup file:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// Optional: Controller to fetch breakup file for an employee
export const getBreakupFile = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const breakup = await BreakupFile.findOne({ employeeId })
      .populate("employeeId", "individualName") // optional: populate employee info
      .populate("roleId", "name");             // optional: populate role info

    if (!breakup) {
      return res.status(404).json({ success: false, message: "Breakup file not found" });
    }

    res.status(200).json({ success: true, data: breakup });
  } catch (err) {
    console.error("Error fetching breakup file:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// 4. Initiate salary transaction (handler placeholder)
export const initiateSalaryTransaction = async (req, res) => {
  const { employeeId } = req.params;
  // Later: Implement transaction logic using breakupFile
  res.json({ success: true, message: `Salary transaction initiated for ${employeeId}` });
};
