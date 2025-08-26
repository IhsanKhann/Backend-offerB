// TreeNode.jsx
import { useState } from "react";

export const TreeNode = ({ node, childrenNodes, onNodeSelect }) => {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (childrenNodes.length > 0) {
      setExpanded(!expanded);
    }
  };

  const handleNodeClick = (e) => {
    e.stopPropagation();
    // Always call onNodeSelect when clicking on the node name
    onNodeSelect(node, childrenNodes.length === 0);
  };

  return (
    <div className="ml-2">
      {/* Node Label */}
      <div className="flex items-center space-x-1 py-1">
        {childrenNodes.length > 0 && (
          <span 
            className="text-xs cursor-pointer hover:text-blue-600 w-4"
            onClick={handleToggle}
          >
            {expanded ? "▼" : "▶"}
          </span>
        )}
        {childrenNodes.length === 0 && (
          <span className="w-4"></span>
        )}
        <span 
          onClick={handleNodeClick}
          className="cursor-pointer hover:text-blue-600 hover:bg-gray-100 px-2 py-1 rounded flex-1"
        >
          {node.name}
        </span>
      </div>

      {expanded && childrenNodes.length > 0 && (
        <div className="ml-4 border-l border-gray-300 pl-2">
          {childrenNodes.map((child) => (
            <TreeNode
              key={child._id}
              node={child}
              childrenNodes={child.children || []}
              onNodeSelect={onNodeSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};
