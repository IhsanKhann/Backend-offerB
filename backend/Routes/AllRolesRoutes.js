import { getAllRolesList, addRole, deleteRole } from "../contollers/AllRolesController.js";
import { authenticate, authorize} from "../middlewares/authMiddlewares.js";

import express from "express";
const router = express.Router();

router.use(authenticate);
// ---------------------- Get All Roles ----------------------
router.get("/getAllRolesList", 
    
    authorize("View_AllRolesList"),
    getAllRolesList);

// add and delete roles.
router.post("/addRole", 
    authorize("Add_Role"),
    addRole);

  router.delete("/deleteRole/:roleId", 
    authorize("Delete_Role"),
    deleteRole);

export default router;
