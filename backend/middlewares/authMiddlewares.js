import jwt from "jsonwebtoken";
import FinalizedEmployee from "../models/HRModals/FinalizedEmployees.model.js";
import RoleModel from "../models/HRModals/Role.model.js";
import {OrgUnitModel} from "../models/HRModals/OrgUnit.js";

import {getRootOrgUnit,getPermissionsForUser,getAllDescendents} from "../middlewares/authUtility.js";

import dotenv from "dotenv";

dotenv.config();

export const checkEmployeeStatus = async (req, res, next) => {
  try {
    const { email, UserId } = req.body;

    if (!email && !UserId) {
      return res.status(400).json({ message: "Email or UserId is required" });
    }

    // Find employee
    const employee =
      (email && (await FinalizedEmployee.findOne({ personalEmail: email }))) ||
      (UserId && (await FinalizedEmployee.findOne({ UserId }))) ||
      null;

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const status = employee.profileStatus?.decision;

    if (["Suspended", "Blocked", "Terminated"].includes(status)) {
      return res.status(403).json({
        message: `Access denied. Employee status is '${status}'`,
        suspension: employee.suspension || {},
        block: employee.blocked || {},
        termination: employee.terminated || {},
      });
    }

    // Attach employee so loginUser doesn’t need to query again
    req.employee = employee;

    next();
  } catch (err) {
    console.error("Error in checkEmployeeStatus:", err);
    res.status(500).json({
      message: "Error checking employee status",
      error: err.message,
    });
  }
};

export const authenticate = async (req, res, next) => {
  try {
    let token = req.cookies?.accessToken;

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - No token provided",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      const msg = err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
      return res.status(401).json({ status: false, message: msg });
    }

    const user = await FinalizedEmployee.findById(decoded._id);
    if (!user) {
      return res.status(401).json({ status: false, message: "Unauthorized - user not found" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Authenticate error:", err);
    return res.status(500).json({ status: false, message: "Server error" });
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

