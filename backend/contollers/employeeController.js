// controllers/employee.controller.js
import mongoose from "mongoose";
import EmployeeModel from "../models/HRModals/Employee.model.js";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";

import { uploadFileToCloudinary, destroyImageFromCloudinary } from "../utilis/cloudinary.js";
import RoleModel from "../models/HRModals/Role.model.js";
import FinalizedEmployeeModel from "../models/HRModals/FinalizedEmployees.model.js";
import {OrgUnitModel} from "../models/HRModals/OrgUnit.js";
import { PermissionModel } from "../models/HRModals/Permissions.model.js";
import CounterModel from "../models/HRModals/Counter.model.js";
import {BranchModel} from "../models/HRModals/BranchModel.js";
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
// ---------------------------------------------------------------------------
import PermissionAggregator from "../utilis/permissionAggregation.js";
import HierarchyService from "../services/hierarchyService.js";
import { HierarchyGuard } from "../middlewares/hierarchyGuard.js";
import DepartmentGuard from "../middlewares/departmentGuard.js";
import CONSTANTS from "../configs/constants.js";
import AuditService from "../services/auditService.js";
import { isValidDepartment } from "../configs/departments.js";

// ------------helpers ---------------------
const transporter = nodemailer.createTransport({
  service: "gmail", // or 'outlook', 'yahoo', etc.
  auth: {
    user: process.env.EMAIL_USER, // your Gmail address
    pass: process.env.EMAIL_PASS, // app password (not your normal Gmail password)
  },
});

const SendEmail = async(finalizedEmployee) => {
          // send email..
    await transporter.sendMail({
      from: `"HR Department" <${process.env.EMAIL_USER}>`,
      to: finalizedEmployee.personalEmail, // ✅ send to personal email
      subject: "Your Employment Has Been Approved",
      text: `Dear ${finalizedEmployee.individualName},

    Congratulations! Your registration has been approved.

    Here are your login details:
    - User ID: ${finalizedEmployee.UserId}
    - Organization ID: ${finalizedEmployee.OrganizationId}
    - Password: ${finalizedEmployee.password}

    Please keep this information secure.`,

      html: `
        <p>Dear <b>${finalizedEmployee.individualName}</b>,</p>
        <p>Congratulations! Your registration has been <b>approved</b>.</p>

        <p><b>Here are your login details:</b></p>
        <ul>
          <li>User ID: <b>${finalizedEmployee.UserId}</b></li>
          <li>Organization ID: <b>${finalizedEmployee.OrganizationId}</b></li>
          <li>Password: <b>${finalizedEmployee.password}</b></li>
        </ul>

        <p><i>Please keep this information secure and do not share it with anyone.</i></p>
      `,
    });
};

//counter id - organizationId
export const getNextOrganizationId = async () => {
  const counter = await CounterModel.findOneAndUpdate(
    { name: "employee" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return counter.seq;
};

const generatePassword = () => Math.random().toString(36).slice(-8);
const hashPassword = async (password) => await bcrypt.hash(password, 10);
const toDate = (val) => (val ? new Date(val) : undefined);

const generateUserId = (finalizedEmployee) => {
  const userName = finalizedEmployee.individualName;

  // Remove all spaces
  const noSpaceUsername = userName.replace(/\s/g, "");

  const UserId = noSpaceUsername + "OBE" + finalizedEmployee.OrganizationId;
  return UserId;
};

const safeParse = (field, fieldName = "") => {
  try {
    return field ? JSON.parse(field) : undefined;
  } catch (err) {
    console.error(`❌ Failed to parse ${fieldName}:`, err.message);
    return undefined;
  }
};

const normalizeSalary = (src = {}) => ({
  startDate: toDate(src.startDate),
  type: src.type,
  amount: src.amount != null ? Number(src.amount) : undefined,
  terminalBenefits: Array.isArray(src.terminalBenefits)
    ? src.terminalBenefits.filter(Boolean)
    : src.terminalBenefits
    ? [src.terminalBenefits]
    : [],
  terminalBenefitDetails: src.terminalBenefitDetails,
});

const normalizeTenure = (src = {}) => ({
  joining: toDate(src.joining),
  confirmation: toDate(src.confirmation),
  retirement: toDate(src.retirement),
  contractExpiryOrRenewal: toDate(src.contractExpiryOrRenewal),
  promotion: toDate(src.promotion),
  otherEventDate: toDate(src.otherEventDate),
});

const normalizeChangeOfStatus = (src = {}) => ({
  status: src.status,
  date: toDate(src.date),
});

const normalizeEmploymentHistory = (src = {}) => ({
  employeeId: src.employeeId,
  orgName: src.orgName,
  releaseDate: toDate(src.releaseDate),
  designation: src.designation,
  organizationsWorkedFor: src.organizationsWorkedFor,
});

const normalizeTransfers = (arr) =>
  Array.isArray(arr)
    ? arr.map((t) => ({
        department: t.department,
        division: t.division,
        group: t.group,
        branch: t.branch,
        city: t.city,
        country: t.country,
        immediateBoss: t.immediateBoss,
        date: toDate(t.date),
      }))
    : [];

// --------------------------- controllers -------------------------
export const getAllEmployees = async (req, res) => {
  try {
    const employees = await EmployeeModel.find();

    console.log("employees: ", employees) 

    if (employees.length > 0) {
      return res.status(200).json({
        status: true,
        message: "Employees fetched successfully",
        employees,
      });
    } else {
      return res.status(404).json({
        status: false,
        message: "No employees found",
      });
    }
  } catch (error) {
    console.error("Error fetching employees:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

export const getSingleEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    console.log("ID: ", employeeId);

    if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing employee ID",
      });
    }

    const employee = await EmployeeModel.findById(employeeId);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.json({ success: true, data: employee });
  } catch (error) {
    console.error("Error fetching employee:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const deleteEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!employeeId) return res.status(400).json({ success: false, message: "employeeId is required" });

    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

    // ---------------- Delete avatar from Cloudinary ----------------
    if (employee.avatar?.public_id) {
      try {
        await destroyImageFromCloudinary(employee.avatar.public_id);
      } catch (err) {
        console.warn("Failed to delete Cloudinary image:", err.message);
      }
    }

    // ---------------- Find and delete Role ----------------
    const role = await RoleModel.findOne({ UserId: employee._id });
    if (role) {
      // Delete all permissions referenced by this role
      if (role.permissions && role.permissions.length > 0) {
        await PermissionModel.deleteMany({ _id: { $in: role.permissions } });
      }

      // Delete the role itself
      await RoleModel.findByIdAndDelete(role._id);

      // Remove OrgUnit reference inside Role (optional, since role is deleted)
      if (role.orgUnit) {
        await OrgUnitModel.findByIdAndUpdate(role.orgUnit, { $unset: { role: "" } });
      }
    }

    // ---------------- Remove OrgUnit reference from employee ----------------
    if (employee.OrgUnit) {
      await EmployeeModel.findByIdAndUpdate(employee._id, { $unset: { OrgUnit: "" } });
    }

    // ---------------- Delete Employee ----------------
    await EmployeeModel.findByIdAndDelete(employee._id);

    res.status(200).json({
      success: true,
      message: "Employee, role, permissions, OrgUnit references, and avatar deleted successfully",
    });

  } catch (error) {
    console.error("Delete Employee Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

export const RegisterEmployee = async (req, res) => {
  console.log("📝 Registering Employee Draft...");
  
  try {
    // 1. DATA HYDRATION (Comprehensive parsing for ALL nested fields)
    const complexFields = [
      'address', 
      'salary', 
      'tenure', 
      'employmentHistory', 
      'bankingDetails',
      'changeOfStatus', // 👈 Added
      'transfers'       // 👈 Added
    ];

    complexFields.forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        try { 
          req.body[field] = JSON.parse(req.body[field]); 
        } catch (e) {
          console.error(`❌ Failed to parse ${field}:`, e);
          // If it fails to parse, we might want to null it or keep it as is 
          // depending on your preference, but usually, it's a malformed string.
        }
      }
    });

    // 2. Fix Numeric and Date types from FormData
    if (req.body.salary && typeof req.body.salary.amount === 'string') {
      req.body.salary.amount = parseFloat(req.body.salary.amount);
    }

    // Ensure transfers is an array even if empty or single object
    if (req.body.transfers && !Array.isArray(req.body.transfers)) {
      req.body.transfers = [req.body.transfers];
    }

    const actorId = req.user._id;
    const {
      individualName, fatherName, dob, officialEmail, personalEmail,
      previousOrgEmail, address, employmentHistory, employmentStatus, salary, tenure
    } = req.body;

    // 3. MINIMAL VALIDATION
    if (!individualName || !fatherName || !dob || !officialEmail || !personalEmail) {
      return res.status(400).json({ success: false, message: "Missing core identity fields" });
    }

    // 4. EMAIL UNIQUE CHECK
    const duplicate = await EmployeeModel.findOne({
      $or: [
        { officialEmail: officialEmail.toLowerCase() },
        { personalEmail: personalEmail.toLowerCase() }
      ]
    });

    if (duplicate) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    // 5. CREATE DRAFT
    // Note: We use req.body spread AFTER hydration so the model gets Objects, not Strings
    const newEmployee = new EmployeeModel({
      ...req.body,
      officialEmail: officialEmail.toLowerCase(),
      personalEmail: personalEmail.toLowerCase(),
      DraftStatus: {
        status: "Draft",
        PostStatus: "Not Assigned"
      },
      finalizationStatus: "Pending"
    });

    if (req.file) newEmployee.profileImage = req.file.path;

    await newEmployee.save();

    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.EMPLOYEE_CREATED,
      actorId,
      targetId: newEmployee._id,
      details: { name: individualName, status: "Draft Created" }
    });

    res.status(201).json({
      success: true,
      message: "Employee draft created successfully.",
      employeeId: newEmployee._id
    });

  } catch (error) {
    console.error("❌ RegisterEmployee error:", error);
    // Return the specific Mongoose validation error message for better debugging
    res.status(500).json({ 
      success: false, 
      message: error.name === "ValidationError" ? "Data validation failed" : "Server error",
      error: error.message 
    });
  }
};

export const SubmitEmployee = async (req, res) => {
  try {
    const { employeeId, orgUnitId } = req.body;
    
    console.log("📝 SubmitEmployee called with:", { employeeId, orgUnitId });
    
    if (!employeeId || !orgUnitId) {
      return res.status(400).json({ 
        success: false, 
        message: "employeeId and orgUnitId are required" 
      });
    }

    // 1️⃣ Find draft employee
    const employee = await EmployeeModel.findById(employeeId)
      .populate('role')
      .populate('orgUnit');
      
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: "Employee not found" 
      });
    }

    console.log("👤 Employee found:", {
      name: employee.individualName,
      hasRole: !!employee.role,
      hasOrgUnit: !!employee.orgUnit,
      draftStatus: employee.DraftStatus?.status
    });

    // ✅ FIX: Check if employee has role (either as reference or populated)
    if (!employee.role) {
      return res.status(400).json({
        success: false,
        message: "Cannot submit employee: No role assigned. Please assign a role first."
      });
    }

    // ✅ FIX: Check if employee has orgUnit (either as reference or populated)
    if (!employee.orgUnit) {
      return res.status(400).json({
        success: false,
        message: "Cannot submit employee: No orgUnit assigned. Please assign an orgUnit first."
      });
    }

    // 2️⃣ Check for duplicate in finalized employees
    const duplicateFinalized = await FinalizedEmployeeModel.findOne({
      $or: [
        { officialEmail: employee.officialEmail },
        { personalEmail: employee.personalEmail },
        { govtId: employee.govtId },
        { passportNo: employee.passportNo },
        { alienRegNo: employee.alienRegNo },
      ].filter(condition => {
        const value = Object.values(condition)[0];
        return value && value !== null && value !== '';
      })
    });

    if (duplicateFinalized) {
      return res.status(400).json({
        success: false,
        message: "Duplicate employee exists in finalized employees",
        duplicateField: duplicateFinalized.officialEmail === employee.officialEmail ? 'officialEmail' : 
                       duplicateFinalized.personalEmail === employee.personalEmail ? 'personalEmail' :
                       duplicateFinalized.govtId === employee.govtId ? 'govtId' : 'other'
      });
    }

    // 3️⃣ Update draft employee status
    employee.DraftStatus.status = "Submitted";
    employee.finalizationStatus = "Pending";

    // 4️⃣ Generate Organization ID
    const OrganizationId = await getNextOrganizationId();
    employee.OrganizationId = OrganizationId;
    
    await employee.save();

    console.log("✅ Draft employee updated with OrganizationId:", OrganizationId);

    // 5️⃣ Get role ID (handle both populated and reference)
    const roleId = employee.role._id || employee.role;
    const orgUnitIdToUse = employee.orgUnit._id || employee.orgUnit;

    // 6️⃣ Verify orgUnit exists
    const orgUnit = await OrgUnitModel.findById(orgUnitIdToUse);
    if (!orgUnit) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid orgUnitId - OrgUnit not found" 
      });
    }

    // 7️⃣ Create or verify RoleAssignment exists
    let roleAssignment = await RoleAssignmentModel.findOne({
      employeeId: employee._id,
      roleId: roleId,
      isActive: true
    });

    // ✅ If no active assignment exists, create one
    if (!roleAssignment) {
      console.log("⚠️ No active RoleAssignment found, creating one...");
      
      const roleDeclaration = await RoleModel.findById(roleId);
      if (!roleDeclaration) {
        return res.status(400).json({
          success: false,
          message: "Role declaration not found"
        });
      }

      roleAssignment = new RoleAssignmentModel({
        employeeId: employee._id,
        roleId: roleId,
        orgUnit: orgUnitIdToUse,
        code: roleDeclaration.code,
        status: roleDeclaration.status,
        effectiveFrom: new Date(),
        effectiveUntil: null,
        assignedBy: null, // Set this if you have req.user
        isActive: true,
      });

      await roleAssignment.save();
      console.log("✅ Created RoleAssignment:", roleAssignment._id);
    } else {
      console.log("✅ Found existing RoleAssignment:", roleAssignment._id);
    }

    // 8️⃣ Prepare finalized employee data
    const finalizedData = {
      ...employee.toObject(),
      role: roleId, // Store reference to role
      orgUnit: orgUnitIdToUse, // Store reference to orgUnit
      roleAssignment: roleAssignment._id, // ✅ NEW: Store reference to assignment
      OrganizationId: OrganizationId,
      profileStatus: {
        submitted: true,
        decision: "Pending",
        passwordCreated: false,
        emailSent: false,
      },
    };

    // Remove draft-specific fields
    delete finalizedData.DraftStatus;
    delete finalizedData._id;
    delete finalizedData.__v;
    delete finalizedData.createdAt;
    delete finalizedData.updatedAt;

    // 9️⃣ Create finalized employee
    const finalizedEmployee = await FinalizedEmployeeModel.create(finalizedData);

    console.log("✅ FinalizedEmployee created:", finalizedEmployee._id);

    // 🔟 Update orgUnit with employee reference
    await OrgUnitModel.findByIdAndUpdate(orgUnitIdToUse, {
      $addToSet: { employees: finalizedEmployee._id }
    });

    // 1️⃣1️⃣ Update RoleAssignment to link to finalized employee (optional)
    roleAssignment.employeeId = finalizedEmployee._id;
    await roleAssignment.save();

    console.log("✅ Submit process completed successfully");

    return res.status(200).json({
      success: true,
      message: "Draft submitted successfully and FinalizedEmployee created",
      data: {
        finalizedEmployeeId: finalizedEmployee._id,
        roleAssignmentId: roleAssignment._id,
        roleId: roleId,
        orgUnitId: orgUnitIdToUse,
        OrganizationId: OrganizationId
      }
    });

  } catch (error) {
    console.error("🔥 SubmitEmployee error:", error.stack || error.message);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to submit draft",
      error: error.message 
    });
  }
};

export const ApproveEmployee = async (req, res) => {
  try {
    const { finalizedEmployeeId } = req.params;
    if (!finalizedEmployeeId) {
      return res.status(400).json({ success: false, message: "finalizedEmployeeId is required" });
    }

    const finalizedEmployee = await FinalizedEmployeeModel.findById(finalizedEmployeeId).populate("role");
    if (!finalizedEmployee) {
      return res.status(404).json({ success: false, message: "FinalizedEmployee not found" });
    }

    // 🔑 Generate password
    const tempPassword = generatePassword();
    const passwordHash = await hashPassword(tempPassword);

    // Generate the organization id
    const UserId  = generateUserId(finalizedEmployee);

    // 1️⃣ Update finalized employee
    finalizedEmployee.profileStatus.decision = "Approved";
    finalizedEmployee.profileStatus.passwordCreated = true;
    finalizedEmployee.passwordHash = passwordHash;
    finalizedEmployee.password = tempPassword;
    finalizedEmployee.UserId = UserId;
    // 3️⃣ Send email
    SendEmail(finalizedEmployee);
    finalizedEmployee.emailSent = true;

    await finalizedEmployee.save();

    // 4️⃣ Confirm assignment to OrgUnit
    if (finalizedEmployee.orgUnit) {
      await OrgUnitModel.findByIdAndUpdate(finalizedEmployee.orgUnit, { employee: finalizedEmployee._id });
    }

    // 5️⃣ Delete original draft employee
    if (finalizedEmployee._id) {
      await EmployeeModel.findByIdAndDelete(finalizedEmployee._id);
    }

    return res.status(200).json({
      success: true,
      message: "Employee approved and finalized successfully",
      tempPassword: process.env.NODE_ENV === "development" ? tempPassword : undefined,
      email: finalizedEmployee.personalEmail,
    });
  } catch (error) {
    console.error("🔥 ApproveEmployee error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Employee couldn't be approved" });
  }
};

export const RejectEmployee = async (req, res) => {
  try {
    const { finalizedEmployeeId } = req.params;
    if (!finalizedEmployeeId) return res.status(400).json({ success: false, message: "finalizedEmployeeId is required" });

    const finalizedEmployee = await FinalizedEmployeeModel.findById(finalizedEmployeeId);
    if (!finalizedEmployee) return res.status(404).json({ success: false, message: "FinalizedEmployee not found" });

    // Optional: delete avatar from cloudinary
    if (finalizedEmployee.avatar?.public_id) {
      try {
        await destroyImageFromCloudinary(finalizedEmployee.avatar.public_id);
      } catch (e) {
        console.warn("⚠️ Failed to delete avatar from Cloudinary:", e.message);
      }
    }

    // Mark rejected
    finalizedEmployee.profileStatus.decision = "Rejected";
    await finalizedEmployee.save();

    // Delete draft employee
    await EmployeeModel.findByIdAndDelete(finalizedEmployee._id);

    // Optional: delete finalizedEmployee document if you want complete cleanup
    await FinalizedEmployeeModel.findByIdAndDelete(finalizedEmployeeId);

    return res.status(200).json({ success: true, message: "Employee rejected and records cleaned successfully" });
  } catch (error) {
    console.error("🔥 RejectEmployee error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Failed to reject employee" });
  }
};

// this is for getting the id of the orgunit and orgunit object..
// Accepts either names or IDs for each level and returns the leaf OrgUnit
export const resolveOrgUnit = async (req, res) => {
  try {
    const { office, group, division, department, branch, cell, desk } = req.body;

    // Level order
    const levels = [
      { key: "office", value: office },
      { key: "group", value: group },
      { key: "division", value: division },
      { key: "department", value: department },
      { key: "branch", value: branch },
      { key: "cell", value: cell },
      { key: "desk", value: desk },
    ];

    let parent = null;
    let orgUnit = null;

    for (let { key, value } of levels) {
      if (!value) continue;

      // Check if value is a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(value)) {
        // Try to find by ID first
        orgUnit = await OrgUnitModel.findById(value);
        if (!orgUnit) {
          return res.status(404).json({ success: false, message: `${key} with provided ID not found` });
        }
      } else {
        // Treat value as name, check by name + parent
        orgUnit = await OrgUnitModel.findOne({ name: value, parent: parent?._id });
        if (!orgUnit) {
          // Create new node if not exists
          orgUnit = await OrgUnitModel.create({ name: value, parent: parent?._id });
        }
      }

      parent = orgUnit;
    }

    if (!orgUnit) {
      return res.status(400).json({ success: false, message: "No OrgUnit could be resolved" });
    }

    return res.status(200).json({ success: true, orgUnitId: orgUnit._id, orgUnit });
  } catch (error) {
    console.error("🔥 resolveOrgUnit error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllRoles = async (req, res) => {
  try {
    const roles = await RoleModel.find();

    if (!roles || roles.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No roles found",
        roles: [],
      });
    }

    return res.status(200).json({
      status: true,
      message: "Roles fetched successfully",
      roles,
    });
  } catch (error) {
    console.error("Error fetching roles:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message, // optional: include the error message for debugging
    });
  }
};

export const getSingleRole = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        status: false,
        message: "Id is either undefined or invalid",
      });
    }

    console.log("id check in getSingleRole:", id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: false, message: "Invalid employee ID" });
    }
    
    const roles = await RoleModel.findOne({ id });

    if (!roles) {
      // No roles yet → return success but empty data
      return res.status(200).json({
        status: true,
        message: "No roles assigned yet",
        roles: null, // <-- makes frontend easier to check
      });
    }

    return res.status(200).json({
      status: true,
      message: "Roles fetched successfully",
      roles,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

// ------------------ FInalized Employees -------------==
// get all or get single finalized employee.
export const getFinalizedEmployees = async (req, res) => {
  try {
    const finalizedEmployees = await FinalizedEmployeeModel.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: finalizedEmployees.length,
      data: finalizedEmployees
    });
  } catch (error) {
    console.error("🔥 GetAllFinalizedEmployees error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch finalized employees" });
  }
};

export const getSingleFinalizedEmployee = async (req, res) => {
  try {
    const { finalizedEmployeeId } = req.params;
    if (!finalizedEmployeeId) return res.status(400).json({ success: false, message: "finalizedEmployeeId is required" });

    const finalizedEmployee = await FinalizedEmployeeModel.findById(finalizedEmployeeId);
    if (!finalizedEmployee) return res.status(404).json({ success: false, message: "FinalizedEmployee not found" });

    return res.status(200).json({
      success: true,
      finalizedEmployee: finalizedEmployee
    });
  } catch (error) {
    console.error("🔥 GetSingleFinalizedEmployee error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch finalized employee" });
  }
};

// employees on the basis of the roles populated... 
export const getFinalizedEmployeesWithRoles = async (req, res) => {
  try {
    const finalizedEmployees = await FinalizedEmployeeModel.find()
      .sort({ createdAt: -1 })
      .populate({
        path: "role",
        model: "Role", // ✅ matches your RoleModel
        populate: {
          path: "permissions",
          model: "Permission", // ✅ make sure this matches your Permission model name
        },
      });

    return res.status(200).json({
      success: true,
      count: finalizedEmployees.length,
      data: finalizedEmployees,
    });
  } catch (error) {
    console.error("🔥 getFinalizedEmployeesWithRoles error:", error.stack || error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch finalized employees with roles" });
  }
};

export const deleteEmployeeAndFinalized = async (req, res) => {
  try {
    const { finalizedEmployeeId } = req.params;
    if (!finalizedEmployeeId) {
      return res.status(400).json({ success: false, message: "finalizedEmployeeId is required" });
    }

    // ---------------- Delete Finalized Employee ----------------
    const finalized = await FinalizedEmployeeModel.findById(finalizedEmployeeId);
    if (!finalized) {
      return res.status(404).json({ success: false, message: "Finalized employee not found" });
    }

    // Delete finalized avatar
    if (finalized.avatar?.public_id) {
      try { await destroyImageFromCloudinary(finalized.avatar.public_id); } 
      catch (err) { console.warn("Failed to delete finalized image:", err.message); }
    }

    // Delete finalized role & permissions
    if (finalized.role) {
      const finalizedRole = await RoleModel.findById(finalized.role);
      if (finalizedRole) {
        if (finalizedRole.permissions?.length)
          await PermissionModel.deleteMany({ _id: { $in: finalizedRole.permissions } });
        await RoleModel.findByIdAndDelete(finalizedRole._id);

        if (finalizedRole.orgUnit)
          await OrgUnitModel.findByIdAndUpdate(finalizedRole.orgUnit, { $unset: { role: "" } });
      }
    }

    // Remove OrgUnit reference
    if (finalized.OrgUnit)
      await FinalizedEmployeeModel.findByIdAndUpdate(finalized._id, { $unset: { OrgUnit: "" } });

    // ---------------- Delete Draft Employee (if exists) ----------------
   const employee = await EmployeeModel.findOne({ UserId: finalized.UserId });
    if (employee) {
      // Delete avatar
      if (employee.avatar?.public_id)
        await destroyImageFromCloudinary(employee.avatar.public_id);

      // Delete role & permissions
      if (employee.role) {
        const role = await RoleModel.findById(employee.role);
        if (role) {
          if (role.permissions?.length)
            await PermissionModel.deleteMany({ _id: { $in: role.permissions } });
          await RoleModel.findByIdAndDelete(role._id);

          if (role.orgUnit)
            await OrgUnitModel.findByIdAndUpdate(role.orgUnit, { $unset: { role: "" } });
        }
      }

      // Remove OrgUnit reference
      if (employee.OrgUnit)
        await EmployeeModel.findByIdAndUpdate(employee._id, { $unset: { OrgUnit: "" } });

      // Delete draft employee
      await EmployeeModel.findByIdAndDelete(employee._id);
    }

    // Delete finalized employee
    await FinalizedEmployeeModel.findByIdAndDelete(finalized._id);

    return res.status(200).json({ 
      success: true, 
      message: "Employee, finalized employee, avatars, roles, permissions, and OrgUnit references deleted successfully" 
    });

  } catch (error) {
    console.error("🔥 deleteEmployeeAndFinalized error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Failed to delete employee", error: error.message });
  }
};

export const suspendEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { suspensionReason, suspensionStartDate, suspensionEndDate } = req.body;

    const employee = await FinalizedEmployeeModel.findById(employeeId).populate("role");
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // Save previous system status
    employee.previous_status = employee.profileStatus.decision;

    // Save previous role
    employee.previous_role = employee.role._id;

    // Save current permissions
    const currentPermissions = employee.role.permissions.map((p) => p.toString());
    employee.rolePermissionsBackup = currentPermissions;

    // Update suspension info
    employee.suspension = {
      suspensionReason,
      suspensionStartDate,
      suspensionEndDate,
    };

    // Mark system status as suspended
    employee.profileStatus.decision = "Suspended";

    await employee.save();

    // ✉️ Send email notification
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: employee.personalEmail || employee.officialEmail, // choose whichever exists
      subject: "Suspension Notice",
      html: `
        <h2>Dear ${employee.individualName},</h2>
        <p>We regret to inform you that your account has been <strong>suspended</strong>.</p>
        <p><strong>Reason:</strong> ${suspensionReason}</p>
        <p><strong>Suspension Period:</strong> ${suspensionStartDate} to ${suspensionEndDate}</p>
        <p>If you believe this is a mistake or need clarification, please contact HR immediately.</p>
        <br/>
        <p>Regards,<br/>HR Department</p>
      `,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) console.error("Email sending failed:", err);
      else console.log("Suspension email sent:", info.response);
    });

    res.status(200).json({
      message: "Employee suspended successfully and email sent",
      employeeId: employee._id,
      suspension: employee.suspension,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to suspend employee", error: err.message });
  }
};

export const restoreSuspendedEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await FinalizedEmployeeModel.findById(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // Restore previous system status
    employee.profileStatus.decision = "Restored" || employee.previous_status;

    // Restore previous role
    employee.role = employee.previous_role;

    // Restore permissions if stored
    if (employee.rolePermissionsBackup) {
      const role = await RoleModel.findById(employee.role);
      role.permissions = employee.rolePermissionsBackup;
      await role.save();
    }

    // Clear suspension
    employee.suspension = {};
    employee.previous_status = undefined;
    employee.previous_role = undefined;
    employee.rolePermissionsBackup = undefined;

    await employee.save();

    // ✉️ Send email notification
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: employee.personalEmail || employee.officialEmail,
      subject: "Suspension Lifted",
      html: `
        <h2>Dear ${employee.individualName},</h2>
        <p>We are pleased to inform you that your suspension has been <strong>lifted</strong> and you are now restored to your previous status.</p>
        <p>You may now continue with your duties as normal.</p>
        <br/>
        <p>Regards,<br/>HR Department</p>
      `,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) console.error("Email sending failed:", err);
      else console.log("Restoration email sent:", info.response);
    });

    res.status(200).json({
      message: "Employee restored from suspension and email sent",
      employeeId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to restore employee", error: err.message });
  }
};

// ✅ Block employee
export const blockEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { blockReason, blockStartDate, blockEndDate } = req.body;

    const employee = await FinalizedEmployeeModel.findById(employeeId).populate("role");
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // Save previous system status
    employee.previous_status = employee.profileStatus.decision;

    // Save previous role
    employee.previous_role = employee.role?._id;

    // Save current permissions (backup)
    if (employee.role && employee.role.permissions) {
      const currentPermissions = employee.role.permissions.map((p) => p.toString());
      employee.rolePermissionsBackup = currentPermissions;
    }

    // Clear current role and permissions
    employee.role = undefined;
    employee.rolePermissionsBackup = employee.rolePermissionsBackup || []; // ensure backup stored

    // Update blocked info
    employee.blocked = {
      blockReason,
      blockStartDate,
      blockEndDate,
    };

    // Mark system status as blocked
    employee.profileStatus.decision = "Blocked";

    await employee.save();

    // ✉️ Send email notification
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: employee.personalEmail || employee.officialEmail,
      subject: "Account Blocked",
      html: `
        <h2>Dear ${employee.individualName},</h2>
        <p>We regret to inform you that your account has been <strong>blocked</strong>.</p>
        <p><strong>Reason:</strong> ${blockReason}</p>
        <p>During this period, your access to the system has been revoked. You cannot log in until HR restores your access.</p>
        <p>If you believe this is a mistake or require further clarification, please contact HR immediately.</p>
        <br/>
        <p>Regards,<br/>HR Department</p>
      `,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) console.error("Email sending failed:", err);
      else console.log("Block email sent:", info.response);
    });

    res.status(200).json({
      message: "Employee blocked successfully and email sent",
      employeeId: employee._id,
      blocked: employee.blocked,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to block employee", error: err.message });
  }
};

// ✅ Restore employee from block
export const restoreBlockedEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await FinalizedEmployeeModel.findById(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // Restore previous system status
    employee.profileStatus.decision = "Restored" || employee.previous_status;

    // Restore previous role
    employee.role = employee.previous_role;

    // Restore permissions if stored
    if (employee.rolePermissionsBackup && employee.role) {
      const role = await RoleModel.findById(employee.role);
      if (role) {
        role.permissions = employee.rolePermissionsBackup;
        await role.save();
      }
    }

    // Clear block
    employee.blocked = {};
    employee.previous_status = undefined;
    employee.previous_role = undefined;
    employee.rolePermissionsBackup = undefined;

    await employee.save();

    // ✉️ Send email notification
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: employee.personalEmail || employee.officialEmail,
      subject: "Account Restored",
      html: `
        <h2>Dear ${employee.individualName},</h2>
        <p>We are pleased to inform you that your account has been <strong>restored</strong>.</p>
        <p>You may now log in and continue with your duties as normal.</p>
        <br/>
        <p>Regards,<br/>HR Department</p>
      `,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) console.error("Email sending failed:", err);
      else console.log("Restore email sent:", info.response);
    });

    res.status(200).json({
      message: "Employee restored from blocked status and email sent",
      employeeId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to restore employee", error: err.message });
  }
};

// ✅ Terminate employee
export const terminateEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { terminateReason, terminateDate } = req.body;

    const employee = await FinalizedEmployeeModel.findById(employeeId).populate("role");
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // Save previous system status
    employee.previous_status = employee.profileStatus.decision || "Approved";

    // Save previous role
    employee.previous_role = employee.role?._id;

    // Save current permissions (backup)
    if (employee.role && employee.role.permissions) {
      const currentPermissions = employee.role.permissions.map((p) => p.toString());
      employee.rolePermissionsBackup = currentPermissions;
    }

    // Clear current role and permissions
    employee.role = undefined;
    employee.rolePermissionsBackup = employee.rolePermissionsBackup || [];

    // Update termination info
    employee.terminated = {
      terminateReason,
      terminateDate,
    };

    // Mark system status as terminated
    employee.profileStatus.decision = "Terminated";
    await employee.save();

    // ✉️ Send email notification
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: employee.personalEmail || employee.officialEmail,
      subject: "Employment Terminated",
      html: `
        <h2>Dear ${employee.individualName},</h2>
        <p>We regret to inform you that your employment has been <strong>terminated</strong>.</p>
        <p><strong>Reason:</strong> ${terminateReason}</p>
        <p>Effective from: ${terminateDate}</p>
        <p>If you require documents or have queries, kindly reach out to HR.</p>
        <br/>
        <p>Regards,<br/>HR Department</p>
      `,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) console.error("Email sending failed:", err);
      else console.log("Termination email sent:", info.response);
    });

    res.status(200).json({
      message: "Employee terminated successfully and email sent",
      employeeId: employee._id,
      terminated: employee.terminated,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to terminate employee", error: err.message });
  }
};

// ✅ Restore employee from termination
export const restoreTerminatedEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await FinalizedEmployeeModel.findById(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // Restore previous system status
    employee.profileStatus.decision = employee.previous_status;

    // Restore previous role
    employee.role = employee.previous_role;

    // Restore permissions if stored
    if (employee.rolePermissionsBackup && employee.role) {
      const role = await RoleModel.findById(employee.role);
      if (role) {
        role.permissions = employee.rolePermissionsBackup;
        await role.save();
      }
    }

    // Clear termination
    employee.terminated = {};
    employee.previous_status = undefined;
    employee.previous_role = undefined;
    employee.rolePermissionsBackup = undefined;

    await employee.save();

    // ✉️ Send email notification
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: employee.personalEmail || employee.officialEmail,
      subject: "Employment Restored",
      html: `
        <h2>Dear ${employee.individualName},</h2>
        <p>We are pleased to inform you that your employment has been <strong>restored</strong>.</p>
        <p>You may now resume your duties as normal.</p>
        <br/>
        <p>Regards,<br/>HR Department</p>
      `,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) console.error("Email sending failed:", err);
      else console.log("Restore termination email sent:", info.response);
    });

    res.status(200).json({
      message: "Employee restored from terminated status and email sent",
      employeeId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to restore terminated employee", error: err.message });
  }
};

export const checkAndRestoreEmployees = async () => {
  try {
    const employees = await FinalizedEmployeeModel.find()
      .populate("role")
      .populate("role.permissions");

    const today = new Date();

    for (const employee of employees) {
      let updated = false;
      let restoredFrom = null;

      // 🟠 Suspension check
      if (
        employee.profileStatus?.decision === "Suspended" &&
        employee.suspension?.suspensionEndDate &&
        new Date(employee.suspension.suspensionEndDate) <= today
      ) {
        employee.profileStatus.decision = "Restored";
        employee.suspension = {};
        updated = true;
        restoredFrom = "Suspended";
      }

      // 🔴 Termination check
      if (
        employee.profileStatus?.decision === "Terminated" &&
        employee.terminated?.terminationEndDate &&
        new Date(employee.terminated.terminationEndDate) <= today
      ) {
        employee.profileStatus.decision = "Restored";
        employee.terminated = {};
        updated = true;
        restoredFrom = "Terminated";
      }

      // ⛔ Block check
      if (
        employee.profileStatus?.decision === "Blocked" &&
        employee.blocked?.blockEndDate &&
        new Date(employee.blocked.blockEndDate) <= today
      ) {
        employee.profileStatus.decision = "Restored";
        employee.blocked = {};
        updated = true;
        restoredFrom = "Blocked";
      }

      // 🌿 Leave check
      if (
        employee.leave &&
        employee.leave.leaveEndDate &&
        new Date(employee.leave.leaveEndDate) <= today
      ) {
        // Restore delegated employee (target)
        if (employee.leave.transferredRoleTo) {
          const target = await FinalizedEmployeeModel.findById(employee.leave.transferredRoleTo)
            .populate("role")
            .populate("role.permissions");

          if (target && target.role) {
            // Restore target’s default role + permissions
            let cleanedPermissions = target.defaultPermissions || [];

            await RoleModel.findByIdAndUpdate(target.role._id, {
              permissions: cleanedPermissions,
            });

            if (target.previous_role) {
              target.role = target.previous_role;
            }

            target.previous_role = null;
            target.rolePermissionsBackup = [];
            await target.save();
            console.log(`🔄 Target restored: ${target.individualName}`);
          }
        }

        // Restore source employee
        if (employee.previous_role) {
          employee.role = employee.previous_role;
        }

        const restoredPermissions = [
          ...(employee.rolePermissionsBackup || []),
          ...(employee.defaultPermissions || []),
        ];

        if (employee.role) {
          await RoleModel.findByIdAndUpdate(employee.role._id, {
            permissions: [...new Set(restoredPermissions)],
          });
        }

        employee.leave = { onLeave: false, leaveAccepted: false, leaveRejected: false };
        employee.previous_role = null;
        employee.rolePermissionsBackup = [];
        updated = true;
        restoredFrom = "Leave";
      }

      if (updated) {
        await employee.save();
        console.log(`✅ Employee ${employee.individualName} restored from ${restoredFrom}`);
      }
    }

    return { success: true, message: "Employee statuses checked and restored where applicable" };
  } catch (err) {
    console.error("❌ Error restoring employees:", err);
    return { success: false, message: err.message };
  }
};

export const fetchEmployeesByStatus = async (req, res) => {
  try {
    // read the status from query params (example: ?status=Active)
    const { status } = req.query;

    if (!status) {
      return res.status(400).json({ message: "Status is required in query params" });
    }

    // find employees by status
    const employees = await FinalizedEmployeeModel.find({ status });

    return res.status(200).json({
      message: `Employees with status: ${status}`,
      count: employees.length,
      employees,
    });
  } catch (error) {
    console.error("Error fetching employees by status:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ---------------------- Edit Draft Employee ----------------------
export const EditEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const updateData = req.body;

    console.log("📝 EditEmployee called for:", employeeId);
    console.log("📦 Update data:", updateData);

    // Validate employee exists
    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    // Check if employee is already submitted
    if (employee.DraftStatus?.status === "Submitted") {
      return res.status(400).json({
        success: false,
        message: "Cannot edit submitted employee. Please reject and create new draft."
      });
    }

    // Handle file upload if present
    let uploadedImage = null;
    if (req.file) {
      try {
        // Delete old image if exists
        if (employee.avatar?.public_id) {
          await destroyImageFromCloudinary(employee.avatar.public_id);
        }
        
        // Upload new image
        uploadedImage = await uploadFileToCloudinary(
          req.file,
          "employees/profileImage"
        );
      } catch (uploadError) {
        console.warn("⚠️ Image upload failed:", uploadError.message);
      }
    }

    // Parse nested JSON fields if they're strings
    const parseIfString = (field) => {
      if (!field) return field;
      return typeof field === "string" ? JSON.parse(field) : field;
    };

    // Build update object
    const updates = {
      ...(updateData.individualName && { individualName: updateData.individualName }),
      ...(updateData.fatherName && { fatherName: updateData.fatherName }),
      ...(updateData.qualification && { qualification: updateData.qualification }),
      ...(updateData.dob && { dob: new Date(updateData.dob) }),
      ...(updateData.govtId && { govtId: updateData.govtId }),
      ...(updateData.passportNo && { passportNo: updateData.passportNo }),
      ...(updateData.alienRegNo && { alienRegNo: updateData.alienRegNo }),
      ...(updateData.officialEmail && { officialEmail: updateData.officialEmail }),
      ...(updateData.personalEmail && { personalEmail: updateData.personalEmail }),
      ...(updateData.previousOrgEmail && { previousOrgEmail: updateData.previousOrgEmail }),
      ...(updateData.employmentStatus && { employmentStatus: updateData.employmentStatus }),
      ...(updateData.address && { address: parseIfString(updateData.address) }),
      ...(updateData.salary && { salary: parseIfString(updateData.salary) }),
      ...(updateData.tenure && { tenure: parseIfString(updateData.tenure) }),
      ...(updateData.transfers && { transfers: parseIfString(updateData.transfers) }),
      ...(updateData.changeOfStatus && { changeOfStatus: parseIfString(updateData.changeOfStatus) }),
      ...(updateData.employmentHistory && { employmentHistory: parseIfString(updateData.employmentHistory) }),
      ...(updateData.bankingDetails && { bankingDetails: parseIfString(updateData.bankingDetails) }),
      ...(uploadedImage && {
        avatar: {
          url: uploadedImage.secure_url,
          public_id: uploadedImage.public_id,
        }
      }),
    };

    // Update employee
    const updatedEmployee = await EmployeeModel.findByIdAndUpdate(
      employeeId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    console.log("✅ Employee updated successfully");

    return res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      employee: updatedEmployee
    });

  } catch (error) {
    console.error("🔥 EditEmployee error:", error.stack || error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update employee",
      error: error.message
    });
  }
};

export const updateEmployeePermissions = async (req, res) => {
  try {
    const actorId = req.user._id;
    const { employeeId } = req.params;
    const { permissionsToAdd = [], permissionsToRemove = [] } = req.body;

    // ============================================================
    // VALIDATION: TARGET EXISTS
    // ============================================================
    const targetEmployee = await FinalizedEmployee.findById(employeeId);

    if (!targetEmployee) {
      return res.status(404).json({
        success: false,
        message: "Target employee not found"
      });
    }

    // ============================================================
    // HIERARCHICAL AUTHORITY CHECK
    // ============================================================
    const hierarchyCheck = await HierarchyGuard.canPerformAction(
      actorId,
      employeeId,
      'UPDATE_PERMISSIONS'
    );

    if (!hierarchyCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: "Insufficient hierarchical authority",
        reason: hierarchyCheck.reason,
        code: hierarchyCheck.code
      });
    }

    // ============================================================
    // GET ACTOR'S EFFECTIVE PERMISSIONS
    // ============================================================
    const actorPermissions = await PermissionAggregator.getEffectivePermissions(actorId);
    const actorEffective = actorPermissions.effective;
    const actorDepartment = actorPermissions.departmentCode;

    // ============================================================
    // VALIDATION: CANNOT GRANT WHAT YOU DON'T HAVE
    // ============================================================
    if (permissionsToAdd.length > 0) {
      const actorPermissionIds = new Set(
        actorEffective.map(p => p._id.toString())
      );

      const unauthorizedPermissions = [];

      for (const permId of permissionsToAdd) {
        if (!actorPermissionIds.has(permId.toString())) {
          // Actor doesn't have this permission
          const perm = await PermissionModel.findById(permId);
          unauthorizedPermissions.push({
            id: permId,
            name: perm?.name || 'Unknown'
          });
        }
      }

      if (unauthorizedPermissions.length > 0) {
        return res.status(403).json({
          success: false,
          message: "Cannot grant permissions you don't have",
          code: 'PERMISSION_ESCALATION_ATTEMPT',
          unauthorizedPermissions
        });
      }

      // ✅ ADDITIONAL CHECK: Department scope validation
      if (actorDepartment !== CONSTANTS.DEPARTMENTS.ALL) {
        const permissionsToCheck = await PermissionModel.find({
          _id: { $in: permissionsToAdd }
        });

        const outOfScopePermissions = permissionsToCheck.filter(perm => {
          // Permission must have actor's department in statusScope
          return !perm.statusScope.includes(actorDepartment) &&
                 !perm.statusScope.includes('ALL');
        });

        if (outOfScopePermissions.length > 0) {
          return res.status(403).json({
            success: false,
            message: "Cannot grant permissions outside your department scope",
            code: 'DEPARTMENT_SCOPE_VIOLATION',
            yourDepartment: actorDepartment,
            outOfScopePermissions: outOfScopePermissions.map(p => ({
              name: p.name,
              statusScope: p.statusScope
            }))
          });
        }
      }
    }

    // ============================================================
    // GET TARGET'S CURRENT ASSIGNMENT
    // ============================================================
    const targetAssignment = await RoleAssignmentModel.findOne({
      employeeId,
      isActive: true
    });

    if (!targetAssignment) {
      return res.status(404).json({
        success: false,
        message: "Target employee has no active role assignment"
      });
    }

    // ============================================================
    // UPDATE PERMISSION OVERRIDES
    // ============================================================
    let currentOverrides = targetAssignment.permissionOverrides || [];

    // Remove permissions
    if (permissionsToRemove.length > 0) {
      currentOverrides = currentOverrides.filter(
        pid => !permissionsToRemove.includes(pid.toString())
      );
    }

    // Add permissions
    if (permissionsToAdd.length > 0) {
      const newPermissions = permissionsToAdd.filter(
        pid => !currentOverrides.includes(pid)
      );
      currentOverrides.push(...newPermissions);
    }

    // Update assignment
    targetAssignment.permissionOverrides = currentOverrides;
    await targetAssignment.save();

    // ============================================================
    // AUDIT LOG
    // ============================================================
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.PERMISSION_MODIFIED,
      actorId,
      targetId: employeeId,
      details: {
        permissionsAdded: permissionsToAdd.length,
        permissionsRemoved: permissionsToRemove.length,
        totalOverrides: currentOverrides.length
      }
    });

    console.log(
      `✅ Permissions updated for ${targetEmployee.individualName} ` +
      `by ${req.user.individualName}`
    );

    res.status(200).json({
      success: true,
      message: "Employee permissions updated successfully",
      data: {
        employeeId,
        employeeName: targetEmployee.individualName,
        permissionOverrides: currentOverrides,
        changesSummary: {
          added: permissionsToAdd.length,
          removed: permissionsToRemove.length,
          total: currentOverrides.length
        }
      }
    });

  } catch (error) {
    console.error("❌ updateEmployeePermissions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update employee permissions",
      error: error.message
    });
  }
};

export const viewOrgUnitEmployees = async (req, res) => {
  try {
    const actorId = req.user._id;
    const { orgUnitId } = req.params;
    const { includeDirect = false } = req.query;

    // ============================================================
    // GET ACTOR'S CONTEXT
    // ============================================================
    const actorAssignment = await RoleAssignmentModel.findOne({
      employeeId: actorId,
      isActive: true
    }).populate('orgUnit');

    if (!actorAssignment) {
      return res.status(403).json({
        success: false,
        message: "No active role assignment"
      });
    }

    const actorOrgUnit = actorAssignment.orgUnit;
    const actorDepartment = actorAssignment.departmentCode;
    const isExecutive = actorDepartment === CONSTANTS.DEPARTMENTS.ALL;

    // ============================================================
    // DETERMINE TARGET ORG UNIT
    // ============================================================
    let targetOrgUnit;

    if (orgUnitId) {
      // Specific org unit requested
      targetOrgUnit = await OrgUnitModel.findById(orgUnitId);

      if (!targetOrgUnit) {
        return res.status(404).json({
          success: false,
          message: "Org unit not found"
        });
      }

      // ✅ AUTHORIZATION: Can only view own subtree
      if (!isExecutive) {
        const isInSubtree = 
          targetOrgUnit.path.startsWith(actorOrgUnit.path + '.') ||
          targetOrgUnit.path === actorOrgUnit.path;

        if (!isInSubtree) {
          return res.status(403).json({
            success: false,
            message: "You can only view employees in your organizational subtree",
            code: 'ORGUNIT_OUT_OF_SCOPE'
          });
        }
      }
    } else {
      // No specific unit - use actor's own org unit
      targetOrgUnit = actorOrgUnit;
    }

    // ============================================================
    // GET EMPLOYEES
    // ============================================================
    let orgUnitIds;

    if (includeDirect === 'true' || includeDirect === true) {
      // Only direct reports in this org unit
      orgUnitIds = [targetOrgUnit._id];
    } else {
      // Include entire subtree
      const descendants = await targetOrgUnit.getDescendants();
      orgUnitIds = [targetOrgUnit._id, ...descendants.map(d => d._id)];
    }

    // Build query
    let query = {
      orgUnit: { $in: orgUnitIds },
      isActive: true
    };

    // ✅ DEPARTMENT FILTER (unless executive)
    if (!isExecutive) {
      query.departmentCode = actorDepartment;
    }

    // Execute query
    const assignments = await RoleAssignmentModel.find(query)
      .populate('employeeId', 'individualName personalEmail UserId avatar profileStatus')
      .populate('roleId', 'roleName category')
      .populate('orgUnit', 'name type level path')
      .lean();

    // Filter out null employees
    const validAssignments = assignments.filter(a => a.employeeId);

    // ============================================================
    // ENRICH WITH PERMISSION DATA
    // ============================================================
    const enrichedEmployees = await Promise.all(
      validAssignments.map(async (assignment) => {
        const employee = assignment.employeeId;
        
        // Get permission breakdown
        const permBreakdown = await PermissionAggregator.getPermissionBreakdown(
          employee._id
        );

        return {
          ...employee,
          assignment: {
            roleId: assignment.roleId?._id,
            roleName: assignment.roleId?.roleName,
            roleCategory: assignment.roleId?.category,
            departmentCode: assignment.departmentCode,
            orgUnit: assignment.orgUnit,
            effectiveFrom: assignment.effectiveFrom
          },
          permissions: {
            directCount: permBreakdown.summary.directCount,
            inheritedCount: permBreakdown.summary.inheritedCount,
            totalEffective: permBreakdown.summary.totalEffective
          },
          hierarchy: {
            level: assignment.orgUnit.level,
            path: assignment.orgUnit.path
          }
        };
      })
    );

    // ============================================================
    // RESPONSE
    // ============================================================
    res.status(200).json({
      success: true,
      scope: {
        orgUnit: {
          _id: targetOrgUnit._id,
          name: targetOrgUnit.name,
          path: targetOrgUnit.path,
          level: targetOrgUnit.level
        },
        includedSubtree: !includeDirect,
        departmentFilter: isExecutive ? 'ALL' : actorDepartment,
        yourAccess: {
          isExecutive,
          department: actorDepartment,
          level: actorOrgUnit.level
        }
      },
      count: enrichedEmployees.length,
      employees: enrichedEmployees
    });

  } catch (error) {
    console.error("❌ viewOrgUnitEmployees error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employees",
      error: error.message
    });
  }
};

export const AssignEmployeePost = async (req, res) => {
  try {
    const actorId = req.user._id;
    const { employeeId, roleId, departmentCode, orgUnitId, branchId, effectiveFrom, notes } = req.body;

    // 1. VALIDATION
    if (!employeeId || !roleId || !departmentCode || !orgUnitId) {
      return res.status(400).json({ success: false, message: "Missing placement fields" });
    }

    // 2. FIND DRAFT EMPLOYEE (Modified from FinalizedEmployee to Employee)
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee draft not found" });
    }

    // 3. HIERARCHY CHECK (Can the actor act on this placement?)
    const targetOrgUnit = await OrgUnitModel.findById(orgUnitId);
    if (!targetOrgUnit) return res.status(404).json({ success: false, message: "Target OrgUnit not found" });

    // Assuming your HierarchyGuard handles the permission logic
    const hierarchyCheck = await HierarchyGuard.canPerformAction(actorId, employeeId, 'ASSIGN_ROLE');
    if (!hierarchyCheck.allowed) {
      return res.status(403).json({ success: false, message: hierarchyCheck.reason });
    }

    // 4. CREATE THE ASSIGNMENT
    const newAssignment = await RoleAssignmentModel.create({
      employeeId,
      roleId,
      departmentCode,
      orgUnit: orgUnitId,
      branchId: branchId || null,
      effectiveFrom: effectiveFrom || new Date(),
      isActive: true,
      assignedBy: actorId,
      notes: notes || ""
    });

    // 5. UPDATE THE DRAFT RECORD
    // Linking the assignment details back to the draft
    employee.orgUnit = orgUnitId;
    employee.role = roleId;
    employee.DraftStatus.PostStatus = "Assigned";
    await employee.save();

    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.ROLE_ASSIGNED,
      actorId,
      targetId: employeeId,
      details: { orgUnit: targetOrgUnit.name, department: departmentCode }
    });

    res.status(201).json({
      success: true,
      message: "Role and placement assigned to draft successfully",
      data: newAssignment
    });

  } catch (error) {
    console.error("❌ AssignEmployeePost error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};