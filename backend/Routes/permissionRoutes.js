import express from "express";
import {getEmployeePermissions} from "../contollers/permissionControllers.js";
import {authenticate,authorize} from "../middlewares/authMiddlewares.js";

const router = express.Router()
router.use(authenticate);

router.get("/permissions/getPermissions/:employeeId" , getEmployeePermissions);
export default router;