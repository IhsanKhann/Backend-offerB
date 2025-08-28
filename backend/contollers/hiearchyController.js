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

// ---------------------- Helper: Find Node by ID ----------------------
const findNodeById = (root, id) => {
  if (!root || typeof root !== "object") return null;

  if (root._id && root._id.toString() === id.toString()) {
    return { node: root, parent: null, key: null, index: null };
  }

  const searchKeys = ["offices", "groups", "divisions", "departments", "branches", "cells", "desks"];
  for (const key of searchKeys) {
    if (Array.isArray(root[key])) {
      for (let i = 0; i < root[key].length; i++) {
        const item = root[key][i];

        if (item._id && item._id.toString() === id.toString()) {
          return { node: item, parent: root, key, index: i };
        }

        const result = findNodeById(item, id);
        if (result) return result;
      }
    }
  }

  return null;
};

// ---------------------- Create Level ----------------------
export const createHierarchyLevel = async (req, res) => {
  try {
    const { level, name, parentId } = req.body;
    if (!level || !name) {
      return res.status(400).json({ message: "Level and name are required", success: false });
    }

    const hierarchy = await HierarchyModel.findOne();
    if (!hierarchy) return res.status(404).json({ message: "Hierarchy not found", success: false });

    // Find parent
    let parent, parentKey;
    if (!parentId) {
      parent = hierarchy;
      parentKey = "offices";
    } else {
      const parentResult = findNodeById(hierarchy, parentId);
      if (!parentResult) return res.status(404).json({ message: "Parent not found", success: false });

      parent = parentResult.node;
      parentKey = level; // new child will be added under this key
    }

    // Ensure child array exists
    if (!Array.isArray(parent[parentKey])) parent[parentKey] = [];

    // Create new node
    const newNode = { _id: new mongoose.Types.ObjectId(), name };
    const childArrays = {
      offices: ["groups", "divisions", "departments", "branches", "cells", "desks"],
      groups: ["divisions", "departments", "cells", "desks"],
      divisions: ["departments", "cells", "desks"],
      departments: ["branches", "cells", "desks"],
      branches: ["departments", "cells", "desks"],
      cells: ["desks"],
      desks: []
    };

    if (childArrays[level]) {
      childArrays[level].forEach((key) => {
        newNode[key] = [];
      });
    }

    parent[parentKey].push(newNode);

    hierarchy.markModified(parentKey);
    await hierarchy.save();

    res.status(201).json({ message: `${level} created successfully`, success: true, nodeId: newNode._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Create failed", success: false, error: err.message });
  }
};

// ---------------------- Edit Level ----------------------
export const editHierarchyLevel = async (req, res) => {
  try {
    const { id } = req.params;
    const { updateData, path = [], level } = req.body;

    if (!updateData || !level) return res.status(400).json({ message: "Level and updateData required", success: false });

    const hierarchy = await HierarchyModel.findOne();
    if (!hierarchy) return res.status(404).json({ message: "Hierarchy not found", success: false });

    let targetNode;
    if (level === "offices") {
      targetNode = hierarchy.offices.id(id);
    } else {
      let parent = hierarchy;
      for (const step of path) {
        parent = parent[step.level]?.id(step.id);
        if (!parent) return res.status(404).json({ message: `${step.level} not found in path`, success: false });
      }
      targetNode = parent[level]?.id(id);
    }

    if (!targetNode) return res.status(404).json({ message: `${level} not found`, success: false });

    Object.keys(updateData).forEach((key) => {
      if (key !== "_id") targetNode[key] = updateData[key];
    });

    hierarchy.markModified(level);
    await hierarchy.save();

    res.status(200).json({ message: `${level} updated successfully`, success: true, data: targetNode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Edit failed", success: false, error: err.message });
  }
};

// ---------------------- Delete Level ----------------------
export const deleteHierarchyLevel = async (req, res) => {
  try {
    const { id } = req.params;

    const hierarchy = await HierarchyModel.findOne();
    if (!hierarchy) return res.status(404).json({ message: "Hierarchy not found", success: false });

    const result = findNodeById(hierarchy, id);
    if (!result) return res.status(404).json({ message: "Node not found", success: false });

    if (result.parent && result.key && result.index !== undefined) {
      result.parent[result.key].splice(result.index, 1);
      hierarchy.markModified(result.key);
    } else if (!result.parent) {
      return res.status(400).json({ message: "Cannot delete root hierarchy", success: false });
    } else {
      return res.status(400).json({ message: "Cannot delete this node", success: false });
    }

    await hierarchy.save();
    res.status(200).json({ message: "Node deleted successfully", success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed", success: false, error: err.message });
  }
};
