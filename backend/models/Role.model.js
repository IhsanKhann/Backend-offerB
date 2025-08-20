import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String, // or ObjectId if referencing Employee collection
      required: true,
    },
    role: {
      division: { type: String, required: true },
      department: { type: String, required: true },
      group: { type: String, required: true },
      cell: { type: String, required: true },
    },
  },
  {
    timestamps: true,
  }
);

const RoleModel = mongoose.model("Role", roleSchema);
export default RoleModel;
