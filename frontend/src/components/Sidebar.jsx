import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, ChevronLeft, Building2, Users, Info, Menu } from 'lucide-react';

// Compact Tree Node for AdminDashboard
const CompactTreeNode = ({ node, level = 0, onNodeSelect, selectedId, isCollapsed }) => {
  const [expanded, setExpanded] = useState(level < 1);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node._id;

  const getDeptColor = (dept) => {
    const colors = {
      Finance: 'text-blue-600', 
      HR: 'text-green-600',
      BusinessOperation: 'text-purple-600', 
      IT: 'text-indigo-600',
      Compliance: 'text-orange-600', 
      All: 'text-gray-600'
    };
    return colors[dept] || 'text-gray-600';
  };

  if (isCollapsed) return null;

  return (
    <div>
      <div
        className={`flex items-center py-1.5 px-2 rounded cursor-pointer transition-all ${
          isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-50'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onNodeSelect(node, !hasChildren)}
      >
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            if (hasChildren) setExpanded(!expanded); 
          }} 
          className="w-4 h-4 flex items-center justify-center mr-1.5"
        >
          {hasChildren ? (
            expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : (
            <span className="w-2" />
          )}
        </button>
        <span className={`mr-1.5 ${getDeptColor(node.departmentCode)}`}>
          {hasChildren ? <Building2 size={12} /> : <Users size={12} />}
        </span>
        <span className={`flex-1 text-xs truncate ${isSelected ? 'font-semibold' : ''}`}>
          {node.name}
        </span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <CompactTreeNode 
              key={child._id} 
              node={child} 
              level={level + 1} 
              onNodeSelect={onNodeSelect} 
              selectedId={selectedId}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Mini Hierarchy Tree for Sidebar (AdminDashboard only)
const MiniHierarchyTree = ({ onNodeSelect, isCollapsed }) => {
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => { 
    if (!isCollapsed) {
      fetchTree(); 
    }
  }, [isCollapsed]);

  const fetchTree = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/org-units', { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const data = await res.json();
      setTreeData(Array.isArray(data) ? data : data.data || [data]);
    } catch (err) { 
      console.error('Failed to load tree:', err); 
    } finally { 
      setLoading(false); 
    }
  };

  if (isCollapsed) return null;

  return (
    <div className="border-b border-gray-200 bg-white">
      <button 
        onClick={() => setIsExpanded(!isExpanded)} 
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Building2 size={14} /> Organization
        </span>
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {isExpanded && (
        <div className="max-h-64 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mx-auto" />
          ) : (
            treeData.map((node) => (
              <CompactTreeNode 
                key={node._id} 
                node={node} 
                onNodeSelect={(n, leaf) => { 
                  setSelectedNodeId(n._id); 
                  onNodeSelect(n, leaf); 
                }} 
                selectedId={selectedNodeId}
                isCollapsed={isCollapsed}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

// Tooltip component for collapsed state
const Tooltip = ({ text, children }) => {
  const [show, setShow] = useState(false);

  return (
    <div 
      className="relative flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute left-full ml-2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md whitespace-nowrap z-50 shadow-lg">
          {text}
          <div className="absolute top-1/2 -left-1 transform -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
        </div>
      )}
    </div>
  );
};

// Main Sidebar Component
const Sidebar = ({ fetchEmployeesByNode, navItems = [], title }) => {
  const [activeItem, setActiveItem] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleNavigation = (item) => {
    setActiveItem(item.name);
    if (item.path) {
      window.location.href = item.path;
    } else if (item.action) {
      item.action();
    }
  };

  return (
    <div 
      className={`bg-white shadow-lg h-screen flex flex-col overflow-hidden border-r border-gray-200 transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Dynamic Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-slate-800 to-slate-900 flex items-center justify-between">
        {!isCollapsed && (
          <h2 className="text-lg font-bold text-white truncate">{title}</h2>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-white hover:bg-slate-700 p-1.5 rounded transition-colors"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Conditional Hierarchy Tree: ONLY for AdminDashboard */}
        {title === "AdminDashboard" && (
          <MiniHierarchyTree 
            onNodeSelect={fetchEmployeesByNode} 
            isCollapsed={isCollapsed}
          />
        )}

        {/* Conditional Permissions Status: ONLY for PermissionsManager */}
        {title === "PermissionsManager" && !isCollapsed && (
          <div className="p-4 bg-amber-50 border-b border-amber-100">
            <div className="flex items-center gap-2 text-amber-800 mb-1">
              <Info size={14} />
              <span className="text-xs font-bold uppercase tracking-wider">System Status</span>
            </div>
            <p className="text-[10px] text-amber-700 leading-tight">
              Permission sync is currently active. Changes may take up to 5 minutes to propagate.
            </p>
          </div>
        )}

        {/* Permissions Status - Collapsed State */}
        {title === "PermissionsManager" && isCollapsed && (
          <Tooltip text="Permission Sync Active">
            <div className="p-4 bg-amber-50 border-b border-amber-100 flex justify-center">
              <Info size={16} className="text-amber-800" />
            </div>
          </Tooltip>
        )}

        {/* Navigation Items */}
        <div className="py-2">
          {!isCollapsed && (
            <div className="px-4 py-2">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Menu
              </h3>
            </div>
          )}

          {navItems.map((item) => {
            const NavButton = (
              <button
                key={item.name}
                onClick={() => handleNavigation(item)}
                className={`w-full px-4 py-2.5 flex items-center transition-all ${
                  isCollapsed ? 'justify-center' : 'gap-3'
                } ${
                  activeItem === item.name
                    ? 'bg-blue-50 border-r-4 border-blue-500 text-blue-700'
                    : 'hover:bg-gray-50 text-gray-600 border-r-4 border-transparent'
                }`}
              >
                <span className={activeItem === item.name ? 'text-blue-600' : 'text-gray-400'}>
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <span className="text-sm font-medium">{item.name}</span>
                )}
              </button>
            );

            if (isCollapsed) {
              return (
                <Tooltip key={item.name} text={item.name}>
                  {NavButton}
                </Tooltip>
              );
            }

            return NavButton;
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        {!isCollapsed ? (
          <p className="text-[10px] text-gray-400 text-center font-medium uppercase">
            Enterprise Suite v2.0
          </p>
        ) : (
          <Tooltip text="Enterprise Suite v2.0">
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            </div>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export default Sidebar;