import express from "express";
import {logOut,loginUser} from "../contollers/userController.js";
import { checkAuth, authenticate} from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.post("/auth/login", loginUser);
router.post("/auth/logout",authenticate,logOut);
router.get("/auth/check-auth",authenticate,checkAuth);

export default router;