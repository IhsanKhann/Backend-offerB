// ✅ REFACTORED: Notification Factory
// Resolves recipients via active role assignments at runtime
import Notification from "../models/BussinessOperationModals/Notifications.js";
import NotificationRule from "../models/BussinessOperationModals/NotificationsRule.js";
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import FinalizedEmployeesModel from "../models/HRModals/FinalizedEmployees.model.js";
import RoleModel from "../models/HRModals/Role.model.js";
import { getDepartmentFromEvent } from "../events/events.js";

/**
 * ✅ REFACTORED: Main notification factory function
 * Creates notifications based on event type and payload
 */
export async function createNotificationsFromEvent(eventType, payload) {
  try {
    console.log(`📧 Creating notifications for event: ${eventType}`);

    // Find matching notification rules
    const rules = await NotificationRule.find({
      eventType,
      enabled: true,
    }).populate("targetRoles");

    if (!rules.length) {
      console.log(`⚠️ No notification rules found for event: ${eventType}`);
      return;
    }

    for (const rule of rules) {
      try {
        // ✅ Resolve target employees based on targeting strategy
        const targetEmployees = await resolveTargetEmployees(rule, payload);

        if (!targetEmployees.length) {
          console.log(`⚠️ No target employees found for rule: ${rule._id}`);
          continue;
        }

        // Render template with payload data
        const title = renderTemplate(rule.template.title, payload);
        const message = renderTemplate(rule.template.message, payload);

        // Determine department for notification
        const department = rule.departmentFilter || getDepartmentFromEvent(eventType) || "ALL";

        // Create notification
        await Notification.create({
          eventType,
          title,
          message,
          department,
          priority: rule.priority,
          recipients: targetEmployees.map((emp) => ({
            userId: emp._id,
            read: false,
          })),
          actionUrl: payload.actionUrl || null,
          metadata: payload,
          status: "sent",
        });

        console.log(
          `✅ Notification created for ${targetEmployees.length} recipients`
        );
      } catch (ruleError) {
        console.error(`❌ Error processing rule ${rule._id}:`, ruleError);
      }
    }
  } catch (error) {
    console.error("❌ createNotificationsFromEvent error:", error);
    throw error;
  }
}

/**
 * ✅ REFACTORED: Resolve target employees based on notification rule
 * Resolves recipients via active role assignments at runtime
 */
async function resolveTargetEmployees(rule, payload) {
  const strategy = rule.targetingStrategy;

  switch (strategy) {
    case "global_roles":
      return resolveGlobalRoles(rule, payload);
    
    case "department_roles":
      return resolveDepartmentRoles(rule, payload);
    
    case "specific_users":
      return resolveSpecificUsers(rule, payload);
    
    case "department_all":
      return resolveDepartmentAll(rule, payload);
    
    default:
      console.warn(`Unknown targeting strategy: ${strategy}`);
      return [];
  }
}

/**
 * ✅ Resolve global roles (organization-wide)
 * Example: All "Chairman" role holders regardless of department
 */
async function resolveGlobalRoles(rule, payload) {
  if (!rule.targetRoles?.length) return [];

  const roleIds = rule.targetRoles.map(r => r._id || r);

  // Find ALL active assignments for these roles
  const assignments = await RoleAssignmentModel.find({
    roleId: { $in: roleIds },
    isActive: true,
    effectiveFrom: { $lte: new Date() },
    $or: [
      { effectiveUntil: null },
      { effectiveUntil: { $gte: new Date() }}
    ]
  })
  .populate("employeeId", "_id individualName personalEmail")
  .lean();

  return assignments
    .map(a => a.employeeId)
    .filter(emp => emp !== null);
}

/**
 * ✅ Resolve department-filtered roles
 * Example: All "Finance Manager" role holders in Finance department
 */
async function resolveDepartmentRoles(rule, payload) {
  if (!rule.targetRoles?.length) return [];

  const roleIds = rule.targetRoles.map(r => r._id || r);
  
  // Build filter
  const filter = {
    roleId: { $in: roleIds },
    isActive: true,
    effectiveFrom: { $lte: new Date() },
    $or: [
      { effectiveUntil: null },
      { effectiveUntil: { $gte: new Date() }}
    ]
  };

  // ✅ Apply department filter if specified
  if (rule.departmentFilter) {
    filter.departmentCode = rule.departmentFilter;
  }

  // ✅ Apply status filter if specified
  if (rule.statusFilter) {
    filter.status = rule.statusFilter;
  }

  const assignments = await RoleAssignmentModel.find(filter)
    .populate("employeeId", "_id individualName personalEmail")
    .lean();

  return assignments
    .map(a => a.employeeId)
    .filter(emp => emp !== null);
}

/**
 * ✅ Resolve specific users
 */
async function resolveSpecificUsers(rule, payload) {
  if (!rule.targetUserIds?.length) return [];

  const employees = await FinalizedEmployeesModel.find({
    _id: { $in: rule.targetUserIds }
  })
  .select("_id individualName personalEmail")
  .lean();

  return employees;
}

/**
 * ✅ Resolve all employees in department
 */
async function resolveDepartmentAll(rule, payload) {
  if (!rule.departmentFilter) {
    console.warn("department_all strategy requires departmentFilter");
    return [];
  }

  const assignments = await RoleAssignmentModel.find({
    departmentCode: rule.departmentFilter,
    isActive: true,
    effectiveFrom: { $lte: new Date() },
    $or: [
      { effectiveUntil: null },
      { effectiveUntil: { $gte: new Date() }}
    ]
  })
  .populate("employeeId", "_id individualName personalEmail")
  .lean();

  return assignments
    .map(a => a.employeeId)
    .filter(emp => emp !== null);
}

/**
 * Render template with payload data
 */
function renderTemplate(template, payload) {
  if (!template) return "";

  let rendered = template;

  // Replace all {{key}} placeholders with payload values
  const matches = template.match(/\{\{(\w+)\}\}/g);

  if (matches) {
    matches.forEach((match) => {
      const key = match.replace(/\{\{|\}\}/g, "");
      const value = payload[key] || "";
      rendered = rendered.replace(match, value);
    });
  }

  return rendered;
}

/**
 * ✅ HELPER: Send notification to global role holders
 */
export async function notifyGlobalRole(roleName, eventType, payload) {
  try {
    console.log(`📧 Sending notification to global role: ${roleName}`);

    // Find role declaration
    const role = await RoleModel.findOne({ roleName, isActive: true });
    if (!role) {
      console.log(`⚠️ Role not found: ${roleName}`);
      return;
    }

    // Find ALL active assignments (regardless of department)
    const assignments = await RoleAssignmentModel.find({
      roleId: role._id,
      isActive: true,
      effectiveFrom: { $lte: new Date() },
      $or: [
        { effectiveUntil: null },
        { effectiveUntil: { $gte: new Date() }}
      ]
    })
    .populate("employeeId", "_id individualName personalEmail")
    .lean();

    const employees = assignments
      .map(a => a.employeeId)
      .filter(emp => emp !== null);

    if (!employees.length) {
      console.log(`⚠️ No employees found with role: ${roleName}`);
      return;
    }

    // Create notification
    await Notification.create({
      eventType,
      title: payload.title || "Role Notification",
      message: payload.message || "",
      department: "ALL",
      priority: payload.priority || "medium",
      recipients: employees.map((emp) => ({
        userId: emp._id,
        read: false,
      })),
      actionUrl: payload.actionUrl || null,
      metadata: payload,
      status: "sent",
    });

    console.log(`✅ Global role notification sent to ${employees.length} employees`);
  } catch (error) {
    console.error("❌ notifyGlobalRole error:", error);
    throw error;
  }
}

/**
 * ✅ HELPER: Send notification to role holders in specific department
 */
export async function notifyDepartmentRole(roleName, departmentCode, eventType, payload) {
  try {
    console.log(`📧 Sending notification to role: ${roleName} in ${departmentCode}`);

    // Find role declaration
    const role = await RoleModel.findOne({ roleName, isActive: true });
    if (!role) {
      console.log(`⚠️ Role not found: ${roleName}`);
      return;
    }

    // Find assignments in specific department
    const assignments = await RoleAssignmentModel.find({
      roleId: role._id,
      departmentCode,
      isActive: true,
      effectiveFrom: { $lte: new Date() },
      $or: [
        { effectiveUntil: null },
        { effectiveUntil: { $gte: new Date() }}
      ]
    })
    .populate("employeeId", "_id individualName personalEmail")
    .lean();

    const employees = assignments
      .map(a => a.employeeId)
      .filter(emp => emp !== null);

    if (!employees.length) {
      console.log(`⚠️ No employees found with role: ${roleName} in ${departmentCode}`);
      return;
    }

    // Create notification
    await Notification.create({
      eventType,
      title: payload.title || "Role Notification",
      message: payload.message || "",
      department: departmentCode,
      priority: payload.priority || "medium",
      recipients: employees.map((emp) => ({
        userId: emp._id,
        read: false,
      })),
      actionUrl: payload.actionUrl || null,
      metadata: payload,
      status: "sent",
    });

    console.log(`✅ Department role notification sent to ${employees.length} employees`);
  } catch (error) {
    console.error("❌ notifyDepartmentRole error:", error);
    throw error;
  }
}

/**
 * ✅ HELPER: Send notification to all employees in department
 */
export async function notifyDepartment(departmentCode, eventType, payload) {
  try {
    console.log(`📧 Sending notification to department: ${departmentCode}`);

    // Find all active employees in the department
    const assignments = await RoleAssignmentModel.find({
      departmentCode,
      isActive: true,
      effectiveFrom: { $lte: new Date() },
      $or: [
        { effectiveUntil: null },
        { effectiveUntil: { $gte: new Date() }}
      ]
    })
    .populate("employeeId", "_id individualName personalEmail")
    .lean();

    const employees = assignments
      .map(a => a.employeeId)
      .filter(emp => emp !== null);

    if (!employees.length) {
      console.log(`⚠️ No employees found in department: ${departmentCode}`);
      return;
    }

    // Create notification
    await Notification.create({
      eventType,
      title: payload.title || "Department Notification",
      message: payload.message || "",
      department: departmentCode,
      priority: payload.priority || "medium",
      recipients: employees.map((emp) => ({
        userId: emp._id,
        read: false,
      })),
      actionUrl: payload.actionUrl || null,
      metadata: payload,
      status: "sent",
    });

    console.log(`✅ Department notification sent to ${employees.length} employees`);
  } catch (error) {
    console.error("❌ notifyDepartment error:", error);
    throw error;
  }
}

/**
 * ✅ HELPER: Send notification to specific employee
 */
export async function notifyEmployee(employeeId, eventType, payload) {
  try {
    console.log(`📧 Sending notification to employee: ${employeeId}`);

    const employee = await FinalizedEmployeesModel.findById(employeeId)
      .select("_id individualName personalEmail")
      .lean();

    if (!employee) {
      console.log(`⚠️ Employee not found: ${employeeId}`);
      return;
    }

    // Get employee's department
    const assignment = await RoleAssignmentModel.findOne({
      employeeId,
      isActive: true,
    }).lean();

    const department = assignment?.departmentCode || "ALL";

    // Create notification
    await Notification.create({
      eventType,
      title: payload.title || "Personal Notification",
      message: payload.message || "",
      department,
      priority: payload.priority || "medium",
      recipients: [{
        userId: employee._id,
        read: false,
      }],
      actionUrl: payload.actionUrl || null,
      metadata: payload,
      status: "sent",
    });

    console.log(`✅ Employee notification sent`);
  } catch (error) {
    console.error("❌ notifyEmployee error:", error);
    throw error;
  }
}

// Legacy exports for backward compatibility
export { resolveTargetEmployees as getTargetEmployees };
export const notifyRole = notifyGlobalRole;
export const notifyStatus = notifyDepartmentRole;