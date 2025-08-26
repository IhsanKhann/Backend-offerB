import express from "express";
import {logOut,loginUser} from "../contollers/userController.js";

const router = express.Router();

router.post("/auth/login", loginUser);
router.post("/auth/logout", logOut);

export default router;