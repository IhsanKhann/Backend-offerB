// notifications/notificationFactory.js
import Notification from "../models/BussinessOperationModals/Notifications.js";
import NotificationRule from "../models/BussinessOperationModals/NotificationsRule.js";
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import FinalizedEmployeesModel from "../models/HRModals/FinalizedEmployees.model.js";
import RoleModel from "../models/HRModals/Role.model.js";
import { getDepartmentFromEvent } from "../events/events.js";

/**
 * Main notification factory function
 * Creates notifications based on event type and payload
 */
export async function createNotificationsFromEvent(eventType, payload) {
  try {
    console.log(`📧 Creating notifications for event: ${eventType}`);

    // Get department from event type
    const eventDepartment = getDepartmentFromEvent(eventType);

    // Find matching notification rules
    const rules = await NotificationRule.find({
      eventType,
      enabled: true,
    });

    if (!rules.length) {
      console.log(`⚠️ No notification rules found for event: ${eventType}`);
      return;
    }

    for (const rule of rules) {
      try {
        // Get target employees based on rule configuration
        const targetEmployees = await getTargetEmployees(rule, payload);

        if (!targetEmployees.length) {
          console.log(`⚠️ No target employees found for rule: ${rule._id}`);
          continue;
        }

        // Render template with payload data
        const title = renderTemplate(rule.template.title, payload);
        const message = renderTemplate(rule.template.message, payload);

        // Create notification
        await Notification.create({
          eventType,
          title,
          message,
          department: rule.department,
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
 * Get target employees based on notification rule
 */
async function getTargetEmployees(rule, payload) {
  let employees = [];

  try {
    // 1. If specific userIds are defined, use those
    if (rule.userIds?.length) {
      employees = await FinalizedEmployeesModel.find({
        _id: { $in: rule.userIds },
      }).select("_id individualName personalEmail");

      return employees;
    }

    // 2. If roles are defined, find by department, status, and role
    if (rule.roles?.length) {
      // Find role declarations matching the rule
      const roleDeclarations = await RoleModel.find({
        roleName: { $in: rule.roles },
        code: rule.department,
      });

      if (!roleDeclarations.length) {
        return [];
      }

      const roleIds = roleDeclarations.map((r) => r._id);

      // Find active role assignments
      const assignments = await RoleAssignmentModel.find({
        roleId: { $in: roleIds },
        code: rule.department,
        isActive: true,
      }).populate("employeeId", "_id individualName personalEmail");

      employees = assignments
        .map((a) => a.employeeId)
        .filter((emp) => emp !== null);

      return employees;
    }

    // 3. If no specific targeting, send to all employees in department
    if (rule.department && rule.department !== "ALL") {
      const assignments = await RoleAssignmentModel.find({
        code: rule.department,
        isActive: true,
      }).populate("employeeId", "_id individualName personalEmail");

      employees = assignments
        .map((a) => a.employeeId)
        .filter((emp) => emp !== null);

      return employees;
    }

    // 4. If department is ALL, send to everyone (careful!)
    if (rule.department === "ALL") {
      employees = await FinalizedEmployeesModel.find({}).select(
        "_id individualName personalEmail"
      );

      return employees;
    }

    // 5. Check for specific employee targeting in payload
    if (payload.targetEmployeeId) {
      const employee = await FinalizedEmployeesModel.findById(
        payload.targetEmployeeId
      ).select("_id individualName personalEmail");

      if (employee) {
        employees = [employee];
      }
    }

    return employees;
  } catch (error) {
    console.error("❌ Error getting target employees:", error);
    return [];
  }
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
 * Send notification to specific department
 */
export async function notifyDepartment(department, eventType, payload) {
  try {
    console.log(`📧 Sending notification to department: ${department}`);

    // Find all active employees in the department
    const assignments = await RoleAssignmentModel.find({
      code: department,
      isActive: true,
    }).populate("employeeId", "_id individualName personalEmail");

    const employees = assignments
      .map((a) => a.employeeId)
      .filter((emp) => emp !== null);

    if (!employees.length) {
      console.log(`⚠️ No employees found in department: ${department}`);
      return;
    }

    // Create notification
    await Notification.create({
      eventType,
      title: payload.title || "Department Notification",
      message: payload.message || "",
      department,
      priority: payload.priority || "medium",
      recipients: employees.map((emp) => ({
        userId: emp._id,
        read: false,
      })),
      actionUrl: payload.actionUrl || null,
      metadata: payload,
      status: "sent",
    });

    console.log(
      `✅ Department notification sent to ${employees.length} employees`
    );
  } catch (error) {
    console.error("❌ notifyDepartment error:", error);
    throw error;
  }
}

/**
 * Send notification to specific role within department
 */
export async function notifyRole(department, roleName, eventType, payload) {
  try {
    console.log(
      `📧 Sending notification to role: ${roleName} in ${department}`
    );

    // Find role declaration
    const role = await RoleModel.findOne({
      roleName,
      code: department,
    });

    if (!role) {
      console.log(`⚠️ Role not found: ${roleName} in ${department}`);
      return;
    }

    // Find active role assignments
    const assignments = await RoleAssignmentModel.find({
      roleId: role._id,
      code: department,
      isActive: true,
    }).populate("employeeId", "_id individualName personalEmail");

    const employees = assignments
      .map((a) => a.employeeId)
      .filter((emp) => emp !== null);

    if (!employees.length) {
      console.log(`⚠️ No employees found with role: ${roleName}`);
      return;
    }

    // Create notification
    await Notification.create({
      eventType,
      title: payload.title || "Role Notification",
      message: payload.message || "",
      department,
      priority: payload.priority || "medium",
      recipients: employees.map((emp) => ({
        userId: emp._id,
        read: false,
      })),
      actionUrl: payload.actionUrl || null,
      metadata: payload,
      status: "sent",
    });

    console.log(
      `✅ Role notification sent to ${employees.length} employees`
    );
  } catch (error) {
    console.error("❌ notifyRole error:", error);
    throw error;
  }
}

/**
 * Send notification to specific status (hierarchy level)
 */
export async function notifyStatus(department, status, eventType, payload) {
  try {
    console.log(
      `📧 Sending notification to status: ${status} in ${department}`
    );

    // Find active role assignments with matching status
    const assignments = await RoleAssignmentModel.find({
      code: department,
      status,
      isActive: true,
    }).populate("employeeId", "_id individualName personalEmail");

    const employees = assignments
      .map((a) => a.employeeId)
      .filter((emp) => emp !== null);

    if (!employees.length) {
      console.log(
        `⚠️ No employees found with status: ${status} in ${department}`
      );
      return;
    }

    // Create notification
    await Notification.create({
      eventType,
      title: payload.title || "Status Notification",
      message: payload.message || "",
      department,
      priority: payload.priority || "medium",
      recipients: employees.map((emp) => ({
        userId: emp._id,
        read: false,
      })),
      actionUrl: payload.actionUrl || null,
      metadata: payload,
      status: "sent",
    });

    console.log(
      `✅ Status notification sent to ${employees.length} employees`
    );
  } catch (error) {
    console.error("❌ notifyStatus error:", error);
    throw error;
  }
}

/**
 * Send notification to specific employee
 */
export async function notifyEmployee(employeeId, eventType, payload) {
  try {
    console.log(`📧 Sending notification to employee: ${employeeId}`);

    const employee = await FinalizedEmployeesModel.findById(employeeId).select(
      "_id individualName personalEmail"
    );

    if (!employee) {
      console.log(`⚠️ Employee not found: ${employeeId}`);
      return;
    }

    // Get employee's department
    const assignment = await RoleAssignmentModel.findOne({
      employeeId,
      isActive: true,
    });

    const department = assignment?.code || "ALL";

    // Create notification
    await Notification.create({
      eventType,
      title: payload.title || "Personal Notification",
      message: payload.message || "",
      department,
      priority: payload.priority || "medium",
      recipients: [
        {
          userId: employee._id,
          read: false,
        },
      ],
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