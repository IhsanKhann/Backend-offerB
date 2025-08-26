import { useState } from "react";

export const TreeNode = ({ node, childrenNodes = [], onNodeSelect }) => {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (childrenNodes.length > 0) {
      setExpanded(!expanded);
    }
  };

  const handleNodeClick = (e) => {
    e.stopPropagation();
    // Always call onNodeSelect — leaf or not
    onNodeSelect(node, childrenNodes.length === 0);
  };

  return (
    <div className="ml-2">
      {/* Node Label */}
      <div className="flex items-center space-x-1 py-1">
        {childrenNodes.length > 0 ? (
          <span
            className="text-xs cursor-pointer hover:text-blue-600 w-4"
            onClick={handleToggle}
          >
            {expanded ? "▼" : "▶"}
          </span>
        ) : (
          <span className="w-4"></span>
        )}

        <span
          onClick={handleNodeClick}
          className="cursor-pointer hover:text-blue-600 hover:bg-gray-100 px-2 py-1 rounded flex-1"
        >
          {node?.name || "Unnamed Node"}
        </span>
      </div>

      {/* Children */}
      {expanded && childrenNodes.length > 0 && (
        <div className="ml-4 border-l border-gray-300 pl-2">
          {childrenNodes.map((child) => (
            <TreeNode
              key={typeof child === "string" ? child : child._id} 
              node={typeof child === "string" ? { _id: child, name: "Loading..." } : child}
              childrenNodes={typeof child === "string" ? [] : child.children || []}
              onNodeSelect={onNodeSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};
