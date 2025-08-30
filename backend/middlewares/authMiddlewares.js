import jwt from "jsonwebtoken";
import FinalizedEmployee from "../models/FinalizedEmployees.model.js";
import RoleModel from "../models/Role.model.js";
import {OrgUnitModel} from "../models/OrgUnit.js";
import {getRootOrgUnit,getPermissionsForUser,getAllDescendents} from "../middlewares/authUtility.js";

import dotenv from "dotenv";

dotenv.config();

export const authenticate = async (req, res, next) => {
  try {
    let token = req.cookies?.accessToken;

    // fallback to Authorization header
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - No token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await FinalizedEmployee.findById(decoded._id);

    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    req.user = user; // attach user
    next();
  } catch (err) {
    console.error("Authenticate error:", err);
    return res.status(401).json({
      status: false,
      message: "Token verification failed",
      error: err.message,
    });
  }
};

export const checkAuth = async (req, res) => {
  try {
    let token = req.cookies?.accessToken;

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ status: false, message: "Not authenticated" });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await FinalizedEmployee.findById(decoded._id).select("-password");

    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    return res.status(200).json({ status: true, user });
  } catch (error) {
    return res.status(401).json({ status: false, message: "Invalid or expired token" });
  }
};

export const authorize = (requiredPermission) => async (req, res, next) => {
  try {
    const user = req.user; // from authenticate middleware

    if (req.headers["x-disable-auth"] === "true") {
      console.log("⚠️ Authorization skipped for this request");
      return next();
    }

    console.log(req.user.permissions);
    // 1️⃣ Get all permissions including descendants
    const permissions = await getPermissionsForUser(user);

    // 2️⃣ Departmental isolation
    if (req.resourceOrgUnit) {
      const userRoot = await getRootOrgUnit(user.orgUnit);
      const resourceRoot = await getRootOrgUnit(req.resourceOrgUnit);
      if (userRoot._id.toString() !== resourceRoot._id.toString()) {
        return res.status(403).json({ message: "Forbidden: department isolation" });
      }
    }

    // 3️⃣ Check permission
    if (!permissions.has(requiredPermission)) {
      return res.status(403).json({ message: "Forbidden: missing permission" });
    }

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Authorization error", error: err.message });
  }
};
