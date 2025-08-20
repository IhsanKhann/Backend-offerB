
import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    division: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Division",
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
    cell: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cell",
    },
  },
  {
    timestamps: true,
  }
);

const RoleModel = mongoose.model("Role", roleSchema);
export default RoleModel;
