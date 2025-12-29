// notifications/notificationFactory.js
import Notification from "../models/BussinessOperationModals/Notifications.js";
import NotificationRule from "../models/BussinessOperationModals/NotificationsRule.js";
import FinalizedEmployeesModel from "../models/HRModals/FinalizedEmployees.model.js";

export async function createNotificationsFromEvent(eventType, payload) {
  const rules = await NotificationRule.find({
    eventType,
    enabled: true
  });

  for (const rule of rules) {
    let users = [];

    if (rule.userIds?.length) {
      users = await FinalizedEmployeesModel.find({ _id: { $in: rule.userIds } });
    } else if (rule.roles?.length) {
      users = await FinalizedEmployeesModel.find({
        role: { $in: rule.roles },
        department: rule.department
      });
    }

    if (!users.length) continue;

    await Notification.create({
      eventType,
      title: rule.template.title,
      message: rule.template.message,
      department: rule.department,
      priority: rule.priority,
      recipients: users.map(u => ({
        userId: u._id
      })),
      actionUrl: payload.actionUrl,
      metadata: payload
    });
  }
}
