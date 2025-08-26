// login,  logout.
import FinalizedEmployee from "../models/FinalizedEmployees.model.js";
import dotenv from "dotenv";

dotenv.config();

export const generateAccessAndRefreshTokens = async(userId) => {

    if(!userId) throw new Error("User id is required");

    const user = await FinalizedEmployee.findOne({OrganizationId:userId});
    if(!user) throw new Error("User not found");

    const accessToken = await FinalizedEmployee.generateAccessToken();
    const refreshToken = await FinalizedEmployee.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({validateBeforeSave: false});

    return {accessToken,refreshToken};
};

export const loginUser = async (req, res) => { 
    try{
        const { organizationId, Email, password } = req.body;
        if(!organizationId || !password || !Email){
            return res.status(400).json({
                status: false,
                message: "OrganizationId, Email and password are required",
            })
        }
    
        // find in the db
        const user = await FinalizedEmployee.findOne({
            $or:[{organizationId},{Email}]
        });

        if(!user){
            return res.status(400).json({
                status: false,
                message:  "user not found",
            })
        }

        // compare passwords:
        const isPasswordValid = await FinalizedEmployee.comparePassword(password);
        if(!isPasswordValid){
            return res.status(400).json({
                status: false,
                message: "Invalid password",
            })
        }

        // generate tokens and send them back in cookies (http only cookies.)
        // now we give back the user and tokens back. Tokens in form of cookies.
        const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user.OrganizationId);

        // send cookies and a response
        return res.cookie("accessToken",accessToken,{
            httpOnly: true,
            secure: true,
        }).cookie("refreshToken",refreshToken,{
            httpOnly: true,
            secure: true,
        }).status(200).json({
            status: true,
            message: "User logged in successfully",
            user,accessToken,refreshToken
        })
        
    }
    catch(error){
        res.status(500).json({
            status: false,
            message: "Internal server error",
            error: error.message,
        })
    }
};

export const logOut = async (req,res) => {
    try{
        
        const userid = req.user.OrganizationId; // upon decoding.

        const user = await FinalizedEmployee.findByIdAndUpdate(userid,{
            $set:{
                refreshToken: "" || undefined,
            }
        });

        if(!user){
            return res.status(400).json({
                status: false,
                message: "User not found",
            })
        }

       res
        .clearCookie("accessToken", { httpOnly: true, secure: true })
        .clearCookie("refreshToken", { httpOnly: true, secure: true })
        .status(200)
        .json({
            status: true,
            message: "User logged out successfully",
        })

    }catch(error){
        res.status(500).json({
            status: false,
            message: "Internal server error",
            error: error.message,
        })
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