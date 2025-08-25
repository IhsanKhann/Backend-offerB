// TreeNode.jsx
import { useState,useEffect } from "react";

export const TreeNode = ({ node, childrenNodes, onNodeSelect }) => {
  const [expanded, setExpanded] = useState(false);

  const handleClick = () => {
    // pass node upwards when clicked
    onNodeSelect(node, childrenNodes.length === 0);
    setExpanded(!expanded);
  };

  return (
    <div className="ml-4">
      {/* Node Label */}
      <div
        onClick={handleClick}
        className="cursor-pointer flex items-center space-x-2 hover:text-blue-600"
      >
        {childrenNodes.length > 0 && (
          <span className="text-xs">{expanded ? "▼" : "▶"}</span>
        )}
        <span>{node.name}</span>
      </div>

      {expanded && (
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
