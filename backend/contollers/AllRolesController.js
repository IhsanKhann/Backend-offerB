// these are for the dropdown of the roles in the assign roles page. We can add more roles or delete existing one from the array.
import AllRolesModel from "../models/HRModals/AllRoles.model.js";

// ---------------------- Get All Roles ----------------------
export const getAllRolesList = async (req, res) => {
  try {
    const roles = await AllRolesModel.find();
    res.status(200).json({ message: "Roles found", success: true, Roles: roles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", success: false, error: err.message });
  }
};

export const addRole = async (req, res) => {
  try {
    const {
      name,
      description,
      salaryRules // this will include baseSalary, salaryType, allowances, deductions, terminalBenefits
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ message: "Role name is required", success: false });
    }
    if (!salaryRules || typeof salaryRules.baseSalary !== "number") {
      return res.status(400).json({ message: "Base salary is required and must be a number", success: false });
    }

    // Ensure arrays exist even if empty
    const newRole = new AllRolesModel({
      name,
      description,
      salaryRules: {
        baseSalary: salaryRules.baseSalary,
        salaryType: salaryRules.salaryType || "monthly",
        allowances: Array.isArray(salaryRules.allowances) ? salaryRules.allowances : [],
        deductions: Array.isArray(salaryRules.deductions) ? salaryRules.deductions : [],
        terminalBenefits: Array.isArray(salaryRules.terminalBenefits) ? salaryRules.terminalBenefits : [],
      },
    });

    await newRole.save();

    res.status(201).json({ message: "Role added successfully", success: true, data: newRole });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", success: false, error: err.message });
  }
};

export const deleteRole = async (req, res) => {
  try {
    const { roleId } = req.params;  // ✅ get from params
    await AllRolesModel.findByIdAndDelete(roleId);
    res.status(200).json({ message: "Role deleted", success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", success: false, error: err.message });
  }
};