import express from "express";
import {logOut,loginUser,ResetPassword,ForgetUserId} from "../contollers/userController.js";
import { checkAuth, authenticate, } from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.post("/login", loginUser);
router.post("/reset-password", ResetPassword);
router.post("/forget-userid", ForgetUserId);

router.post("/logout",authenticate,logOut);
router.get("/check-auth",authenticate,checkAuth);

export default router;