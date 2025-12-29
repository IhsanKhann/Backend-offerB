// models/NotificationRule.js
import mongoose from "mongoose";

const NotificationRuleSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      index: true
    },

    department: {
      type: String,
      required: true
    },

    roles: [
      {
        type: String // accountant, manager, admin
      }
    ],

    userIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FinalizedEmployee"
      }
    ],

    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium"
    },

    enabled: {
      type: Boolean,
      default: true
    },

    template: {
      title: String,
      message: String
    }
  },
  { timestamps: true }
);

export default mongoose.model("NotificationRule", NotificationRuleSchema);
