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

export const getBreakupFile = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const breakup = await BreakupFile.findOne({ employeeId })
      .populate("employeeId", "individualName personalEmail") // optional employee info
      .populate("roleId", "name"); // optional role info

    if (!breakup) {
      return res.status(404).json({ success: false, message: "Breakup file not found" });
    }

    res.status(200).json({ success: true, data: breakup });
  } catch (err) {
    console.error("Error fetching breakup file:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// Utility: Merge role rules with edited fields
const mergeSalaryRules = (roleRules, edited = {}) => {
  const merged = { ...roleRules };

  // Override baseSalary and salaryType
  if (edited.baseSalary) merged.baseSalary = edited.baseSalary;
  if (edited.salaryType) merged.salaryType = edited.salaryType;

  // Merge arrays (allowances, deductions, terminalBenefits)
  ["allowances", "deductions", "terminalBenefits"].forEach((key) => {
    merged[key] = [...(roleRules[key] || [])];

    if (edited[key]) {
      edited[key].forEach((editedItem) => {
        const index = merged[key].findIndex((r) => r.name === editedItem.name);
        if (index !== -1) {
          // Override existing
          merged[key][index] = { ...merged[key][index], ...editedItem };
        } else {
          // Add new item
          merged[key].push(editedItem);
        }
      });
    }
  });

  return merged;
};

// Utility: Calculate breakup
const calculateBreakup = (rules) => {
  const { baseSalary = 0, allowances = [], deductions = [], terminalBenefits = [] } = rules;
  let totalAllowances = 0;
  let totalDeductions = 0;
  let totalTerminal = 0;
  const breakdown = [];

  allowances.forEach((a) => {
    const value = a.type === "percentage" ? (baseSalary * a.value) / 100 : a.value;
    totalAllowances += value;
    breakdown.push({
      type: "allowance",
      name: a.name,
      value,
      calculation: a.type === "percentage" ? `${a.value}% of ${baseSalary}` : "Fixed amount",
    });
  });

  deductions.forEach((d) => {
    const value = d.type === "percentage" ? (baseSalary * d.value) / 100 : d.value;
    totalDeductions += value;
    breakdown.push({
      type: "deduction",
      name: d.name,
      value,
      calculation: d.type === "percentage" ? `${d.value}% of ${baseSalary}` : "Fixed amount",
    });
  });

  terminalBenefits.forEach((t) => {
    const value = t.type === "percentage" ? (baseSalary * t.value) / 100 : t.value;
    totalTerminal += value;
    breakdown.push({
      type: "terminal",
      name: t.name,
      value,
      calculation: t.type === "percentage" ? `${t.value}% of ${baseSalary}` : "Fixed amount",
    });
  });

  const netSalary = baseSalary + totalAllowances + totalTerminal - totalDeductions;

  return { totalAllowances, totalDeductions, totalTerminal, netSalary, breakdown };
};

// Create breakup file
export const createBreakupFile = async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    const { editedFields = {} } = req.body;

    if (!employeeId) return res.status(400).json({ success: false, message: "Missing employeeId" });

    const employee = await FinalizedEmployeeModel.findById(employeeId).populate("role");
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

    const roleRules = employee.role?.salaryRules || {};
    const finalRules = mergeSalaryRules(roleRules, editedFields);
    const calculatedBreakup = calculateBreakup(finalRules);

    const breakupFile = await BreakupFile.findOneAndUpdate(
      { employeeId },
      { employeeId, roleId: employee.role?._id, salaryRules: finalRules, calculatedBreakup },
      { upsert: true, new: true }
    )
      .populate("employeeId", "individualName personalEmail")
      .populate("roleId", "name");

    res.status(201).json({ success: true, data: breakupFile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};