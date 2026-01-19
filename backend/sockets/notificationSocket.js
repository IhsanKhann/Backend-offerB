// ============================================
// sockets/notificationSocket.js
// Real-time notification delivery via WebSocket
// ============================================
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import FinalizedEmployeesModel from "../models/HRModals/FinalizedEmployees.model.js";

let io;

// Store connected users: { userId: socketId }
const connectedUsers = new Map();

/**
 * Initialize Socket.IO server
 */
export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
    },
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication token required"));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get employee data
      const employee = await FinalizedEmployeesModel.findById(decoded.id);
      
      if (!employee) {
        return next(new Error("Employee not found"));
      }

      socket.userId = employee._id.toString();
      socket.employee = employee;
      
      next();
    } catch (err) {
      console.error("Socket authentication error:", err);
      next(new Error("Authentication failed"));
    }
  });

  // Connection handler
  io.on("connection", (socket) => {
    console.log(`✅ User connected: ${socket.userId}`);

    // Store connection
    connectedUsers.set(socket.userId, socket.id);

    // Send connection success
    socket.emit("connected", {
      message: "Connected to notification service",
      userId: socket.userId,
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.userId}`);
      connectedUsers.delete(socket.userId);
    });

    // Handle mark as read
    socket.on("mark-read", async (data) => {
      try {
        const { notificationId } = data;
        
        await Notification.findOneAndUpdate(
          {
            _id: notificationId,
            "recipients.userId": socket.userId,
          },
          {
            $set: {
              "recipients.$.read": true,
              "recipients.$.readAt": new Date(),
            },
          }
        );

        socket.emit("marked-read", { notificationId });
      } catch (err) {
        console.error("Mark read error:", err);
      }
    });

    // Handle typing indicators, presence, etc.
    socket.on("ping", () => {
      socket.emit("pong");
    });
  });

  console.log("✅ Socket.IO initialized for real-time notifications");
  return io;
};

/**
 * Send notification to specific user
 */
export const sendNotificationToUser = (userId, notification) => {
  const socketId = connectedUsers.get(userId.toString());

  if (socketId && io) {
    io.to(socketId).emit("notification", {
      _id: notification._id,
      eventType: notification.eventType,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      department: notification.department,
      actionUrl: notification.actionUrl,
      createdAt: notification.createdAt,
      metadata: notification.metadata,
    });

    console.log(`📧 Notification sent to user ${userId} via WebSocket`);
    return true;
  }

  console.log(`⚠️ User ${userId} not connected via WebSocket`);
  return false;
};

/**
 * Send notification to multiple users
 */
export const sendNotificationToUsers = (userIds, notification) => {
  let sentCount = 0;

  userIds.forEach((userId) => {
    if (sendNotificationToUser(userId, notification)) {
      sentCount++;
    }
  });

  console.log(`📧 Notification sent to ${sentCount}/${userIds.length} users`);
  return sentCount;
};

/**
 * Send notification to department
 */
export const sendNotificationToDepartment = async (department, notification) => {
  try {
    const assignments = await RoleAssignmentModel.find({
      code: department,
      isActive: true,
    });

    const userIds = assignments.map((a) => a.employeeId.toString());
    return sendNotificationToUsers(userIds, notification);
  } catch (err) {
    console.error("Send to department error:", err);
    return 0;
  }
};

/**
 * Broadcast to all connected users
 */
export const broadcastNotification = (notification) => {
  if (io) {
    io.emit("notification", notification);
    console.log(`📢 Notification broadcasted to all users`);
  }
};

/**
 * Get online users count
 */
export const getOnlineUsersCount = () => {
  return connectedUsers.size;
};

/**
 * Check if user is online
 */
export const isUserOnline = (userId) => {
  return connectedUsers.has(userId.toString());
};

export { io };

// ============================================
// Updated notificationFactory.js
// Add WebSocket support
// ============================================

import { sendNotificationToUsers } from "../sockets/notificationSocket.js";

// Add to createNotificationsFromEvent after creating notification
export async function createNotificationsFromEvent(eventType, payload) {
  try {
    // ... existing code ...

    for (const rule of rules) {
      try {
        const targetEmployees = await getTargetEmployees(rule, payload);

        if (!targetEmployees.length) {
          console.log(`⚠️ No target employees found for rule: ${rule._id}`);
          continue;
        }

        const title = renderTemplate(rule.template.title, payload);
        const message = renderTemplate(rule.template.message, payload);

        // Create notification in database
        const notification = await Notification.create({
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

        console.log(`✅ Notification created for ${targetEmployees.length} recipients`);

        // 🔥 NEW: Send real-time notification via WebSocket
        const userIds = targetEmployees.map((emp) => emp._id);
        sendNotificationToUsers(userIds, notification);

      } catch (ruleError) {
        console.error(`❌ Error processing rule ${rule._id}:`, ruleError);
      }
    }
  } catch (error) {
    console.error("❌ createNotificationsFromEvent error:", error);
    throw error;
  }
}
