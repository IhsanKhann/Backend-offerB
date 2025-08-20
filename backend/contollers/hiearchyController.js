import mongoose from "mongoose";
import {HierarchyModel} from "../models/Hiearchy.model.js";

// only for saving manual work for tesing, we only call this once.
const addHierarchy = async (req, res) => {
  try {
    const { name, divisions } = req.body;

    if (!divisions || divisions.length === 0) {
      return res.status(400).json({
        message: "At least one division is required",
        success: false,
      });
    }

    const newHierarchy = new HierarchyModel(req.body);
    await newHierarchy.save();

    return res.status(201).json({
      message: "Hierarchy created successfully",
      success: true,
      data: newHierarchy,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      success: false,
      error: error.message,
    });
  }
};

// this will be fetched to frontend.
const getHierarchy = async (req, res) => {
  try {
    // const hierarchy = await HierarchyModel.findById(hierarchyId);
    const hierarchy = await HierarchyModel.findOne();

    if (!hierarchy) {
      return res.status(404).json({
        message: "Hierarchy not found",
        success: false,
        data: {},
      });
    }

    return res.status(200).json({
      message: "Hierarchy found",
      success: true,
      divisions: hierarchy.divisions, // returns nested divisions -> departments -> groups -> cells
    });
  } catch (error) {
    console.error("🔥 getHierarchy error:", error);
    return res.status(500).json({
      message: "Server error",
      success: false,
      error: error.message,
    });
  }
};

// Get all divisions
const getAllDivisions = async (req, res) => {
  try {
    const divisions = await HierarchyModel.find()
    res.status(200).json(divisions);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// create division
const createDivision = async (req, res) => {
  try {
    const { name, departments } = req.body;

    if (!name) {
      return res.status(400).json({
        message: "Division name is required",
        success: false,
      });
    }

    // Find the single hierarchy document (assuming only 1 exists)
    const hierarchy = await HierarchyModel.findOne();
    if (!hierarchy) {
      return res.status(404).json({
        message: "Hierarchy not found",
        success: false,
      });
    }

    // Case-insensitive duplicate check
    const division = hierarchy.divisions.find(
      (div) => div.name.toLowerCase() === name.toLowerCase()
    );
    if (division) {
      return res.status(400).json({
        message: "Division name already exists",
        success: false,
      });
    }

    // Push new division into the array
    hierarchy.divisions.push({
      name,
      departments: departments || [] // optional
    });

    await hierarchy.save();

    return res.status(201).json({
      message: "Division added successfully",
      success: true,
      data: hierarchy,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      success: false,
      error: error.message,
    });
  }
};

// delete divison
const deleteDivision = async(req,res) => {
    try{
        const {name} = req.body;

        if(!name){
            return res.status(400).json({
                message: "Name is required to delete a whole divison",
                success: false,
            });
        }

        const updatedHierarchy = await HierarchyModel.findOneAndUpdate(
            {},
            { $pull: { divisions: { name: name } } }, // remove division with this name
            { new: true } // return updated hierarchy
        );
        
        if(!updatedHierarchy){
            return res.status(404).json({
                message: "Hierarchy not found",
                success: false,
            });
        }

        return res.status(200).json({
            message: "Divison deleted successfully",
            success: true,
            data: updatedHierarchy,
        });
    }
    catch(error){
        return res.status(500).json({
            message: "Internal Server error",
            success: false,
            error: error.message,
        });
    }
};

// update divison
const updateDivision = async (req, res) => {
  try {
    const { id } = req.params; // this is the division's _id (e.g. 68a2bc4ee6b6f001619fda6d)
    const { name, departments } = req.body;

    if (!name || !departments) {
      return res.status(400).json({ message: "Division name and departments are required" });
    }

    // Find document where one division has _id = id
    const result = await HierarchyModel.findOneAndUpdate(
      { "divisions._id": id }, 
      {
        $set: {
          "divisions.$.name": name,
          "divisions.$.departments": departments
        }
      },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ message: "Division not found" });
    }

    res.status(200).json({
      message: "Division updated successfully",
      status: true,
      result
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// departments:
// Create Department
const createDepartment = async (req, res) => {
  try {
    const {divisionId} = req.params;
    const { name, groups } = req.body;

    if (!name) return res.status(400).json({ message: "Department name required", success: false });

    const hierarchy = await HierarchyModel.findOne();
    const divison = hierarchy.divisions.find((div) => div._id == divisionId);
    const department = divison.departments.some((div)=> div.name.toLowerCase() === name.toLowerCase());

    if(department){
        return res.status(400).json({ message: "Department name already exists", success: false });
    }

    divison.departments.push({
        name,
        groups: groups || []
    })

    await hierarchy.save();
    // const updatedHierarchy = await HierarchyModel.findOneAndUpdate(
    //   { "divisions._id": divisionId },
    //   { $push: { "divisions.$.departments": { name, groups: groups || [] } } },
    //   { new: true }
    // );
    // if (!updatedHierarchy) return res.status(404).json({ message: "Division not found", success: false });

    res.status(200).json({ message: "Department created successfully", success: true, data:hierarchy });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", success: false, error: error.message });
  }
};

// Update Department
const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params; // department _id
    const { name, groups } = req.body;

    if (!name || !groups) return res.status(400).json({ message: "Name and groups are required", success: false });

    const updatedHierarchy = await HierarchyModel.findOneAndUpdate(
      { "divisions.departments._id": id },
      { $set: { "divisions.$[].departments.$[dept].name": name, "divisions.$[].departments.$[dept].groups": groups } },
      { new: true, arrayFilters: [{ "dept._id": id }] }
    );

    if (!updatedHierarchy) return res.status(404).json({ message: "Department not found", success: false });

    res.status(200).json({ message: "Department updated successfully", success: true, data: updatedHierarchy });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", success: false, error: error.message });
  }
};

// Delete Department
const deleteDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;

    const updatedHierarchy = await HierarchyModel.findOneAndUpdate(
      {},
      { $pull: { "divisions.$[].departments": { _id: departmentId } } },
      { new: true }
    );

    if (!updatedHierarchy) return res.status(404).json({ message: "Department not found", success: false });

    res.status(200).json({ message: "Department deleted successfully", success: true, data: updatedHierarchy });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", success: false, error: error.message });
  }
};

// ------------------------ Groups ------------------------ //

// Create Group
const createGroup = async (req, res) => {
  try {
    const { divisionId, departmentId } = req.params;
    const { name, cells } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Group name required", success: false });
    }

    const hierarchy = await HierarchyModel.findOne();
    if (!hierarchy) {
      return res.status(404).json({ message: "Hierarchy not found", success: false });
    }

    const division = hierarchy.divisions.find(
      (div) => div._id.toString() === divisionId
    );
    if (!division) {
      return res.status(404).json({ message: "Division not found", success: false });
    }

    const department = division.departments.find(
      (dept) => dept._id.toString() === departmentId
    );
    if (!department) {
      return res.status(404).json({ message: "Department not found", success: false });
    }

    const groupExists = department.groups.some(
      (grp) => grp.name.toLowerCase() === name.toLowerCase()
    );
    if (groupExists) {
      return res.status(400).json({
        success: false,
        message: "Group with the same name already exists",
      });
    }

    // Add new group
    department.groups.push({
      name,
      cells: cells || [],
    });

    await hierarchy.save();

    res.status(200).json({
      message: "Group created successfully",
      success: true,
      data: hierarchy,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", success: false, error: error.message });
  }
};

// this is my updateGroup function.
const updateGroup = async (req, res) => {
  try {
    const { divisionId, departmentId, groupId } = req.params;
    const { name, cells } = req.body;

    if (!name || !cells)
      return res.status(400).json({ message: "Name and cells required", success: false });

    const updatedHierarchy = await HierarchyModel.findOneAndUpdate(
      { "divisions._id": divisionId }, // match the division
      {
        $set: {
          "divisions.$.departments.$[dept].groups.$[grp].name": name,
          "divisions.$.departments.$[dept].groups.$[grp].cells": cells,
        },
      },
      {
        new: true,
        arrayFilters: [
          { "dept._id": departmentId }, // target correct department
          { "grp._id": groupId },       // target correct group
        ],
      }
    );

    if (!updatedHierarchy)
      return res.status(404).json({ message: "Group not found", success: false });

    res.status(200).json({
      message: "Group updated successfully",
      success: true,
      data: updatedHierarchy,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", success: false, error: error.message });
  }
};

// Delete Group
const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    const updatedHierarchy = await HierarchyModel.findOneAndUpdate(
      {},
      { $pull: { "divisions.$[].departments.$[].groups": { _id: groupId } } },
      { new: true }
    );

    if (!updatedHierarchy) return res.status(404).json({ message: "Group not found", success: false });

    res.status(200).json({ message: "Group deleted successfully", success: true, data: updatedHierarchy });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", success: false, error: error.message });
  }
};

// ------------------------ Cells ------------------------ //

// Create Cell
const createCell = async (req, res) => {
  try {
    const { divisionId, departmentId, groupId } = req.params;
    const { name } = req.body;

    if (!name) return res.status(400).json({ message: "Cell name required", success: false });

    const hierarchy = await HierarchyModel.findOne();
    if (!hierarchy) {
      return res.status(400).json({ message: "Hierarchy not found", status: false });
    }

    const division = hierarchy.divisions.find((div) => div._id.toString() === divisionId);
    if (!division) return res.status(404).json({ status: false, message: "Division not found" });

    const department = division.departments.find((dep) => dep._id.toString() === departmentId);
    if (!department) return res.status(404).json({ status: false, message: "Department not found" });

    const group = department.groups.find((grp) => grp._id.toString() === groupId);
    if (!group) return res.status(404).json({ status: false, message: "Group not found" });

    // Check duplicate cell name
    const cellExists = group.cells.some(
      (cell) => cell.name.toLowerCase() === name.toLowerCase()
    );
    if (cellExists) {
      return res.status(400).json({ status: false, message: "Cell name already exists" });
    }

    // ✅ Push into group.cells (not department.groups.cells)
    group.cells.push({ name });

    // ✅ Save hierarchy
    await hierarchy.save();

    res.status(201).json({
      message: "Cell created successfully",
      success: true,
      data: hierarchy,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server Error",
      success: false,
      error: error.message,
    });
  }
};

// Update Cell
const updateCell = async (req, res) => {
  try {
    const { divisionId,departmentId,groupId,cellId } = req.params;
    const { name } = req.body;

    if (!name) return res.status(400).json({ message: "Cell name required", success: false });

    const updatedHierarchy = await HierarchyModel.findOneAndUpdate(
      { "divisions._id": divisionId },
      { $set: { "divisions.$[].departments.$[dept].groups.$[grp].cells.$[cell].name": name } },
      { new: true, arrayFilters: [{ "dept._id": departmentId },{ "grp._id": groupId },{ "cell._id": cellId }] }
    );

    if (!updatedHierarchy) return res.status(404).json({ message: "Cell not found", success: false });

    res.status(200).json({ message: "Cell updated successfully", success: true, data: updatedHierarchy });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", success: false, error: error.message });
  }
};

// Delete Cell
const deleteCell = async (req, res) => {
  try {
    const { cellId } = req.params;

    const updatedHierarchy = await HierarchyModel.findOneAndUpdate(
      {},
      { $pull: { "divisions.$[].departments.$[].groups.$[].cells": { _id: cellId } } },
      { new: true }
    );

    if (!updatedHierarchy) return res.status(404).json({ message: "Cell not found", success: false });

    res.status(200).json({ message: "Cell deleted successfully", success: true, data: updatedHierarchy });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", success: false, error: error.message });
  }
};

export {
    addHierarchy,
    getHierarchy,

    getAllDivisions,
    createDivision,
    deleteDivision,
    updateDivision,

    createDepartment,
    deleteDepartment,
    updateDepartment,

    createGroup,
    deleteGroup,
    updateGroup,

    createCell,
    deleteCell,
    updateCell,
};
