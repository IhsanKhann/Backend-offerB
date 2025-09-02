import mongoose from "mongoose";

const PermissionsSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true, 
    unique: true, // e.g., "VIEW_EMPLOYEES", "EDIT_EMPLOYEES"
  },
  description: {
    type: String,
    required: false, // human readable, e.g. "Can edit employee records"
  }
}, { timestamps: true });

export const PermissionModel = mongoose.model("Permission", PermissionsSchema);
