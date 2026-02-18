// ============================================
// FILE: controllers/employeeController.js
// Complete Employee Management Controller with Comprehensive Audit Logging
// ============================================

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
import PermissionAggregator from "../utilis/permissionAggregation.js";
import HierarchyService from "../services/hierarchyService.js";
import { HierarchyGuard } from "../middlewares/hierarchyGuard.js";
import DepartmentGuard from "../middlewares/departmentGuard.js";
import CONSTANTS from "../configs/constants.js";
import AuditService from "../services/auditService.js";
import { isValidDepartment } from "../configs/constants.js";

// ============================================
// HELPER FUNCTIONS
// ============================================

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const SendEmail = async(finalizedEmployee) => {
  await transporter.sendMail({
    from: `"HR Department" <${process.env.EMAIL_USER}>`,
    to: finalizedEmployee.personalEmail,
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

// ============================================
// READ OPERATIONS (NO AUDIT)
// ============================================

/**
 * ✅ Get all draft employees (READ ONLY - NO AUDIT)
 */
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

/**
 * ✅ Get single draft employee (READ ONLY - NO AUDIT)
 */
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

/**
 * ✅ Get all roles (READ ONLY - NO AUDIT)
 */
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
      error: error.message,
    });
  }
};

/**
 * ✅ Get single role (READ ONLY - NO AUDIT)
 */
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
      return res.status(200).json({
        status: true,
        message: "No roles assigned yet",
        roles: null,
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

/**
 * ✅ Get all finalized employees (READ ONLY - NO AUDIT)
 */
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

/**
 * ✅ Get single finalized employee (READ ONLY - NO AUDIT)
 */
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

/**
 * ✅ Get finalized employees with roles (READ ONLY - NO AUDIT)
 */
export const getFinalizedEmployeesWithRoles = async (req, res) => {
  try {
    const finalizedEmployees = await FinalizedEmployeeModel.find()
      .sort({ createdAt: -1 })
      .populate({
        path: "role",
        model: "Role",
        populate: {
          path: "permissions",
          model: "Permission",
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

/**
 * ✅ Fetch employees by status (READ ONLY - NO AUDIT)
 */
export const fetchEmployeesByStatus = async (req, res) => {
  try {
    const { status } = req.query;

    if (!status) {
      return res.status(400).json({ message: "Status is required in query params" });
    }

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

/**
 * ✅ View org unit employees (READ ONLY - NO AUDIT)
 */
export const viewOrgUnitEmployees = async (req, res) => {
  try {
    const actorId = req.user._id;
    const { orgUnitId } = req.params;
    const { includeDirect = false } = req.query;

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

    let targetOrgUnit;

    if (orgUnitId) {
      targetOrgUnit = await OrgUnitModel.findById(orgUnitId);

      if (!targetOrgUnit) {
        return res.status(404).json({
          success: false,
          message: "Org unit not found"
        });
      }

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
      targetOrgUnit = actorOrgUnit;
    }

    let orgUnitIds;

    if (includeDirect === 'true' || includeDirect === true) {
      orgUnitIds = [targetOrgUnit._id];
    } else {
      const descendants = await targetOrgUnit.getDescendants();
      orgUnitIds = [targetOrgUnit._id, ...descendants.map(d => d._id)];
    }

    let query = {
      orgUnit: { $in: orgUnitIds },
      isActive: true
    };

    if (!isExecutive) {
      query.departmentCode = actorDepartment;
    }

    const assignments = await RoleAssignmentModel.find(query)
      .populate('employeeId', 'individualName personalEmail UserId avatar profileStatus')
      .populate('roleId', 'roleName category')
      .populate('orgUnit', 'name type level path')
      .lean();

    const validAssignments = assignments.filter(a => a.employeeId);

    const enrichedEmployees = await Promise.all(
      validAssignments.map(async (assignment) => {
        const employee = assignment.employeeId;
        
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

/**
 * ✅ Resolve org unit (READ/CREATE - CONDITIONAL AUDIT)
 */
export const resolveOrgUnit = async (req, res) => {
  try {
    const { office, group, division, department, branch, cell, desk } = req.body;

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
    let created = false;

    for (let { key, value } of levels) {
      if (!value) continue;

      if (mongoose.Types.ObjectId.isValid(value)) {
        orgUnit = await OrgUnitModel.findById(value);
        if (!orgUnit) {
          return res.status(404).json({ success: false, message: `${key} with provided ID not found` });
        }
      } else {
        orgUnit = await OrgUnitModel.findOne({ name: value, parent: parent?._id });
        if (!orgUnit) {
          orgUnit = await OrgUnitModel.create({ name: value, parent: parent?._id });
          created = true;

          // 🔍 AUDIT LOG - OrgUnit auto-created
          await AuditService.log({
            eventType: CONSTANTS.AUDIT_EVENTS.ORGUNIT_CREATED,
            actorId: req.user._id,
            targetId: orgUnit._id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: {
              autoCreated: true,
              orgUnitName: value,
              level: key,
              parentId: parent?._id
            }
          });
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

// ============================================
// CREATE OPERATIONS (WITH AUDIT)
// ============================================

/**
 * ✅ Register employee (draft creation)
 */
export const RegisterEmployee = async (req, res) => {
  console.log("📝 Registering Employee Draft...");
  
  try {
    const complexFields = [
      'address', 
      'salary', 
      'tenure', 
      'employmentHistory', 
      'bankingDetails',
      'changeOfStatus',
      'transfers'
    ];

    complexFields.push("documents");

    complexFields.forEach(field => {
      if (req.body[field] && typeof req.body[field] === "string") {
        try {
          req.body[field] = JSON.parse(req.body[field]);
        } catch (e) {
          console.error(`❌ Failed to parse ${field}:`, e);
        }
      }
    });

    // ==============================
    // Handle document files (not profile image)
    // ==============================
    let documents = [];

    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(file => {
        if (!file.fieldname.startsWith("documents")) return;

        // Extract index from documents[0][file]
        const match = file.fieldname.match(/documents\[(\d+)\]/);
        if (!match) return;

        const index = Number(match[1]);

        if (!documents[index]) documents[index] = {};

        documents[index].file = {
          url: `/uploads/${file.filename}`,   // REQUIRED
          public_id: file.filename,           // REQUIRED
          originalName: file.originalname,
          fileSize: file.size
        };
      });
    }

    req.body.documents = req.body.documents
      .map((doc, i) => ({
        ...doc,
        file: documents[i]?.file
      }))
      .filter(doc => doc.file);
      
    if (req.body.salary && typeof req.body.salary.amount === 'string') {
      req.body.salary.amount = parseFloat(req.body.salary.amount);
    }

    if (req.body.transfers && !Array.isArray(req.body.transfers)) {
      req.body.transfers = [req.body.transfers];
    }

    const actorId = req.user._id;
    const {
      individualName, fatherName, dob, officialEmail, personalEmail,
      previousOrgEmail, address, employmentHistory, employmentStatus, salary, tenure
    } = req.body;

    if (!individualName || !fatherName || !dob || !officialEmail || !personalEmail) {
      return res.status(400).json({ success: false, message: "Missing core identity fields" });
    }

    const duplicate = await EmployeeModel.findOne({
      $or: [
        { officialEmail: officialEmail.toLowerCase() },
        { personalEmail: personalEmail.toLowerCase() }
      ]
    });

    if (duplicate) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    const newEmployee = new EmployeeModel({
      ...req.body,
      documents: req.body.documents || [],
      officialEmail: officialEmail.toLowerCase(),
      personalEmail: personalEmail.toLowerCase(),
      DraftStatus: {
        status: "Draft",
        PostStatus: "Not Assigned"
      },
      finalizationStatus: "Pending"
    });

    // ============================================
    // ✅ FIXED: Handle profile image upload to Cloudinary
    // ============================================
    const profileImage = req.files?.find(
      f => f.fieldname === "profileImage"
    );

    if (profileImage) {
      try {
        console.log("📸 Uploading profile image to Cloudinary...");
        
        // Upload to Cloudinary using your existing utility
        const uploadResult = await uploadFileToCloudinary(
          profileImage, 
          "employees/avatars"  // Cloudinary folder
        );
        
        // ✅ Save as 'avatar' (matches Employee schema)
        newEmployee.avatar = {
          public_id: uploadResult.public_id,
          url: uploadResult.secure_url
        };
        
        console.log("✅ Avatar uploaded successfully:", uploadResult.secure_url);
      } catch (uploadError) {
        console.error("❌ Failed to upload avatar to Cloudinary:", uploadError);
        // Continue without avatar - non-critical error
        // The employee can still be created without a profile picture
      }
    }

    await newEmployee.save();

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.EMPLOYEE_CREATED,
      actorId,
      targetId: newEmployee._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { 
        name: individualName,
        email: personalEmail,
        status: "Draft Created",
        hasAvatar: !!newEmployee.avatar  // ✅ Track if avatar was uploaded
      }
    });

    res.status(201).json({
      success: true,
      message: "Employee draft created successfully.",
      employeeId: newEmployee._id,
      avatarUploaded: !!newEmployee.avatar  // ✅ Return avatar status
    });

  } catch (error) {
    console.error("❌ RegisterEmployee error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.name === "ValidationError" ? "Data validation failed" : "Server error",
      error: error.message 
    });
  }
};

/**
 * ✅ Submit employee for approval
 */
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

    if (!employee.role) {
      return res.status(400).json({
        success: false,
        message: "Cannot submit employee: No role assigned. Please assign a role first."
      });
    }

    if (!employee.orgUnit) {
      return res.status(400).json({
        success: false,
        message: "Cannot submit employee: No orgUnit assigned. Please assign an orgUnit first."
      });
    }

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

    employee.DraftStatus.status = "Submitted";
    employee.finalizationStatus = "Pending";

    const OrganizationId = await getNextOrganizationId();
    employee.OrganizationId = OrganizationId;
    
    await employee.save();

    console.log("✅ Draft employee updated with OrganizationId:", OrganizationId);

    const roleId = employee.role._id || employee.role;
    const orgUnitIdToUse = employee.orgUnit._id || employee.orgUnit;

    const orgUnit = await OrgUnitModel.findById(orgUnitIdToUse);
    if (!orgUnit) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid orgUnitId - OrgUnit not found" 
      });
    }

    let roleAssignment = await RoleAssignmentModel.findOne({
      employeeId: employee._id,
      roleId: roleId,
      isActive: true
    });

    if (!roleAssignment) {
      console.log("⚠️ No active RoleAssignment found, creating one...");
      
      const roleDeclaration = await RoleModel.findById(roleId);
      if (!roleDeclaration) {
        return res.status(400).json({
          success: false,
          message: "Role declaration not found"
        });
      }

      roleAssignment = await RoleAssignmentModel.create({
        employeeId: employee._id,
        roleId: roleId,
        departmentCode: orgUnit.departmentCode || "All",
        orgUnit: orgUnitIdToUse,
        branchId: null,
        status: "Active",
        isActive: true,
        effectiveFrom: new Date(),
        assignedBy: req.user._id
      });

      console.log("✅ RoleAssignment created:", roleAssignment._id);
    }

    const finalizedEmployee = new FinalizedEmployeeModel({
      ...employee.toObject(),
      _id: employee._id,
      role: roleId,
      orgUnit: orgUnitIdToUse,
      profileStatus: {
        decision: "Pending",
        passwordCreated: false
      }
    });

    await finalizedEmployee.save();

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.EMPLOYEE_SUBMITTED,
      actorId: req.user._id,
      targetId: employee._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        employeeName: employee.individualName,
        OrganizationId,
        orgUnit: orgUnit.name,
        roleName: roleDeclaration?.roleName
      }
    });

    res.status(200).json({
      success: true,
      message: "Employee submitted successfully and pending approval",
      data: {
        employeeId: employee._id,
        finalizedEmployeeId: finalizedEmployee._id,
        OrganizationId,
        status: "Submitted"
      }
    });

  } catch (error) {
    console.error("🔥 SubmitEmployee error:", error.stack || error.message);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to submit employee", 
      error: error.message 
    });
  }
};

/**
 * ✅ Approve employee
 */
export const ApproveEmployee = async (req, res) => {
  // Start a session for atomicity
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { finalizedEmployeeId } = req.params;

    if (!finalizedEmployeeId) {
      return res.status(400).json({ success: false, message: "finalizedEmployeeId is required" });
    }

    const finalizedEmployee = await FinalizedEmployeeModel.findById(finalizedEmployeeId).session(session);
    if (!finalizedEmployee) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "FinalizedEmployee not found" });
    }

    // 1. Credentials Generation
    const tempPassword = generatePassword();
    const passwordHash = await hashPassword(tempPassword);
    const UserId = generateUserId(finalizedEmployee);

    // 2. Prepare Finalized Document Updates
    finalizedEmployee.profileStatus.decision = "Approved";
    finalizedEmployee.profileStatus.passwordCreated = true;
    finalizedEmployee.passwordHash = passwordHash;
    finalizedEmployee.password = tempPassword;
    finalizedEmployee.UserId = UserId;

    // 3. Document Migration (The part you added)
    const draftEmployee = await EmployeeModel.findById(finalizedEmployee._id).session(session);
    
    if (draftEmployee) {
      if (draftEmployee.documents && draftEmployee.documents.length > 0) {
        finalizedEmployee.documents = draftEmployee.documents.map(doc => ({
          documentType: doc.documentType,
          customDocumentName: doc.customDocumentName,
          file: doc.file,
          uploadedAt: doc.uploadedAt,
          status: doc.status,
          reviewNotes: doc.reviewNotes,
          reviewedBy: doc.reviewedBy,
          reviewedAt: doc.reviewedAt
        }));
      }
      finalizedEmployee.documentCompletionStatus = draftEmployee.documentCompletionStatus;
      
      // Delete the draft since it's now finalized
      await EmployeeModel.findByIdAndDelete(finalizedEmployee._id).session(session);
    }

    // 4. Update Org Unit Assignment
    if (finalizedEmployee.orgUnit) {
      await OrgUnitModel.findByIdAndUpdate(
        finalizedEmployee.orgUnit, 
        { employee: finalizedEmployee._id },
        { session }
      );
    }

    // 5. Final Save & Email
    await finalizedEmployee.save({ session });
    
    // Note: Emailing is usually done outside the transaction 
    // because you can't "rollback" an email.
    await SendEmail(finalizedEmployee);
    finalizedEmployee.emailSent = true;
    await finalizedEmployee.save({ session });

    // 6. Audit Log
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.EMPLOYEE_APPROVED,
      actorId: req.user._id,
      targetId: finalizedEmployee._id,
      ipAddress: req.ip,
      details: { UserId, email: finalizedEmployee.personalEmail }
    });

    // Commit all changes
    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Employee approved and finalized successfully",
      tempPassword: process.env.NODE_ENV === "development" ? tempPassword : undefined,
    });

  } catch (error) {
    // If anything fails, undo all DB changes
    await session.abortTransaction();
    console.error("🔥 ApproveEmployee error:", error);
    return res.status(500).json({ success: false, message: "Approval failed. Data rolled back." });
  } finally {
    session.endSession();
  }
};

export const AssignEmployeePost = async (req, res) => {
  try {
    const actorId = req.user._id;
    const { employeeId, roleId, departmentCode, orgUnit, branchId, effectiveFrom, notes } = req.body;

    // ✅ Validation
    if (!employeeId || !roleId || !departmentCode || !orgUnit) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: employeeId, roleId, departmentCode, orgUnit" 
      });
    }

    // ✅ Check if employee exists (decide which model to use)
    // OPTION A: Using Employee (draft) model
    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // OPTION B: Only allow finalized employees (recommended)
    // const employee = await FinalizedEmployeeModel.findById(employeeId);
    // if (!employee) {
    //   return res.status(404).json({ 
    //     success: false, 
    //     message: "Employee not found or not yet finalized" 
    //   });
    // }

    // ✅ Validate OrgUnit exists
    const targetOrgUnit = await OrgUnitModel.findById(orgUnit);
    if (!targetOrgUnit) {
      return res.status(404).json({ success: false, message: "Organization unit not found" });
    }

    // ✅ Validate Role exists
    const role = await RoleModel.findById(roleId);
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    // ✅ NEW: Validate department matches orgUnit
    if (targetOrgUnit.departmentCode !== departmentCode && departmentCode !== "All") {
      return res.status(400).json({ 
        success: false, 
        message: `Selected position belongs to ${targetOrgUnit.departmentCode} department, not ${departmentCode}` 
      });
    }

    // ✅ NEW: Validate branch matches orgUnit (if branch specified)
    if (branchId) {
      const branch = await BranchModel.findById(branchId);
      if (!branch) {
        return res.status(404).json({ success: false, message: "Branch not found" });
      }
      
      if (targetOrgUnit.branchId && targetOrgUnit.branchId.toString() !== branchId) {
        return res.status(400).json({ 
          success: false, 
          message: "Selected position does not belong to the selected branch" 
        });
      }
    }

    // ✅ NEW: Check for existing active assignment
    const existingAssignment = await RoleAssignmentModel.findOne({
      employeeId,
      isActive: true
    });

    if (existingAssignment) {
      return res.status(400).json({ 
        success: false, 
        message: "Employee already has an active role assignment. Please deactivate it first or use transfer functionality." 
      });
    }

    // ✅ Create the role assignment
    const newAssignment = await RoleAssignmentModel.create({
      employeeId,
      roleId,
      departmentCode,
      orgUnit: orgUnit, // ✅ Note: using 'orgUnit' not 'orgUnitId'
      branchId: branchId || null,
      effectiveFrom: effectiveFrom || new Date(),
      isActive: true,
      assignedBy: actorId,
      notes: notes || ""
    });

    // ✅ Update employee record
    employee.orgUnit = orgUnit;
    employee.role = roleId;
    employee.DraftStatus.PostStatus = "Assigned";
    await employee.save();

    // ✅ Audit log
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.ROLE_ASSIGNED,
      actorId,
      targetId: employeeId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { 
        employeeName: employee.individualName,
        orgUnit: targetOrgUnit.name,
        orgUnitPath: targetOrgUnit.path,
        department: departmentCode,
        roleName: role.roleName,
        branchName: branchId ? (await BranchModel.findById(branchId))?.name : 'N/A'
      }
    });

    // ✅ Return success with populated data
    const populatedAssignment = await RoleAssignmentModel.findById(newAssignment._id)
      .populate('roleId', 'roleName category permissions')
      .populate('orgUnit', 'name type departmentCode path')
      .populate('branchId', 'name code');

    res.status(201).json({
      success: true,
      message: "Role and organizational placement assigned successfully",
      data: populatedAssignment
    });

  } catch (error) {
    console.error("❌ AssignEmployeePost error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error while assigning role",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// UPDATE OPERATIONS (WITH AUDIT)
// ============================================

/**
 * ✅ Edit draft employee
 */
export const EditEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const updateData = req.body;

    console.log("📝 EditEmployee called for:", employeeId);

    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    if (employee.DraftStatus?.status === "Submitted") {
      return res.status(400).json({
        success: false,
        message: "Cannot edit submitted employee. Please reject and create new draft."
      });
    }

    // Track changes for audit
    const changedFields = {};
    const trackableFields = [
      'individualName', 'fatherName', 'qualification', 'dob', 
      'officialEmail', 'personalEmail', 'employmentStatus'
    ];

    for (const field of trackableFields) {
      if (updateData[field] !== undefined && 
          JSON.stringify(employee[field]) !== JSON.stringify(updateData[field])) {
        changedFields[field] = {
          old: employee[field],
          new: updateData[field]
        };
      }
    }

    let uploadedImage = null;
    if (req.file) {
      try {
        if (employee.avatar?.public_id) {
          await destroyImageFromCloudinary(employee.avatar.public_id);
        }
        
        uploadedImage = await uploadFileToCloudinary(
          req.file,
          "employees/profileImage"
        );
      } catch (uploadError) {
        console.warn("⚠️ Image upload failed:", uploadError.message);
      }
    }

    const parseIfString = (field) => {
      if (!field) return field;
      return typeof field === "string" ? JSON.parse(field) : field;
    };

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

    const updatedEmployee = await EmployeeModel.findByIdAndUpdate(
      employeeId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    console.log("✅ Employee updated successfully");

    // 🔍 AUDIT LOG
    if (Object.keys(changedFields).length > 0) {
      await AuditService.log({
        eventType: CONSTANTS.AUDIT_EVENTS.EMPLOYEE_UPDATED,
        actorId: req.user._id,
        targetId: employeeId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: {
          employeeName: updatedEmployee.individualName,
          changedFields,
          avatarUpdated: !!uploadedImage
        }
      });
    }

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

/**
 * ✅ Update employee permissions
 */
export const updateEmployeePermissions = async (req, res) => {
  try {
    const actorId = req.user._id;
    const { employeeId } = req.params;
    const { permissionsToAdd = [], permissionsToRemove = [] } = req.body;

    const targetEmployee = await FinalizedEmployeeModel.findById(employeeId);

    if (!targetEmployee) {
      return res.status(404).json({
        success: false,
        message: "Target employee not found"
      });
    }

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

    const actorPermissions = await PermissionAggregator.getEffectivePermissions(actorId);
    const actorEffective = actorPermissions.effective;
    const actorDepartment = actorPermissions.departmentCode;

    if (permissionsToAdd.length > 0) {
      const actorPermissionIds = new Set(
        actorEffective.map(p => p._id.toString())
      );

      const unauthorizedPermissions = [];

      for (const permId of permissionsToAdd) {
        if (!actorPermissionIds.has(permId.toString())) {
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

      if (actorDepartment !== CONSTANTS.DEPARTMENTS.ALL) {
        const permissionsToCheck = await PermissionModel.find({
          _id: { $in: permissionsToAdd }
        });

        const outOfScopePermissions = permissionsToCheck.filter(perm => {
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

    let currentOverrides = targetAssignment.permissionOverrides || [];

    if (permissionsToRemove.length > 0) {
      currentOverrides = currentOverrides.filter(
        pid => !permissionsToRemove.includes(pid.toString())
      );
    }

    if (permissionsToAdd.length > 0) {
      const newPermissions = permissionsToAdd.filter(
        pid => !currentOverrides.includes(pid)
      );
      currentOverrides.push(...newPermissions);
    }

    targetAssignment.permissionOverrides = currentOverrides;
    await targetAssignment.save();

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.PERMISSION_MODIFIED,
      actorId,
      targetId: employeeId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        employeeName: targetEmployee.individualName,
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

/**
 * ✅ Suspend employee
 */
export const suspendEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { suspensionReason, suspensionStartDate, suspensionEndDate } = req.body;

    const employee = await FinalizedEmployeeModel.findById(employeeId).populate("role");
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    employee.previous_status = employee.profileStatus.decision;
    employee.previous_role = employee.role._id;

    const currentPermissions = employee.role.permissions.map((p) => p.toString());
    employee.rolePermissionsBackup = currentPermissions;

    employee.suspension = {
      suspensionReason,
      suspensionStartDate,
      suspensionEndDate,
    };

    employee.profileStatus.decision = "Suspended";

    await employee.save();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: employee.personalEmail || employee.officialEmail,
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

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.EMPLOYEE_SUSPENDED,
      actorId: req.user._id,
      targetId: employeeId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        employeeName: employee.individualName,
        reason: suspensionReason,
        startDate: suspensionStartDate,
        endDate: suspensionEndDate
      }
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

/**
 * ✅ Restore suspended employee
 */
export const restoreSuspendedEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await FinalizedEmployeeModel.findById(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    const previousStatus = employee.previous_status;

    employee.profileStatus.decision = "Restored" || employee.previous_status;
    employee.role = employee.previous_role;

    if (employee.rolePermissionsBackup) {
      const role = await RoleModel.findById(employee.role);
      role.permissions = employee.rolePermissionsBackup;
      await role.save();
    }

    employee.suspension = {};
    employee.previous_status = undefined;
    employee.previous_role = undefined;
    employee.rolePermissionsBackup = undefined;

    await employee.save();

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

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.EMPLOYEE_RESTORED,
      actorId: req.user._id,
      targetId: employeeId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        employeeName: employee.individualName,
        restoredFrom: 'Suspended',
        previousStatus
      }
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

/**
 * ✅ Block employee
 */
export const blockEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { blockReason, blockStartDate, blockEndDate } = req.body;

    const employee = await FinalizedEmployeeModel.findById(employeeId).populate("role");
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    employee.previous_status = employee.profileStatus.decision;
    employee.previous_role = employee.role._id;

    const currentPermissions = employee.role.permissions.map((p) => p.toString());
    employee.rolePermissionsBackup = currentPermissions;

    employee.blocked = {
      blockReason,
      blockStartDate,
      blockEndDate,
    };

    employee.profileStatus.decision = "Blocked";
    await employee.save();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: employee.personalEmail || employee.officialEmail,
      subject: "Account Blocked",
      html: `
        <h2>Dear ${employee.individualName},</h2>
        <p>We regret to inform you that your account has been <strong>blocked</strong>.</p>
        <p><strong>Reason:</strong> ${blockReason}</p>
        <p><strong>Block Period:</strong> ${blockStartDate} to ${blockEndDate}</p>
        <p>Please contact HR for assistance.</p>
        <br/>
        <p>Regards,<br/>HR Department</p>
      `,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) console.error("Email sending failed:", err);
      else console.log("Block email sent:", info.response);
    });

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.EMPLOYEE_BLOCKED,
      actorId: req.user._id,
      targetId: employeeId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        employeeName: employee.individualName,
        reason: blockReason,
        startDate: blockStartDate,
        endDate: blockEndDate
      }
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

/**
 * ✅ Restore blocked employee
 */
export const restoreBlockedEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await FinalizedEmployeeModel.findById(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    const previousStatus = employee.previous_status;

    employee.profileStatus.decision = employee.previous_status;
    employee.role = employee.previous_role;

    if (employee.rolePermissionsBackup && employee.role) {
      const role = await RoleModel.findById(employee.role);
      if (role) {
        role.permissions = employee.rolePermissionsBackup;
        await role.save();
      }
    }

    employee.blocked = {};
    employee.previous_status = undefined;
    employee.previous_role = undefined;
    employee.rolePermissionsBackup = undefined;

    await employee.save();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: employee.personalEmail || employee.officialEmail,
      subject: "Account Unblocked",
      html: `
        <h2>Dear ${employee.individualName},</h2>
        <p>We are pleased to inform you that your account has been <strong>unblocked</strong>.</p>
        <p>You may now resume your duties as normal.</p>
        <br/>
        <p>Regards,<br/>HR Department</p>
      `,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) console.error("Email sending failed:", err);
      else console.log("Unblock email sent:", info.response);
    });

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.EMPLOYEE_RESTORED,
      actorId: req.user._id,
      targetId: employeeId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        employeeName: employee.individualName,
        restoredFrom: 'Blocked',
        previousStatus
      }
    });

    res.status(200).json({
      message: "Employee unblocked successfully and email sent",
      employeeId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to restore blocked employee", error: err.message });
  }
};

/**
 * ✅ Terminate employee
 */
export const terminateEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { terminateReason, terminateDate } = req.body;

    const employee = await FinalizedEmployeeModel.findById(employeeId).populate("role");
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    employee.previous_status = employee.profileStatus.decision;
    employee.previous_role = employee.role._id;

    if (employee.role && employee.role.permissions) {
      employee.rolePermissionsBackup = employee.role.permissions.map((p) => p.toString());
    }
    employee.rolePermissionsBackup = employee.rolePermissionsBackup || [];

    employee.terminated = {
      terminateReason,
      terminateDate,
    };

    employee.profileStatus.decision = "Terminated";
    await employee.save();

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

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.EMPLOYEE_TERMINATED,
      actorId: req.user._id,
      targetId: employeeId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        employeeName: employee.individualName,
        reason: terminateReason,
        terminateDate
      }
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

/**
 * ✅ Restore terminated employee
 */
export const restoreTerminatedEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await FinalizedEmployeeModel.findById(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    const previousStatus = employee.previous_status;

    employee.profileStatus.decision = employee.previous_status;
    employee.role = employee.previous_role;

    if (employee.rolePermissionsBackup && employee.role) {
      const role = await RoleModel.findById(employee.role);
      if (role) {
        role.permissions = employee.rolePermissionsBackup;
        await role.save();
      }
    }

    employee.terminated = {};
    employee.previous_status = undefined;
    employee.previous_role = undefined;
    employee.rolePermissionsBackup = undefined;

    await employee.save();

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

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.EMPLOYEE_RESTORED,
      actorId: req.user._id,
      targetId: employeeId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        employeeName: employee.individualName,
        restoredFrom: 'Terminated',
        previousStatus
      }
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

// ============================================
// DELETE OPERATIONS (WITH AUDIT)
// ============================================

/**
 * ✅ Delete draft employee
 */
export const deleteEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!employeeId) return res.status(400).json({ success: false, message: "employeeId is required" });

    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

    // Store details before deletion
    const deletedDetails = {
      name: employee.individualName,
      email: employee.personalEmail,
      officialEmail: employee.officialEmail,
      status: employee.DraftStatus?.status
    };

    if (employee.avatar?.public_id) {
      try {
        await destroyImageFromCloudinary(employee.avatar.public_id);
      } catch (err) {
        console.warn("Failed to delete Cloudinary image:", err.message);
      }
    }

    const role = await RoleModel.findOne({ UserId: employee._id });
    if (role) {
      if (role.permissions && role.permissions.length > 0) {
        await PermissionModel.deleteMany({ _id: { $in: role.permissions } });
      }

      await RoleModel.findByIdAndDelete(role._id);

      if (role.orgUnit) {
        await OrgUnitModel.findByIdAndUpdate(role.orgUnit, { $unset: { role: "" } });
      }
    }

    if (employee.OrgUnit) {
      await EmployeeModel.findByIdAndUpdate(employee._id, { $unset: { OrgUnit: "" } });
    }

    await EmployeeModel.findByIdAndDelete(employee._id);

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.EMPLOYEE_DELETED,
      actorId: req.user._id,
      targetId: employeeId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: deletedDetails
    });

    res.status(200).json({
      success: true,
      message: "Employee, role, permissions, OrgUnit references, and avatar deleted successfully",
    });

  } catch (error) {
    console.error("Delete Employee Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

/**
 * ✅ Reject employee
 */
export const RejectEmployee = async (req, res) => {
  try {
    const { finalizedEmployeeId } = req.params;
    if (!finalizedEmployeeId) return res.status(400).json({ success: false, message: "finalizedEmployeeId is required" });

    const finalizedEmployee = await FinalizedEmployeeModel.findById(finalizedEmployeeId);
    if (!finalizedEmployee) return res.status(404).json({ success: false, message: "FinalizedEmployee not found" });

    // Store details before deletion
    const rejectedDetails = {
      name: finalizedEmployee.individualName,
      email: finalizedEmployee.personalEmail,
      OrganizationId: finalizedEmployee.OrganizationId
    };

    if (finalizedEmployee.avatar?.public_id) {
      try {
        await destroyImageFromCloudinary(finalizedEmployee.avatar.public_id);
      } catch (e) {
        console.warn("⚠️ Failed to delete avatar from Cloudinary:", e.message);
      }
    }

    finalizedEmployee.profileStatus.decision = "Rejected";
    await finalizedEmployee.save();

    await EmployeeModel.findByIdAndDelete(finalizedEmployee._id);
    await FinalizedEmployeeModel.findByIdAndDelete(finalizedEmployeeId);

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.EMPLOYEE_REJECTED,
      actorId: req.user._id,
      targetId: finalizedEmployeeId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: rejectedDetails
    });

    return res.status(200).json({ success: true, message: "Employee rejected and records cleaned successfully" });
  } catch (error) {
    console.error("🔥 RejectEmployee error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Failed to reject employee" });
  }
};

/**
 * ✅ Delete employee and finalized
 */
export const deleteEmployeeAndFinalized = async (req, res) => {
  try {
    const { finalizedEmployeeId } = req.params;
    if (!finalizedEmployeeId) {
      return res.status(400).json({ success: false, message: "finalizedEmployeeId is required" });
    }

    const finalized = await FinalizedEmployeeModel.findById(finalizedEmployeeId);
    if (!finalized) {
      return res.status(404).json({ success: false, message: "Finalized employee not found" });
    }

    // Store details before deletion
    const deletedDetails = {
      name: finalized.individualName,
      UserId: finalized.UserId,
      email: finalized.personalEmail,
      OrganizationId: finalized.OrganizationId
    };

    if (finalized.avatar?.public_id) {
      try { await destroyImageFromCloudinary(finalized.avatar.public_id); } 
      catch (err) { console.warn("Failed to delete finalized image:", err.message); }
    }

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

    if (finalized.OrgUnit)
      await FinalizedEmployeeModel.findByIdAndUpdate(finalized._id, { $unset: { OrgUnit: "" } });

   const employee = await EmployeeModel.findOne({ UserId: finalized.UserId });
    if (employee) {
      if (employee.avatar?.public_id)
        await destroyImageFromCloudinary(employee.avatar.public_id);

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

      if (employee.OrgUnit)
        await EmployeeModel.findByIdAndUpdate(employee._id, { $unset: { OrgUnit: "" } });

      await EmployeeModel.findByIdAndDelete(employee._id);
    }

    await FinalizedEmployeeModel.findByIdAndDelete(finalized._id);

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.EMPLOYEE_DELETED,
      actorId: req.user._id,
      targetId: finalizedEmployeeId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        ...deletedDetails,
        completePurge: true
      }
    });

    return res.status(200).json({ 
      success: true, 
      message: "Employee, finalized employee, avatars, roles, permissions, and OrgUnit references deleted successfully" 
    });

  } catch (error) {
    console.error("🔥 deleteEmployeeAndFinalized error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Failed to delete employee", error: error.message });
  }
};

// ============================================
// UTILITY / AUTOMATION FUNCTIONS
// ============================================

/**
 * ✅ Check and restore employees (Automated - NO AUDIT)
 * This is an automated system task, not a user action
 */
export const checkAndRestoreEmployees = async () => {
  try {
    const employees = await FinalizedEmployeeModel.find()
      .populate("role")
      .populate("role.permissions");

    const today = new Date();

    for (const employee of employees) {
      let updated = false;
      let restoredFrom = null;

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

      if (
        employee.leave &&
        employee.leave.leaveEndDate &&
        new Date(employee.leave.leaveEndDate) <= today
      ) {
        if (employee.leave.transferredRoleTo) {
          const target = await FinalizedEmployeeModel.findById(employee.leave.transferredRoleTo)
            .populate("role")
            .populate("role.permissions");

          if (target && target.role) {
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