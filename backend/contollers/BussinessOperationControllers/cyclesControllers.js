// controllers/BussinessOperationControllers/cyclesControllers.js
import Cycle from "../../models/BussinessOperationModals/cyclesModel.js";

// 1. CREATE CYCLE
export const createCycle = async (req, res) => {
  try {
    const { name, startDate, endDate, description, type } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Adjust dates
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0); // 00:00:00.000

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // 23:59:59.999

    const newCycle = new Cycle({
      name,
      startDate: start,
      endDate: end,
      description: description || "",
      type: type || "custom",
    });

    await newCycle.save();

    res.status(201).json({
      message: "Cycle created successfully.",
      cycle: newCycle,
    });
  } catch (error) {
    console.error("Error creating cycle:", error);
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};

// 2. GET ALL CYCLES
export const getAllCycles = async (req, res) => {
  try {
    const cycles = await Cycle.find().sort({ createdAt: -1 });

    res.status(200).json({
      message: "All cycles fetched successfully.",
      cycles,
    });
  } catch (error) {
    console.error("Error fetching cycles:", error);
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};

// 3. GET CYCLE BY ID
export const getCycleById = async (req, res) => {
  try {
    const cycle = await Cycle.findById(req.params.id);

    if (!cycle) {
      return res.status(404).json({ message: "Cycle not found." });
    }

    res.status(200).json({
      message: "Cycle fetched successfully.",
      cycle,
    });
  } catch (error) {
    console.error("Error fetching cycle:", error);
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};

// 4. UPDATE CYCLE
export const updateCycle = async (req, res) => {
  try {
    const { name, startDate, endDate, description, type } = req.body;

    // Adjust dates
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const updatedCycle = await Cycle.findByIdAndUpdate(
      req.params.id,
      {
        name,
        startDate: start,
        endDate: end,
        description,
        type,
      },
      { new: true }
    );

    if (!updatedCycle) {
      return res.status(404).json({ message: "Cycle not found." });
    }

    res.status(200).json({
      message: "Cycle updated successfully.",
      cycle: updatedCycle,
    });
  } catch (error) {
    console.error("Error updating cycle:", error);
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};

// 5. DELETE CYCLE
export const deleteCycle = async (req, res) => {
  try {
    const deletedCycle = await Cycle.findByIdAndDelete(req.params.id);

    if (!deletedCycle) {
      return res.status(404).json({ message: "Cycle not found." });
    }

    res.status(200).json({
      message: "Cycle deleted successfully.",
      cycle: deletedCycle,
    });
  } catch (error) {
    console.error("Error deleting cycle:", error);
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};
