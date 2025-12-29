// models/Notification.js
import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true
    },

    title: {
      type: String,
      required: true
    },

    message: {
      type: String,
      required: true
    },

    department: {
      type: String,
      required: true
    },

    recipients: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
            ref: "FinalizedEmployee",
          required: true
        },
        read: {
          type: Boolean,
          default: false
        },
        readAt: Date
      }
    ],

    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium"
    },

    actionUrl: {
      type: String // frontend redirect
    },

    metadata: {
      type: Object // orderId, returnId, etc
    },

    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Notification", NotificationSchema);
