import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Building2, Users } from "lucide-react";

/* =======================
   Tree Node (Recursive)
======================= */
const TreeNode = ({ node, onNodeSelect, level = 0 }) => {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  const toggle = (e) => {
    e.stopPropagation();
    if (hasChildren) setExpanded((prev) => !prev);
  };

  const handleSelect = (e) => {
    e.stopPropagation();
    onNodeSelect?.(node, !hasChildren);
  };

  const levelColors = [
    "text-blue-600",
    "text-green-600",
    "text-purple-600",
    "text-orange-600",
    "text-red-600",
    "text-pink-600",
    "text-indigo-600",
  ];

  const color = levelColors[level] || "text-gray-600";

  return (
    <div className="select-none">
      <div
        className="flex items-center py-1 px-2 hover:bg-gray-100 rounded cursor-pointer"
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={handleSelect}
      >
        <button
          onClick={toggle}
          className="w-5 h-5 flex items-center justify-center mr-1"
        >
          {hasChildren ? (
            expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <span className="w-3" />
          )}
        </button>

        <div className="mr-2">
          {hasChildren ? (
            <Building2 size={14} className={color} />
          ) : (
            <Users size={14} className={color} />
          )}
        </div>

        <span className={`flex-1 text-sm ${color}`}>
          {node.name}
          <span className="ml-2 text-xs text-gray-400">
            ({node.code || "N/A"})
          </span>
        </span>

        {node.employeeCount > 0 && (
          <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
            {node.employeeCount}
          </span>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child._id}
              node={child}
              onNodeSelect={onNodeSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* =======================
   Hierarchy Tree
======================= */
const HierarchyTree = ({ onNodeSelect }) => {
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTree();
  }, []);

  const fetchTree = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("accessToken");
      if (!token) throw new Error("Authentication required");

      const res = await fetch("/api/org-units", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load hierarchy (${res.status})`);
      }

      const data = await res.json();

      // Normalize API response
      let normalized = [];
      if (Array.isArray(data)) normalized = data;
      else if (Array.isArray(data.data)) normalized = data.data;
      else if (Array.isArray(data.orgUnits)) normalized = data.orgUnits;
      else if (data && typeof data === "object") normalized = [data];

      setTreeData(normalized);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* =======================
     UI States
  ======================= */
  if (loading) {
    return (
      <div className="p-4 flex justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-xs text-red-600">
        {error}
        <button
          onClick={fetchTree}
          className="block mt-2 text-blue-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!treeData.length) {
    return (
      <div className="p-4 text-xs text-gray-600">
        No organizational units found
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">
        Org Hierarchy ({treeData.length})
      </h3>

      <div className="border rounded bg-white max-h-96 overflow-y-auto">
        {treeData.map((node) => (
          <TreeNode
            key={node._id}
            node={node}
            onNodeSelect={onNodeSelect}
            level={0}
          />
        ))}
      </div>
    </div>
  );
};

export default HierarchyTree;
export { HierarchyTree };
