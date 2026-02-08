// login, logout, and authentication with audit logging
import FinalizedEmployee from "../models/HRModals/FinalizedEmployees.model.js";
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import AuditService from "../services/auditService.js";
import CONSTANTS from "../configs/constants.js";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";

dotenv.config();

// -------------------- helper functions --------------------------

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send email helper
const sendPasswordEmail = async (employee, newPassword) => {
  await transporter.sendMail({
    from: `"HR Department" <${process.env.EMAIL_USER}>`,
    to: employee.personalEmail,
    subject: "Your Password Has Been Reset",
    text: `Dear ${employee.individualName},

Your password has been successfully reset.

Here are your login details:
- User ID: ${employee.UserId}
- Organization ID: ${employee.OrganizationId}
- Password: ${newPassword}

Please keep this information secure.`,

    html: `
      <p>Dear <b>${employee.individualName}</b>,</p>
      <p>Your password has been successfully <b>reset</b>.</p>
      <p><b>Login details:</b></p>
      <ul>
        <li>User ID: <b>${employee.UserId}</b></li>
        <li>Organization ID: <b>${employee.OrganizationId}</b></li>
        <li>Password: <b>${newPassword}</b></li>
      </ul>
      <p><i>Please keep this information secure and do not share it with anyone.</i></p>
    `,
  });
};

// Send UserId email
const sendUserIdEmail = async (employee) => {
  await transporter.sendMail({
    from: `"HR Department" <${process.env.EMAIL_USER}>`,
    to: employee.personalEmail,
    subject: "Your User ID",
    text: `Dear ${employee.individualName},

Here is your User ID: ${employee.UserId}

Please keep it secure.`,
    html: `
      <p>Dear <b>${employee.individualName}</b>,</p>
      <p>Here is your <b>User ID</b>: <b>${employee.UserId}</b></p>
      <p><i>Please keep it secure and do not share it with anyone.</i></p>
    `,
  });
};

// -------------------- functions/controllers ----------------------
export const generateAccessAndRefreshTokens = async(userId) => {

    if(!userId) throw new Error("User id is required");

    const user = await FinalizedEmployee.findById(userId);

    if(!user) throw new Error("User not found");

    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({validateBeforeSave: false});

    return {accessToken,refreshToken};
};

// ✅ FIXED: loginUser with proper error handling and audit logging
export const loginUser = async (req, res) => {
  try {
    const { UserId, password } = req.body;

    console.log("🔐 Login attempt:", { UserId, hasPassword: !!password });

    // Validate inputs
    if (!UserId) {
      return res.status(400).json({ 
        status: false, 
        message: "User ID is required" 
      });
    }

    if (!password) {
      return res.status(400).json({ 
        status: false, 
        message: "Password is required" 
      });
    }

    // ✅ FIX: Check if employee was attached by middleware, if not fetch manually
    let user = req.employee;
    
    if (!user) {
      console.log("⚠️ Employee not attached by middleware, fetching manually...");
      user = await FinalizedEmployee.findOne({ UserId });
    }

    if (!user) {
      // 🔍 AUDIT LOG - Failed login attempt
      await AuditService.log({
        eventType: CONSTANTS.AUDIT_EVENTS.LOGIN_FAILED,
        actorId: null,
        targetId: null,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: {
          attemptedUserId: UserId,
          reason: "User not found"
        }
      });

      return res.status(401).json({ 
        status: false, 
        message: "Invalid credentials" 
      });
    }

    console.log("✅ User found:", user.individualName);

    // Validate password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      console.log("❌ Invalid password");

      // 🔍 AUDIT LOG - Failed login attempt
      await AuditService.log({
        eventType: CONSTANTS.AUDIT_EVENTS.LOGIN_FAILED,
        actorId: user._id,
        targetId: user._id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: {
          UserId: user.UserId,
          reason: "Invalid password"
        }
      });

      return res.status(401).json({ 
        status: false, 
        message: "Invalid credentials" 
      });
    }

    console.log("✅ Password valid");

    // Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    console.log("✅ Tokens generated, sending response");

    // 🔍 AUDIT LOG - Successful login
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.LOGIN_SUCCESS,
      actorId: user._id,
      targetId: user._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        UserId: user.UserId,
        individualName: user.individualName
      }
    });

    res
      .cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: false,  // set true in production
        sameSite: "Lax",
        maxAge: 15 * 60 * 1000,
      })
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .status(200)
      .json({
        status: true,
        message: "User logged in successfully",
        user: {
          _id: user._id,
          OrganizationId: user.OrganizationId,
          UserId: user.UserId,
          personalEmail: user.personalEmail,
          individualName: user.individualName,
        },
        accessToken,
        refreshToken,
      });
  } catch (error) {
    console.error("❌ loginUser error:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const logOut = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ status: false, message: "Unauthorized" });
    }

    await FinalizedEmployee.findByIdAndUpdate(req.user._id, { refreshToken: "" });

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.LOGOUT,
      actorId: req.user._id,
      targetId: req.user._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        UserId: req.user.UserId,
        individualName: req.user.individualName
      }
    });

    const isProd = process.env.NODE_ENV === "production";

    return res
      .clearCookie("accessToken", {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      })
      .clearCookie("refreshToken", {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      })
      .status(200)
      .json({ status: true, message: "User logged out successfully" });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal server error", error: error.message });
  }
};

// Reset Password Controller
export const ResetPassword = async (req, res) => {
  try {
    const { UserId, email, newPassword } = req.body;

    // 1️⃣ Find employee by UserId and email
    const employee = await FinalizedEmployee.findOne({
      UserId,
      personalEmail: email.toLowerCase(),
    });

    if (!employee) {
      return res.status(404).json({
        status: false,
        message: "User with provided UserId and Email not found",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10); 
    employee.password = newPassword;
    employee.passwordHash = hashedPassword;

    // 3️⃣ Save the updated employee
    await employee.save();

    // 🔍 AUDIT LOG
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.PASSWORD_RESET,
      actorId: employee._id,
      targetId: employee._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        UserId: employee.UserId,
        email: employee.personalEmail,
        individualName: employee.individualName
      }
    });

    // 4️⃣ Send email with new password
    await sendPasswordEmail(employee, newPassword);

    res.status(200).json({
      status: true,
      message: "Password reset successfully. An email has been sent with your new password.",
    });
  } catch (error) {
    console.error("ResetPassword Error:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Forget UserId Controller (READ ONLY - NO STATE CHANGE, NO AUDIT)
export const ForgetUserId = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1️⃣ Find employee by email
    const employee = await FinalizedEmployee.findOne({
      personalEmail: email,
    });

    if (!employee) {
      return res.status(404).json({
        status: false,
        message: "User with this email not found",
      });
    }

    // 2️⃣ Check password
    const isPasswordValid = await employee.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        status: false,
        message: "Incorrect password",
      });
    }

    // 3️⃣ Send email with UserId
    await sendUserIdEmail(employee);

    res.status(200).json({
      status: true,
      message: "Your User ID has been sent to your email",
    });
  } catch (error) {
    console.error("ForgetUserId Error:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const refreshToken = async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies?.refreshToken;

        if (!incomingRefreshToken) {
            return res.status(400).json({
                status: false,
                message: "Refresh token not found",
            });
        }

        let decodedToken;
        try {
            decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        } catch (err) {
            return res.status(401).json({
                status: false,
                message: "Invalid or expired refresh token",
            });
        }

        const user = await FinalizedEmployee.findById(decodedToken._id);
        if (!user) {
            return res.status(404).json({
                status: false,
                message: "User not found",
            });
        }

        // Compare stored refresh token with the incoming one
        if (incomingRefreshToken !== user.refreshToken) {
            return res.status(403).json({
                status: false,
                message: "Refresh token mismatch",
            });
        }

        // Generate new tokens
        const { accessToken, refreshToken: newRefreshToken } =
            await generateAccessAndRefreshTokens(user._id);

        // 🔍 AUDIT LOG
        await AuditService.log({
          eventType: CONSTANTS.AUDIT_EVENTS.TOKEN_REFRESHED,
          actorId: user._id,
          targetId: user._id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          details: {
            UserId: user.UserId
          }
        });

        // Send new cookies
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "Strict",
            maxAge: 15 * 60 * 1000, // 15 mins
        });

        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "Strict",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return res.status(200).json({
            status: true,
            message: "Tokens refreshed successfully",
            accessToken,
            refreshToken: newRefreshToken,
        });

    } catch (error) {
        console.error("Error refreshing tokens:", error);
        return res.status(500).json({
            status: false,
            message: "Internal server error",
        });
    }
};

// userController.js - Fixed getLoggedInUser (READ ONLY - NO AUDIT)
export const getLoggedInUser = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ 
        status: false, 
        message: "Unauthorized" 
      });
    }

    const assignment = await RoleAssignmentModel.findOne({
      employeeId: user._id,
      isActive: true
    })
    .populate('roleId')
    .populate('orgUnit');

    // ✅ Handle "All" department code
    let department = assignment?.departmentCode || null;
    
    let accessibleDepartments = [];
    if (department === "All") {
      accessibleDepartments = ["HR", "Finance", "BusinessOperation"];
    } else if (department) {
      accessibleDepartments = [department];
    }

    const userResponse = {
      ...user.toObject(),
      department: department,
      accessibleDepartments: accessibleDepartments,
      role: assignment?.roleId || null,
      orgUnit: assignment?.orgUnit || null,
      status: assignment?.status || null
    };

    return res.status(200).json({
      status: true,
      user: userResponse
    });

  } catch (err) {
    console.error("getLoggedInUser error:", err);
    return res.status(500).json({ 
      status: false, 
      message: "Server error",
      error: err.message 
    });
  }
};