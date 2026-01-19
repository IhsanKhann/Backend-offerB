// ============================================
// routes/notificationRoutes.js (NEW)
// ============================================
import express from "express";
import { authenticate, authorize } from "../middlewares/authMiddlewares.js";
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getUnreadCount,
  getAllNotificationRules,
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
  toggleNotificationRule,
  getNotificationStats,
} from "../events/NotificationController.js";

const notificationRouter = express.Router();

notificationRouter.use(authenticate);

// ============== USER NOTIFICATIONS ==============

// Get user's notifications
notificationRouter.get(
  "/notifications",
  getUserNotifications
);

// Get unread count
notificationRouter.get(
  "/notifications/unread-count",
  getUnreadCount
);

// Mark notification as read
notificationRouter.patch(
  "/notifications/:notificationId/read",
  markNotificationRead
);

// Mark all notifications as read
notificationRouter.patch(
  "/notifications/mark-all-read",
  markAllNotificationsRead
);

// Delete notification
notificationRouter.delete(
  "/notifications/:notificationId",
  deleteNotification
);

// ============== ADMIN: NOTIFICATION RULES ==============

// Get all notification rules
notificationRouter.get(
  "/notifications/rules",
//   authorize("Manage_Notification_Rules"),
  getAllNotificationRules
);

// Create notification rule
notificationRouter.post(
  "/notifications/rules",
//   authorize("Manage_Notification_Rules"),
  createNotificationRule
);

// Update notification rule
notificationRouter.put(
  "/notifications/rules/:ruleId",
//   authorize("Manage_Notification_Rules"),
  updateNotificationRule
);

// Delete notification rule
notificationRouter.delete(
  "/notifications/rules/:ruleId",
//   authorize("Manage_Notification_Rules"),
  deleteNotificationRule
);

// Toggle notification rule
notificationRouter.patch(
  "/notifications/rules/:ruleId/toggle",
//   authorize("Manage_Notification_Rules"),
  toggleNotificationRule
);

// Get notification statistics
notificationRouter.get(
  "/notifications/stats",
//   authorize("View_Notification_Stats"),
  getNotificationStats
);

export default notificationRouter ;