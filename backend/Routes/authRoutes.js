import express from "express";
import { 
  logOut, 
  loginUser, 
  ResetPassword, 
  ForgetUserId, 
  getLoggedInUser 
} from "../contollers/userController.js";

import { 
  checkAuth, 
  authenticate,
  checkEmployeeStatus,
} from "../middlewares/authMiddlewares.js";

const router = express.Router();

// Apply checkEmployeeStatus before login
router.post("/login", checkEmployeeStatus, loginUser);

// For reset-password and forget-userid, you might also want to check status
router.post("/reset-password", checkEmployeeStatus, ResetPassword);
router.post("/forget-userid", checkEmployeeStatus, ForgetUserId);

// Authenticated routes
router.post("/logout", authenticate, logOut);
router.get("/check-auth", authenticate, checkAuth);
router.get("/me", authenticate, getLoggedInUser);

export default router;
