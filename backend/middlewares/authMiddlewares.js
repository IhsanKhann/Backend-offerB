import jwt from "jsonwebtoken";
import FinalizedEmployee from "../models/FinalizedEmployees.model.js";
import RoleModel from "../models/Role.model.js";
import {OrgUnitModel} from "../models/OrgUnit.js";
import dotenv from "dotenv";

dotenv.config();

export const authenticate = async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken;
        if (!token) {
            return res.status(401).json({
                status: false,
                message: "Unauthorized - No token provided",
            });
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        if (!decodedToken) {
            return res.status(401).json({
                status: false,
                message: "Invalid token",
            });
        }

        const user = await FinalizedEmployee.findById(decodedToken._id);
        if (!user) {
            return res.status(404).json({
                status: false,
                message: "User not found",
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            status: false,
            message: "Token verification failed",
            error: error.message,
        });
    }
};

export const authorize = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const { role, orgUnit } = req.user;
      if (!role || !orgUnit) {
        return res.status(401).json({ message: "User role or orgUnit missing" });
      }

      let permissions = new Set();

      // --- Helper: collect permissions from a role directly
      const collectRolePermissions = async (roleId) => {
        const roleDoc = await RoleModel.findById(roleId).populate("permissions");
        if (roleDoc?.permissions) {
          roleDoc.permissions.forEach((p) => permissions.add(p.name));
        }
        return roleDoc;
      };

      // --- Step 1: Start with user’s direct role
      await collectRolePermissions(role);

      // --- Step 2: Traverse orgUnit hierarchy upwards
      let currentOrgUnit = await OrgUnitModel.findById(orgUnit).populate("role");
      while (currentOrgUnit) {
        if (currentOrgUnit.role) {
          await collectRolePermissions(currentOrgUnit.role);
        }
        if (!currentOrgUnit.parent) break;
        currentOrgUnit = await OrgUnitModel.findById(currentOrgUnit.parent).populate("role");
      }

      // --- Step 3: Check if required permission exists
      if (!permissions.has(requiredPermission)) {
        return res.status(403).json({ message: "Forbidden: Missing permission" });
      }

      next();
    } catch (err) {
      console.error("Authorization error:", err);
      return res.status(500).json({
        message: "Authorization error",
        error: err.message,
      });
    }
  };
};

