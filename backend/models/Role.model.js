import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    UserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    }, // comes from the employee..
    roleName: {
      type: String,
      required: true,
    }, // comes from form no 2,
    orgUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrgUnit",
      required: true,
    }, // comes from form no 2,
     permissions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Permission", // references Permission collection
    }
  ],
  },

  {
    timestamps: true,
  }
);

const RoleModel = mongoose.model("Role", roleSchema);
export default RoleModel;
