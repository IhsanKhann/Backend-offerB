// events/eventListeners.js
import eventBus from "./eventBus.js";
import { EVENT_TYPES } from "./events.js";
import {
  createNotificationsFromEvent,
  notifyGlobalRole,
  notifyDepartmentRole,
  notifyDepartment,
  notifyEmployee,
} from "../notifications/notificationFactory.js";

// ============================================
// BUSINESS OPERATIONS EVENT LISTENERS
// ============================================

eventBus.on(EVENT_TYPES.BIZ_ORDER_RETURN_EXPIRED, async (payload) => {
  try {
    console.log("📢 Event: ORDER_RETURN_EXPIRED");
    await createNotificationsFromEvent(
      EVENT_TYPES.BIZ_ORDER_RETURN_EXPIRED,
      payload
    );
  } catch (err) {
    console.error("❌ ORDER_RETURN_EXPIRED notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.BIZ_ORDER_CREATED, async (payload) => {
  try {
    console.log("📢 Event: ORDER_CREATED");
    await createNotificationsFromEvent(EVENT_TYPES.BIZ_ORDER_CREATED, payload);
  } catch (err) {
    console.error("❌ ORDER_CREATED notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.BIZ_INVENTORY_LOW, async (payload) => {
  try {
    console.log("📢 Event: INVENTORY_LOW");
    
    // ✅ REFACTORED: Notify specific role in department
    await notifyDepartmentRole(
      "Inventory Manager",
      "BusinessOperation",
      EVENT_TYPES.BIZ_INVENTORY_LOW,
      payload
    );
  } catch (err) {
    console.error("❌ INVENTORY_LOW notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.BIZ_CUSTOMER_COMPLAINT, async (payload) => {
  try {
    console.log("📢 Event: CUSTOMER_COMPLAINT");
    await createNotificationsFromEvent(
      EVENT_TYPES.BIZ_CUSTOMER_COMPLAINT,
      payload
    );
  } catch (err) {
    console.error("❌ CUSTOMER_COMPLAINT notification failed:", err);
  }
});

// ============================================
// FINANCE EVENT LISTENERS
// ============================================

eventBus.on(EVENT_TYPES.FINANCE_SALARY_PROCESSED, async (payload) => {
  try {
    console.log("📢 Event: SALARY_PROCESSED");
    
    // Notify Finance department
    await notifyDepartment(
      "Finance",
      EVENT_TYPES.FINANCE_SALARY_PROCESSED,
      payload
    );

    // Also notify the specific employee
    if (payload.employeeId) {
      await notifyEmployee(
        payload.employeeId,
        EVENT_TYPES.FINANCE_SALARY_PROCESSED,
        {
          ...payload,
          title: "Your Salary Has Been Processed",
          message: `Your salary for ${payload.month} ${payload.year} has been processed. Net amount: ${payload.netSalary}`,
        }
      );
    }
  } catch (err) {
    console.error("❌ SALARY_PROCESSED notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.FINANCE_SALARY_PAID, async (payload) => {
  try {
    console.log("📢 Event: SALARY_PAID");
    
    // Notify the employee
    if (payload.employeeId) {
      await notifyEmployee(
        payload.employeeId,
        EVENT_TYPES.FINANCE_SALARY_PAID,
        {
          ...payload,
          title: "Salary Payment Received 💰",
          message: `Your salary for ${payload.month} ${payload.year} has been paid. Amount: ${payload.netSalary}`,
          priority: "high",
        }
      );
    }
  } catch (err) {
    console.error("❌ SALARY_PAID notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.FINANCE_SALARY_PENDING, async (payload) => {
  try {
    console.log("📢 Event: SALARY_PENDING");
    
    // ✅ REFACTORED: Notify specific roles in Finance
    await notifyDepartmentRole(
      "Finance Manager",
      "Finance",
      EVENT_TYPES.FINANCE_SALARY_PENDING,
      payload
    );
    
    await notifyDepartmentRole(
      "Accountant",
      "Finance",
      EVENT_TYPES.FINANCE_SALARY_PENDING,
      payload
    );
  } catch (err) {
    console.error("❌ SALARY_PENDING notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.FINANCE_INVOICE_OVERDUE, async (payload) => {
  try {
    console.log("📢 Event: INVOICE_OVERDUE");
    await createNotificationsFromEvent(
      EVENT_TYPES.FINANCE_INVOICE_OVERDUE,
      payload
    );
  } catch (err) {
    console.error("❌ INVOICE_OVERDUE notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.FINANCE_BUDGET_EXCEEDED, async (payload) => {
  try {
    console.log("📢 Event: BUDGET_EXCEEDED");
    
    // ✅ REFACTORED: Notify Finance managers (department-level)
    await notifyDepartmentRole(
      "Finance Manager",
      "Finance",
      EVENT_TYPES.FINANCE_BUDGET_EXCEEDED,
      payload
    );
    
    // Also notify all department heads (global role)
    await notifyGlobalRole(
      "Department Head",
      EVENT_TYPES.FINANCE_BUDGET_EXCEEDED,
      payload
    );
  } catch (err) {
    console.error("❌ BUDGET_EXCEEDED notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.FINANCE_MONTH_END_CLOSING, async (payload) => {
  try {
    console.log("📢 Event: MONTH_END_CLOSING");
    
    // Notify entire Finance department
    await notifyDepartment(
      "Finance",
      EVENT_TYPES.FINANCE_MONTH_END_CLOSING,
      payload
    );
  } catch (err) {
    console.error("❌ MONTH_END_CLOSING notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.FINANCE_EXPENSE_SUBMITTED, async (payload) => {
  try {
    console.log("📢 Event: EXPENSE_SUBMITTED");
    await createNotificationsFromEvent(
      EVENT_TYPES.FINANCE_EXPENSE_SUBMITTED,
      payload
    );
  } catch (err) {
    console.error("❌ EXPENSE_SUBMITTED notification failed:", err);
  }
});

// ============================================
// HR EVENT LISTENERS
// ============================================

eventBus.on(EVENT_TYPES.HR_EMPLOYEE_ONBOARDED, async (payload) => {
  try {
    console.log("📢 Event: EMPLOYEE_ONBOARDED");
    
    // Notify HR department
    await notifyDepartment("HR", EVENT_TYPES.HR_EMPLOYEE_ONBOARDED, payload);
    
    // Notify the new employee
    if (payload.employeeId) {
      await notifyEmployee(payload.employeeId, EVENT_TYPES.HR_EMPLOYEE_ONBOARDED, {
        ...payload,
        title: "Welcome to the Team! 🎉",
        message: "Welcome aboard! We're excited to have you join us.",
        priority: "high",
      });
    }
  } catch (err) {
    console.error("❌ EMPLOYEE_ONBOARDED notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.HR_ROLE_ASSIGNED, async (payload) => {
  try {
    console.log("📢 Event: ROLE_ASSIGNED");
    
    // Notify the employee
    if (payload.employeeId) {
      await notifyEmployee(payload.employeeId, EVENT_TYPES.HR_ROLE_ASSIGNED, {
        ...payload,
        title: "New Role Assigned",
        message: `You have been assigned the role of ${payload.roleName}`,
        priority: "high",
      });
    }
    
    // Notify HR
    await notifyDepartment("HR", EVENT_TYPES.HR_ROLE_ASSIGNED, payload);
  } catch (err) {
    console.error("❌ ROLE_ASSIGNED notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.HR_LEAVE_REQUESTED, async (payload) => {
  try {
    console.log("📢 Event: LEAVE_REQUESTED");
    await createNotificationsFromEvent(
      EVENT_TYPES.HR_LEAVE_REQUESTED,
      payload
    );
  } catch (err) {
    console.error("❌ LEAVE_REQUESTED notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.HR_LEAVE_APPROVED, async (payload) => {
  try {
    console.log("📢 Event: LEAVE_APPROVED");
    
    // Notify the employee
    if (payload.employeeId) {
      await notifyEmployee(payload.employeeId, EVENT_TYPES.HR_LEAVE_APPROVED, {
        ...payload,
        title: "Leave Request Approved ✅",
        message: `Your leave request from ${payload.startDate} to ${payload.endDate} has been approved.`,
        priority: "high",
      });
    }
  } catch (err) {
    console.error("❌ LEAVE_APPROVED notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.HR_LEAVE_REJECTED, async (payload) => {
  try {
    console.log("📢 Event: LEAVE_REJECTED");
    
    // Notify the employee
    if (payload.employeeId) {
      await notifyEmployee(payload.employeeId, EVENT_TYPES.HR_LEAVE_REJECTED, {
        ...payload,
        title: "Leave Request Not Approved",
        message: `Your leave request from ${payload.startDate} to ${payload.endDate} was not approved. ${payload.reason || ""}`,
        priority: "high",
      });
    }
  } catch (err) {
    console.error("❌ LEAVE_REJECTED notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.HR_CONTRACT_EXPIRING, async (payload) => {
  try {
    console.log("📢 Event: CONTRACT_EXPIRING");
    
    // ✅ REFACTORED: Notify HR Managers (department-level)
    await notifyDepartmentRole(
      "HR Manager",
      "HR",
      EVENT_TYPES.HR_CONTRACT_EXPIRING,
      payload
    );
    
    // Notify the employee
    if (payload.employeeId) {
      await notifyEmployee(payload.employeeId, EVENT_TYPES.HR_CONTRACT_EXPIRING, {
        ...payload,
        title: "Contract Expiration Notice",
        message: `Your contract expires in ${payload.daysRemaining} days. Please contact HR.`,
      });
    }
  } catch (err) {
    console.error("❌ CONTRACT_EXPIRING notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.HR_PROBATION_ENDING, async (payload) => {
  try {
    console.log("📢 Event: PROBATION_ENDING");
    
    // Notify HR managers
    await notifyDepartmentRole(
      "HR Manager",
      "HR",
      EVENT_TYPES.HR_PROBATION_ENDING,
      payload
    );
  } catch (err) {
    console.error("❌ PROBATION_ENDING notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.HR_BIRTHDAY_REMINDER, async (payload) => {
  try {
    console.log("📢 Event: BIRTHDAY_REMINDER");
    
    // Notify the employee's department
    if (payload.departmentCode && payload.departmentCode !== "ALL") {
      await notifyDepartment(
        payload.departmentCode,
        EVENT_TYPES.HR_BIRTHDAY_REMINDER,
        payload
      );
    }
  } catch (err) {
    console.error("❌ BIRTHDAY_REMINDER notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.HR_PERFORMANCE_REVIEW_DUE, async (payload) => {
  try {
    console.log("📢 Event: PERFORMANCE_REVIEW_DUE");
    await createNotificationsFromEvent(
      EVENT_TYPES.HR_PERFORMANCE_REVIEW_DUE,
      payload
    );
  } catch (err) {
    console.error("❌ PERFORMANCE_REVIEW_DUE notification failed:", err);
  }
});

// ============================================
// CROSS-DEPARTMENT EVENT LISTENERS
// ============================================

eventBus.on(EVENT_TYPES.SYSTEM_MAINTENANCE, async (payload) => {
  try {
    console.log("📢 Event: SYSTEM_MAINTENANCE");
    
    // ✅ REFACTORED: Notify organization-wide
    // This could use a global role like "All Employees" or notify all departments
    await notifyDepartment("HR", EVENT_TYPES.SYSTEM_MAINTENANCE, payload);
    await notifyDepartment("Finance", EVENT_TYPES.SYSTEM_MAINTENANCE, payload);
    await notifyDepartment("BusinessOperation", EVENT_TYPES.SYSTEM_MAINTENANCE, payload);
  } catch (err) {
    console.error("❌ SYSTEM_MAINTENANCE notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.APPROVAL_REQUIRED, async (payload) => {
  try {
    console.log("📢 Event: APPROVAL_REQUIRED");
    await createNotificationsFromEvent(
      EVENT_TYPES.APPROVAL_REQUIRED,
      payload
    );
  } catch (err) {
    console.error("❌ APPROVAL_REQUIRED notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.TASK_ASSIGNED, async (payload) => {
  try {
    console.log("📢 Event: TASK_ASSIGNED");
    
    if (payload.assignedTo) {
      await notifyEmployee(payload.assignedTo, EVENT_TYPES.TASK_ASSIGNED, {
        ...payload,
        title: "New Task Assigned",
        message: `You have been assigned a new task: ${payload.taskTitle}`,
        priority: "medium",
      });
    }
  } catch (err) {
    console.error("❌ TASK_ASSIGNED notification failed:", err);
  }
});

eventBus.on(EVENT_TYPES.DEADLINE_APPROACHING, async (payload) => {
  try {
    console.log("📢 Event: DEADLINE_APPROACHING");
    
    if (payload.assignedTo) {
      await notifyEmployee(payload.assignedTo, EVENT_TYPES.DEADLINE_APPROACHING, {
        ...payload,
        title: "Deadline Approaching ⏰",
        message: `Task "${payload.taskTitle}" is due in ${payload.daysRemaining} days.`,
        priority: payload.daysRemaining <= 1 ? "critical" : "high",
      });
    }
  } catch (err) {
    console.error("❌ DEADLINE_APPROACHING notification failed:", err);
  }
});

// ============================================
// EXAMPLE: Using Global Role Notifications
// ============================================

eventBus.on(EVENT_TYPES.SYSTEM_ALERT, async (payload) => {
  try {
    console.log("📢 Event: SYSTEM_ALERT");
    
    // ✅ NEW: Notify all executives globally (across all departments)
    await notifyGlobalRole(
      "Executive",
      EVENT_TYPES.SYSTEM_ALERT,
      {
        ...payload,
        title: "System Alert",
        message: payload.message,
        priority: "critical",
      }
    );
  } catch (err) {
    console.error("❌ SYSTEM_ALERT notification failed:", err);
  }
});

console.log("✅ All event listeners initialized successfully");