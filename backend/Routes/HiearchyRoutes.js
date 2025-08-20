import express from "express";
import {
    addHierarchy,
    getHierarchy,

    // Division
    createDivision,
    deleteDivision,
    updateDivision,
    getAllDivisions,

    // Department
    createDepartment,
    deleteDepartment,
    updateDepartment,

    // Group
    createGroup,
    deleteGroup,
    updateGroup,

    // Cell
    createCell,
    deleteCell,
    updateCell
} from "../contollers/hiearchyController.js";

const router = express.Router();

// ====== Hierarchy (Full tree) ======
router.post("/hierarchy/add-hierarchy", addHierarchy);
router.get("/hierarchy/get-hierarchy", getHierarchy);

// ====== Division Routes ======
router.post("/hierarchy/add-division", createDivision);
router.post("/hierarchy/delete-division", deleteDivision); // delete by name
router.put("/hierarchy/division/:id", updateDivision);   // update by ID
router.get("/hierarchy/get-divisions", getAllDivisions);

// ===== Department Routes =====
// Create a department under a division
router.post("/hierarchy/division/:divisionId/department", createDepartment);
// Update a department
router.put("/hierarchy/department/:id", updateDepartment);
// Delete a department
router.delete("/hierarchy/department/:departmentId", deleteDepartment);


// ====== Group Routes ======
// Create group inside a department
router.post("/hierarchy/division/:divisionId/department/:departmentId/group", createGroup);

// Update group
router.put("/hierarchy/division/:divisionId/department/:departmentId/group/:groupId", updateGroup);

// Delete group
router.delete("/hierarchy/group/:groupId", deleteGroup);

// ====== Cell Routes =====
// Create cell inside a group
router.post("/hierarchy/division/:divisionId/department/:departmentId/group/:groupId/cell", createCell);

// Update cell
router.put("/hierarchy/division/:divisionId/department/:departmentId/group/:groupId/cell/:cellId", updateCell);

// Delete cell
router.delete("/hierarchy/cell/:cellId", deleteCell);

export default router;
