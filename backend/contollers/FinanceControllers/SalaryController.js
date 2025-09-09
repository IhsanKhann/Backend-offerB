import mongoose from "mongoose";
import AllRolesModel from "../../models/HRModals/AllRoles.model.js";
import FinalizedEmployeeModel from "../../models/HRModals/FinalizedEmployees.model.js";
import BreakupFile from "../../models/FinanceModals/BreakupfileModel.js";

export const getSingleSalaryRole = async (req, res) => {
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

export const getSalaryRulesByRoleName = async (req, res) => {
  try {
    const roleNameDecoded = decodeURIComponent(req.params.roleName).trim();

    // Find the role (case-insensitive)
    const role = await AllRolesModel.findOne({
      name: { $regex: new RegExp(`^${roleNameDecoded}$`, "i") },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: `Role '${roleNameDecoded}' not found`,
      });
    }

    // Return only the salaryRules
    return res.status(200).json({
      success: true,
      data: role.salaryRules || null,
    });
  } catch (err) {
    console.error("Error fetching salary rules:", err.stack || err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Helper to calculate salary breakup
const calculateSalaryBreakup = (salaryRules) => {
  const { baseSalary = 0, allowances = [], deductions = [], terminalBenefits = [] } = salaryRules;

  let totalAllowances = 0;
  let totalDeductions = 0;
  let totalTerminal = 0;
  const breakdown = [];

  // Allowances
  allowances.forEach(a => {
    const value = a.type === "percentage" ? (baseSalary * a.value) / 100 : a.value;
    totalAllowances += value;
    breakdown.push({
      type: "allowance",
      name: a.name,
      value,
      calculation: a.type === "percentage" ? `${a.value}% of ${baseSalary}` : "Fixed amount"
    });
  });

  // Deductions
  deductions.forEach(d => {
    const value = d.type === "percentage" ? (baseSalary * d.value) / 100 : d.value;
    totalDeductions += value;
    breakdown.push({
      type: "deduction",
      name: d.name,
      value,
      calculation: d.type === "percentage" ? `${d.value}% of ${baseSalary}` : "Fixed amount"
    });
  });

  // Terminal Benefits
  terminalBenefits.forEach(t => {
    const value = t.type === "percentage" ? (baseSalary * t.value) / 100 : t.value;
    totalTerminal += value;
    breakdown.push({
      type: "terminal",
      name: t.name,
      value,
      calculation: t.type === "percentage" ? `${t.value}% of ${baseSalary}` : "Fixed amount"
    });
  });

  const netSalary = baseSalary + totalAllowances + totalTerminal - totalDeductions;

  return {
    totalAllowances,
    totalDeductions,
    totalTerminal,
    netSalary,
    breakdown
  };
};

export const createBreakupFile = async (req, res) => {
  try {
    const { employeeId, roleId, salaryRules } = req.body;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(employeeId) || !mongoose.Types.ObjectId.isValid(roleId)) {
      return res.status(400).json({ message: "Invalid employee or role ID" });
    }

    // Calculate breakup
    const { totalAllowances, totalDeductions, totalTerminal, netSalary, breakdown } = calculateSalaryBreakup(salaryRules);

    // Create new BreakupFile document
    const breakup = new BreakupFile({
      employeeId,
      roleId,
      salaryRules,
      calculatedBreakup: {
        totalAllowances,
        totalDeductions,
        netSalary,
        breakdown
      }
    });

    await breakup.save();

    res.status(200).json({
      success: true,
      message: "Breakup file created successfully",
      data: breakup
    });
  } catch (err) {
    console.error("Error creating breakup file:", err);
    res.status(500).json({ message: "Server error", error: err.message });
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

