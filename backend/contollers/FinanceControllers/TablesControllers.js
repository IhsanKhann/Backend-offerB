// // controllers/ruleController.js
// import Rule from "../../models/FinanceModals/TablesModel.js";
// import AllRoles from "../../models/HRModals/AllRoles.model.js";

// export const createRule = async (req, res) => {
//   try {
//     const { ruleId, transactionType, incrementType, splits } = req.body;

//     // Check if ruleId already exists
//     const existing = await Rule.findOne({ ruleId });
//     if (existing) {
//       return res.status(400).json({ message: `Rule with ruleId ${ruleId} already exists.` });
//     }

//     // Create new rule
//     const newRule = new Rule({
//       ruleId,
//       transactionType,
//       incrementType,
//       splits,
//     });

//     await newRule.save();

//     res.status(201).json({
//       message: "Rule created successfully",
//       rule: newRule,
//     });
//   } catch (error) {
//     console.error("Error creating rule:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

// export const getRules = async (req, res) => {
//   try {
//     const rules = await Rule.find();
//     res.status(200).json(rules);
//   } catch (error) {
//     console.error("Error fetching rules:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

// export const getRuleById = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const rule = await Rule.findOne({ ruleId: id });

//     if (!rule) {
//       return res.status(404).json({ message: `Rule with ruleId ${id} not found` });
//     }

//     res.status(200).json(rule);
//   } catch (error) {
//     console.error("Error fetching rule:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

// // 1. Get all salary rules for all roles
// export const getAllSalaryRules = async (req, res) => {
//   try {
//     const roles = await AllRoles.find({}, { name: 1, description: 1, salaryRules: 1 });
//     res.status(200).json({ success: true, data: roles });
//   } catch (err) {
//     console.error("Error fetching salary rules:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // 2. Get salary rules for a single role by ID
// export const getSalaryRulesByRole = async (req, res) => {
//   try {
//     const { roleId } = req.params;
//     const role = await AllRoles.findById(roleId);
//     if (!role) return res.status(404).json({ success: false, message: "Role not found" });

//     res.status(200).json({ success: true, data: role.salaryRules });
//   } catch (err) {
//     console.error("Error fetching role salary rules:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // 3. Update salary rules for a role
// export const updateSalaryRules = async (req, res) => {
//   try {
//     const { roleId } = req.params;
//     const { salaryRules } = req.body;

//     // Validate salaryRules object minimally
//     if (!salaryRules || salaryRules.baseSalary === undefined || salaryRules.baseSalary === null) {
//       return res.status(400).json({ success: false, message: "Invalid salary rules" });
//     }

//   const sanitizedSalaryRules = {
//     baseSalary: salaryRules.baseSalary ?? 0,
//     salaryType: salaryRules.salaryType ?? "monthly",
//     allowances: Array.isArray(salaryRules.allowances) ? salaryRules.allowances : [],
//     deductions: Array.isArray(salaryRules.deductions) ? salaryRules.deductions : [],
//     terminalBenefits: Array.isArray(salaryRules.terminalBenefits) ? salaryRules.terminalBenefits : [],
//   };

//     const updatedRole = await AllRoles.findByIdAndUpdate(
//       roleId,
//       { $set: { salaryRules: sanitizedSalaryRules } },
//       { new: true, runValidators: true }
//    );

//   if (!updatedRole) return res.status(404).json({ success: false, message: "Role not found" });

//     res.status(200).json({ success: true, data: updatedRole.salaryRules });
//   } catch (err) {
//     console.error("Error updating salary rules:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // 4. Optionally: Add a new role with salary rules
// export const createRoleWithSalaryRules = async (req, res) => {
//   try {
//     const { name, description, salaryRules } = req.body;
//     if (!name || !salaryRules || !salaryRules.baseSalary) {
//       return res.status(400).json({ success: false, message: "Invalid data" });
//     }

//     const role = await AllRoles.create({ name, description, salaryRules });
//     res.status(201).json({ success: true, data: role });
//   } catch (err) {
//     console.error("Error creating role:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };


// controllers/FinanceControllers/TablesControllers.js
import RoleModel from "../../models/HRModals/Role.model.js"; // ✅ Changed from AllRolesModels

// ✅ GET ALL SALARY RULES (from Roles)
export const getAllSalaryRules = async (req, res) => {
  try {
    const roles = await RoleModel.find({ isActive: true })
      .select('_id roleName description code status salaryRules')
      .lean();

    const formattedRoles = roles.map(role => ({
      _id: role._id,
      name: role.roleName, // ✅ Map roleName to name for frontend compatibility
      roleName: role.roleName,
      description: role.description,
      code: role.code,
      status: role.status,
      salaryRules: role.salaryRules,
    }));

    return res.status(200).json({
      success: true,
      data: formattedRoles,
    });
  } catch (err) {
    console.error("❌ getAllSalaryRules error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch salary rules",
      error: err.message,
    });
  }
};

// ✅ GET SALARY RULES BY ROLE ID
export const getSalaryRulesByRole = async (req, res) => {
  try {
    const { roleId } = req.params;

    const role = await RoleModel.findById(roleId)
      .select('_id roleName description code status salaryRules')
      .lean();

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    const formatted = {
      _id: role._id,
      name: role.roleName,
      roleName: role.roleName,
      description: role.description,
      code: role.code,
      status: role.status,
      salaryRules: role.salaryRules,
    };

    return res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (err) {
    console.error("❌ getSalaryRulesByRole error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch salary rules",
      error: err.message,
    });
  }
};

// ✅ UPDATE SALARY RULES
export const updateSalaryRules = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { salaryRules } = req.body;

    if (!salaryRules) {
      return res.status(400).json({
        success: false,
        message: "salaryRules object is required",
      });
    }

    // Validate salary rules structure
    const {
      baseSalary,
      salaryType,
      allowances,
      deductions,
      terminalBenefits,
    } = salaryRules;

    if (typeof baseSalary !== "number") {
      return res.status(400).json({
        success: false,
        message: "baseSalary must be a number",
      });
    }

    // Sanitize arrays
    const sanitizedSalaryRules = {
      baseSalary: Number(baseSalary),
      salaryType: salaryType || "monthly",
      allowances: Array.isArray(allowances) ? allowances : [],
      deductions: Array.isArray(deductions) ? deductions : [],
      terminalBenefits: Array.isArray(terminalBenefits) ? terminalBenefits : [],
    };

    // Update role
    const updatedRole = await RoleModel.findByIdAndUpdate(
      roleId,
      { salaryRules: sanitizedSalaryRules },
      { new: true, runValidators: true }
    );

    if (!updatedRole) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Salary rules updated successfully",
      data: {
        _id: updatedRole._id,
        name: updatedRole.roleName,
        salaryRules: updatedRole.salaryRules,
      },
    });
  } catch (err) {
    console.error("❌ updateSalaryRules error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update salary rules",
      error: err.message,
    });
  }
};

// ✅ CREATE ROLE WITH SALARY RULES
export const createRoleWithSalaryRules = async (req, res) => {
  try {
    const {
      roleName,
      description,
      code,
      status,
      salaryRules,
      permissions,
    } = req.body;

    // Validate required fields
    if (!roleName) {
      return res.status(400).json({
        success: false,
        message: "roleName is required",
      });
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Department code (HR/Finance/BusinessOperation) is required",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status (hierarchy level) is required",
      });
    }

    if (!salaryRules || typeof salaryRules.baseSalary !== "number") {
      return res.status(400).json({
        success: false,
        message: "Salary rules with base salary are required",
      });
    }

    // Check if role already exists
    const existingRole = await RoleModel.findOne({
      roleName: { $regex: new RegExp(`^${roleName}$`, "i") },
    });

    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: "Role with this name already exists",
      });
    }

    // Create new role
    const newRole = new RoleModel({
      roleName,
      description: description || "",
      code,
      status,
      salaryRules: {
        baseSalary: salaryRules.baseSalary,
        salaryType: salaryRules.salaryType || "monthly",
        allowances: Array.isArray(salaryRules.allowances) ? salaryRules.allowances : [],
        deductions: Array.isArray(salaryRules.deductions) ? salaryRules.deductions : [],
        terminalBenefits: Array.isArray(salaryRules.terminalBenefits) ? salaryRules.terminalBenefits : [],
      },
      permissions: permissions || [],
      isActive: true,
    });

    await newRole.save();

    return res.status(201).json({
      success: true,
      message: "Role with salary rules created successfully",
      data: {
        _id: newRole._id,
        name: newRole.roleName,
        roleName: newRole.roleName,
        description: newRole.description,
        code: newRole.code,
        status: newRole.status,
        salaryRules: newRole.salaryRules,
      },
    });
  } catch (err) {
    console.error("❌ createRoleWithSalaryRules error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create role",
      error: err.message,
    });
  }
};
