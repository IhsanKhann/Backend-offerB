import {
    createCycle, 
    getAllCycles,
    getCycleById,
    updateCycle,
    deleteCycle,
    // create,update,delete,Get(display)
} from "../../contollers/BussinessOperationControllers/cyclesControllers.js";

import express from "express";
const router = express.Router();

// router.get("/:id", getCycleById);
router.put("/update/:id", updateCycle);
router.delete("/delete/:id", deleteCycle);
router.post("/create", createCycle);
router.get("/all", getAllCycles);

export default router; // can be imported with any name - default.