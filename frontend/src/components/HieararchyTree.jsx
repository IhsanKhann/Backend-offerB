// HierarchyTree.jsx
import { TreeNode } from "./TreeNode";
import { useState,useEffect } from "react";
import api from "../api/axios.js";

export const HierarchyTree = ({ onNodeSelect }) => {
  const [treeData, setTreeData] = useState([]);

  useEffect(() => {
    const fetchTree = async () => {
      try {
        const res = await api.get("/getOrgUnits");
        setTreeData(res.data);
      } catch (err) {
        console.error("Failed to fetch hierarchy:", err);
      }
    };
    fetchTree();
  }, []);

  return (
    <div>
      <h3 className="text-lg font-bold mb-2">Org Hierarchy</h3>
      {treeData.length === 0 ? (
        <p className="text-sm text-gray-500">No hierarchy available</p>
      ) : (
        treeData.map((node) => (
          <TreeNode
            key={node._id}
            node={node}
            childrenNodes={node.children || []}
            onNodeSelect={onNodeSelect}
          />
        ))
      )}
    </div>
  );
};
