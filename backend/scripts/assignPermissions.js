import mongoose from "mongoose";
import RoleModel from "../models/HRModals/Role.model.js";
import { PermissionModel } from "../models/HRModals/Permissions.model.js";

/************************************
 * DB CONNECTION
 ************************************/
async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ DB Connected");
}

async function assignPermissions() {
  await connectDB();

  const seniorOfficer = await RoleModel.findOne({ roleName: "Senior Officer" });
  const chairman = await RoleModel.findOne({ roleName: "Chairman" });

  if (!seniorOfficer || !chairman) {
    throw new Error("❌ Required roles not found");
  }

  /* -------------------------------
   * PERMISSIONS
   * ----------------------------- */
  const seniorOfficerPermissions = await PermissionModel.find({
    isActive: true,
    statusScope: { $in: ["HR", "Finance", "ALL"] }
  });

  const allPermissions = await PermissionModel.find({ isActive: true });

  /* -------------------------------
   * ASSIGN (IDEMPOTENT)
   * ----------------------------- */
  seniorOfficer.permissions = [
    ...new Set(seniorOfficerPermissions.map(p => p._id.toString()))
  ];

  chairman.permissions = allPermissions.map(p => p._id);

  await seniorOfficer.save();
  await chairman.save();

  console.log("✅ Permissions assigned");
  await mongoose.disconnect();
}

assignPermissions().catch(console.error);
