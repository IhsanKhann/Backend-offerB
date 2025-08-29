import express from "express";
import {
    getEmployeePermissions,
    AllPermissions,
    createPermission,
    removePermission,
    removeEmployeePermission,
    addEmployeePermission
} from "../contollers/permissionControllers.js";
import {authenticate,authorize} from "../middlewares/authMiddlewares.js";

const router = express.Router()
router.use(authenticate);

// add a permission to a specific employee..
router.post("/permissions/addEmployeePermission", addEmployeePermission);

// remove a permission from a an employee..
router.post("/permissions/removeEmployeePermission", removeEmployeePermission);

// get a specific employee permission..
router.get("/permissions/getPermissions/:employeeId" , getEmployeePermissions);

// view permissions:
router.get("/permissions/AllPermissions", AllPermissions);

// create/add permissions:
router.post("/permissions/createPermission",createPermission);

// remove permissions..
router.delete("/permissions/removePermission/:id",removePermission);



export default router;