// login,  logout.
import FinalizedEmployee from "../models/HRModals/FinalizedEmployees.model.js";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";

dotenv.config();

// -------------------- helper functions --------------------------

const transporter = nodemailer.createTransport({
  service: "gmail", // or outlook, yahoo
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

export const loginUser = async (req, res) => {
  try {
    const { password } = req.body;

    // Employee was already checked by checkEmployeeStatus
    const user = req.employee;

    if (!password) {
      return res.status(400).json({ status: false, message: "Password is required" });
    }

    // Validate password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({ status: false, message: "Invalid password" });
    }

    // Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    console.log("Access Secret:", process.env.JWT_ACCESS_SECRET);
    console.log("Access Expiry:", process.env.JWT_ACCESS_EXPIRE);
    
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

// Forget UserId Controller
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

        const user = await FinalizedEmployee.findById(decodedToken.id);
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

export const getLoggedInUser = async (req, res) => {
  try {
    const user = req.user; // req.user is populated by the auth middleware

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Fetch full user data from database using both _id and email for safety
    const employee = await FinalizedEmployee.findOne({
      $or: [{ _id: user._id }, { personalEmail: user.personalEmail }]
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    return res.status(200).json({ success: true, employee });
  } catch (err) {
    console.error("getLoggedInUser error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
