// these are for the dropdown of the roles in the assign roles page. We can add more roles or delete existing one from the array.
import AllRolesModel from "../models/HRModals/AllRoles.model.js";

// ---------------------- Get All Roles ----------------------
export const getAllRolesList = async (req, res) => {
  try {
    const roles = await AllRolesModel.find();
    res.status(200).json({ message: "Roles found", success: true, Roles: roles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", success: false, error: err.message });
  }
};

// add and delete roles.
export const addRole = async (req, res) => {
  try {
    const { role, description } = req.body;
    const newRole = new AllRolesModel({ role, description });
    await newRole.save();
    res.status(201).json({ message: "Role added", success: true, data: newRole });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", success: false, error: err.message });
  }
};

export const deleteRole = async (req, res) => {
  try {
    const { roleId } = req.params;  // ✅ get from params
    await AllRolesModel.findByIdAndDelete(roleId);
    res.status(200).json({ message: "Role deleted", success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", success: false, error: err.message });
  }
};