// login,  logout.
import FinalizedEmployee from "../models/FinalizedEmployees.model.js";
import dotenv from "dotenv";
import bcrypt from "bcrypt";

dotenv.config();

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
        const { organizationId, email, password } = req.body;

        if (!organizationId || !email || !password) {
            return res.status(400).json({
                status: false,
                message: "OrganizationId, Email and password are required",
            });
        }

        const user = await FinalizedEmployee.findOne({
            OrganizationId: organizationId,
            personalEmail: email,
        });

        if (!user) {
            return res.status(404).json({ status: false, message: "User not found" });
        }

        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(400).json({ status: false, message: "Invalid password" });
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

       return res
            .cookie("accessToken", accessToken, {
                httpOnly: true,
                secure: false,
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
        secure: isProd,
        sameSite: isProd ? "None" : "Lax",
      })
      .clearCookie("refreshToken", {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "None" : "Lax",
      })
      .status(200)
      .json({ status: true, message: "User logged out successfully" });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal server error", error: error.message });
  }
};



// in case the employee forget the password -> this will require some logic -> chairman etc might want to improve this..
export const confirmCurrentPassword = async (req, res) => {
    try {
        const { oldPassword, newPassword, ConfirmPassword } = req.body;

        const user = await FinalizedEmployee.findById(req.user._id);
        if (!user) {
            return res.status(400).json({
                status: false,
                message: "User not found",
            });
        }

        const isPasswordValid = await FinalizedEmployee.comparePassword(oldPassword);
        if (!isPasswordValid) {
            return res.status(400).json({
                status: false,
                message: "Invalid old password",
            });
        }

        if (newPassword !== ConfirmPassword) {
            return res.status(400).json({
                status: false,
                message: "Passwords do not match",
            });
        }

        // Assign and save (pre-save hook will hash password automatically)
        user.password = newPassword;
        await user.save();

        res.status(200).json({
            status: true,
            message: "Password updated successfully",
        });

    } catch (error) {
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

// now a function for the checking if the permission exist.