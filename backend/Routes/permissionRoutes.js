import express from "express";
import {
    getEmployeePermissions,
    AllPermissions,
    createPermission,
    removePermission
} from "../contollers/permissionControllers.js";
import {authenticate,authorize} from "../middlewares/authMiddlewares.js";

const router = express.Router()
router.use(authenticate);

router.get("/permissions/getPermissions/:employeeId" , getEmployeePermissions);

// view permissions:
router.get("/permissions/AllPermissions", AllPermissions);

// create/add permissions:
router.post("/permissions/createPermission",createPermission);

// remove permissions..
router.delete("/permissions/removePermission/:id",removePermission);



export default router;