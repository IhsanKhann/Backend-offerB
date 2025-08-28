import mongoose from "mongoose";
import { HierarchyModel } from "../models/Hiearchy.model.js";

// ---------------------- Add Initial Hierarchy ----------------------
export const addHierarchy = async (req, res) => {
  try {
    const { offices } = req.body;
    if (!offices || offices.length === 0) {
      return res.status(400).json({ message: "At least one office is required", success: false });
    }

    const newHierarchy = new HierarchyModel({ offices });
    await newHierarchy.save();

    res.status(201).json({ message: "Hierarchy created successfully", success: true, data: newHierarchy });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", success: false, error: err.message });
  }
};

// ---------------------- Get Hierarchy ----------------------
export const getHierarchy = async (req, res) => {
  try {
    const hierarchy = await HierarchyModel.findOne();
    if (!hierarchy) return res.status(404).json({ message: "Hierarchy not found", success: false, data: {} });

    res.status(200).json({ message: "Hierarchy found", success: true, data: hierarchy });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", success: false, error: err.message });
  }
};

// ---------------------- Helper: Traverse Path ----------------------
const traversePathOrCreate = (root, path) => {
  let current = root;
  for (let node of path) {
    if (!node?.id) break; // stop at first missing ID
    if (!current[node.level]) current[node.level] = []; // create missing array
    let next = current[node.level].id(node.id);
    if (!next) break; // stop if node doesn't exist
    current = next;
  }
  return current;
};

const traversePathSafe = (root, path) => {
  let current = root;
  
  for (let node of path) {
    if (!node?.id) return null; // invalid path node
    
    // Check if current level exists and is an array
    if (!current[node.level] || !Array.isArray(current[node.level])) {
      return null;
    }
    
    // Find the node by ID
    const next = current[node.level].find(item => 
      item._id && item._id.toString() === node.id.toString()
    );
    
    if (!next) return null; // node not found
    current = next;
  }
  
  return current;
};

// ---------------------- Create Level ----------------------
export const createHierarchyLevel = async (req, res) => {
  try {
    const { level, name, path } = req.body;
    if (!level || !name) return res.status(400).json({ message: "Missing required data" });

    const hierarchy = await HierarchyModel.findOne();
    if (!hierarchy) return res.status(404).json({ message: "Hierarchy not found" });

    const parent = traversePathOrCreate(hierarchy, path || []);

    if (!parent[level]) parent[level] = [];
    parent[level].push({ name });

    await hierarchy.save(); // save the root document
    res.status(201).json({ message: `${level} created successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Create failed", error: err.message });
  }
};

export const editHierarchyLevel = async (req, res) => {
  try {
    const { level, name, path } = req.body;
    const { id } = req.params;
    
    if (!level || !name || !id) {
      return res.status(400).json({ message: "Missing required data" });
    }

    const hierarchy = await HierarchyModel.findOne();
    if (!hierarchy) return res.status(404).json({ message: "Hierarchy not found" });

    let parent = hierarchy;
    
    // If path is provided, traverse to the parent
    if (path && path.length > 0) {
      parent = traversePathSafe(hierarchy, path);
      if (!parent) return res.status(404).json({ message: "Parent not found" });
    }

    // For top-level items, look directly in the hierarchy
    if (!parent[level]) return res.status(404).json({ message: `${level} not found` });

    const target = parent[level].id(id);
    if (!target) return res.status(404).json({ message: `${level} not found` });

    target.name = name;
    await hierarchy.save();
    res.status(200).json({ message: `${level} updated successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Edit failed", error: err.message });
  }
};

// ---------------------- Delete Level ----------------------
export const deleteHierarchyLevel = async (req, res) => {
  try {
    const { level, path } = req.body;
    const { id } = req.params;
    
    if (!level || !id) {
      return res.status(400).json({ message: "Missing required data" });
    }

    const hierarchy = await HierarchyModel.findOne();
    if (!hierarchy) return res.status(404).json({ message: "Hierarchy not found" });

    let parent = hierarchy;
    
    // If path is provided, traverse to the parent
    if (path && path.length > 0) {
      parent = traversePathSafe(hierarchy, path);
      if (!parent) return res.status(404).json({ message: "Parent not found" });
    }

    if (!parent[level]) return res.status(404).json({ message: `${level} not found` });

    const target = parent[level].id(id);
    if (!target) return res.status(404).json({ message: `${level} not found` });

    target.remove();
    await hierarchy.save();
    res.status(200).json({ message: `${level} deleted successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed", error: err.message });
  }
};