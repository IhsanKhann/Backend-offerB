// events/listeners/orderReturn.listener.js
import eventBus from "./eventListeners";
import { EVENT_TYPES } from "./events.js";
import { createNotificationsFromEvent } from "../../notifications/notificationFactory.js";

eventBus.on(EVENT_TYPES.ORDER_RETURN_EXPIRED, async payload => {
  try {
    console.log("🔔 Order return expired event received");

    await createNotificationsFromEvent(
      EVENT_TYPES.ORDER_RETURN_EXPIRED,
      payload
    );
  } catch (err) {
    console.error("Notification creation failed", err);
  }
});
