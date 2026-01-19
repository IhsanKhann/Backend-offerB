// controllers/notificationControllers.js
import Notification from "../models/BussinessOperationModals/Notifications.js";
import NotificationRule from "../models/BussinessOperationModals/NotificationsRule.js";
import { EVENT_TYPES } from "../events/events.js";

// ============================================
// GET NOTIFICATIONS FOR LOGGED-IN USER
// ============================================
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id; // from auth middleware
    const { read, limit = 50, skip = 0 } = req.query;

    // Build filter
    const filter = {
      "recipients.userId": userId,
    };

    if (read !== undefined) {
      filter["recipients.read"] = read === "true";
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    // Transform to include user-specific read status
    const userNotifications = notifications.map((notif) => {
      const userRecipient = notif.recipients.find(
        (r) => r.userId.toString() === userId.toString()
      );

      return {
        _id: notif._id,
        eventType: notif.eventType,
        title: notif.title,
        message: notif.message,
        department: notif.department,
        priority: notif.priority,
        actionUrl: notif.actionUrl,
        metadata: notif.metadata,
        createdAt: notif.createdAt,
        read: userRecipient?.read || false,
        readAt: userRecipient?.readAt || null,
      };
    });

    const unreadCount = await Notification.countDocuments({
      "recipients.userId": userId,
      "recipients.read": false,
    });

    res.json({
      success: true,
      notifications: userNotifications,
      unreadCount,
      total: userNotifications.length,
    });
  } catch (err) {
    console.error("❌ getUserNotifications error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

// ============================================
// MARK NOTIFICATION AS READ
// ============================================
export const markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        "recipients.userId": userId,
      },
      {
        $set: {
          "recipients.$.read": true,
          "recipients.$.readAt": new Date(),
        },
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (err) {
    console.error("❌ markNotificationRead error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
    });
  }
};

// ============================================
// MARK ALL NOTIFICATIONS AS READ
// ============================================
export const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    await Notification.updateMany(
      {
        "recipients.userId": userId,
        "recipients.read": false,
      },
      {
        $set: {
          "recipients.$[elem].read": true,
          "recipients.$[elem].readAt": new Date(),
        },
      },
      {
        arrayFilters: [{ "elem.userId": userId, "elem.read": false }],
      }
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (err) {
    console.error("❌ markAllNotificationsRead error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
    });
  }
};

// ============================================
// DELETE NOTIFICATION
// ============================================
export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    // Remove user from recipients array
    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        "recipients.userId": userId,
      },
      {
        $pull: {
          recipients: { userId },
        },
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // If no recipients left, delete the notification
    if (notification.recipients.length === 0) {
      await Notification.findByIdAndDelete(notificationId);
    }

    res.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (err) {
    console.error("❌ deleteNotification error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete notification",
    });
  }
};

// ============================================
// GET UNREAD COUNT
// ============================================
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const unreadCount = await Notification.countDocuments({
      "recipients.userId": userId,
      "recipients.read": false,
    });

    res.json({
      success: true,
      unreadCount,
    });
  } catch (err) {
    console.error("❌ getUnreadCount error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get unread count",
    });
  }
};

// ============================================
// NOTIFICATION RULES MANAGEMENT (Admin)
// ============================================

// Get all notification rules
export const getAllNotificationRules = async (req, res) => {
  try {
    const rules = await NotificationRule.find()
      .populate("userIds", "individualName personalEmail")
      .sort({ department: 1, eventType: 1 });

    res.json({
      success: true,
      rules,
    });
  } catch (err) {
    console.error("❌ getAllNotificationRules error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notification rules",
    });
  }
};

// Create notification rule
export const createNotificationRule = async (req, res) => {
  try {
    const {
      eventType,
      department,
      roles,
      userIds,
      priority,
      template,
      enabled,
    } = req.body;

    // Validate required fields
    if (!eventType || !department || !template) {
      return res.status(400).json({
        success: false,
        message: "eventType, department, and template are required",
      });
    }

    // Validate event type
    if (!Object.values(EVENT_TYPES).includes(eventType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event type",
      });
    }

    const rule = new NotificationRule({
      eventType,
      department,
      roles: roles || [],
      userIds: userIds || [],
      priority: priority || "medium",
      template,
      enabled: enabled !== false,
    });

    await rule.save();

    res.status(201).json({
      success: true,
      message: "Notification rule created",
      rule,
    });
  } catch (err) {
    console.error("❌ createNotificationRule error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create notification rule",
    });
  }
};

// Update notification rule
export const updateNotificationRule = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const updates = req.body;

    const rule = await NotificationRule.findByIdAndUpdate(ruleId, updates, {
      new: true,
      runValidators: true,
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Notification rule not found",
      });
    }

    res.json({
      success: true,
      message: "Notification rule updated",
      rule,
    });
  } catch (err) {
    console.error("❌ updateNotificationRule error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update notification rule",
    });
  }
};

// Delete notification rule
export const deleteNotificationRule = async (req, res) => {
  try {
    const { ruleId } = req.params;

    const rule = await NotificationRule.findByIdAndDelete(ruleId);

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Notification rule not found",
      });
    }

    res.json({
      success: true,
      message: "Notification rule deleted",
    });
  } catch (err) {
    console.error("❌ deleteNotificationRule error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete notification rule",
    });
  }
};

// Toggle notification rule
export const toggleNotificationRule = async (req, res) => {
  try {
    const { ruleId } = req.params;

    const rule = await NotificationRule.findById(ruleId);

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Notification rule not found",
      });
    }

    rule.enabled = !rule.enabled;
    await rule.save();

    res.json({
      success: true,
      message: `Notification rule ${rule.enabled ? "enabled" : "disabled"}`,
      rule,
    });
  } catch (err) {
    console.error("❌ toggleNotificationRule error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to toggle notification rule",
    });
  }
};

// Get notification statistics (for admin dashboard)
export const getNotificationStats = async (req, res) => {
  try {
    const { department, startDate, endDate } = req.query;

    const filter = {};
    if (department) filter.department = department;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const totalNotifications = await Notification.countDocuments(filter);

    const byPriority = await Notification.aggregate([
      { $match: filter },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]);

    const byDepartment = await Notification.aggregate([
      { $match: filter },
      { $group: { _id: "$department", count: { $sum: 1 } } },
    ]);

    const byEventType = await Notification.aggregate([
      { $match: filter },
      { $group: { _id: "$eventType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      success: true,
      stats: {
        total: totalNotifications,
        byPriority,
        byDepartment,
        topEventTypes: byEventType,
      },
    });
  } catch (err) {
    console.error("❌ getNotificationStats error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get notification statistics",
    });
  }
};