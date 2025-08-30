import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  UserPlus,
  FileText,
  ClipboardList,
  Shield,
  Menu,
  X,
  GitBranch,
} from "lucide-react";
import { HierarchyTree } from "../components/HieararchyTree.jsx"; // adjust path if needed

const navItems = [
  { name: "Home", path: "/", icon: <Home size={18} /> },
  { name: "Assign Roles", path: "/assign-roles", icon: <ClipboardList size={18} /> },
  { name: "Draft Dashboard", path: "/DraftDashboard", icon: <FileText size={18} /> },
  { name: "Permissions Manager", path: "/Permission-handler", icon: <Shield size={18} /> },
  { name: "Register Employee", path: "/register-employee", icon: <UserPlus size={18} /> },
];

const Sidebar = ({ fetchEmployeesByNode }) => {
  const [open, setOpen] = useState(true);
  const [showTree, setShowTree] = useState(true);
  const location = useLocation();

  return (
    <div
      className={`${
        open ? "w-72" : "w-20"
      } bg-gray-900 text-gray-100 h-screen flex flex-col transition-all duration-300`}
    >
      {/* Top Section */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
        <span className={`${open ? "block" : "hidden"} font-bold text-lg`}>
          Admin Panel
        </span>
        <button onClick={() => setOpen(!open)} className="text-gray-300">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 mt-4">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md mx-2 mb-2 transition-colors ${
              location.pathname === item.path
                ? "bg-blue-600 text-white"
                : "hover:bg-gray-700"
            }`}
          >
            {item.icon}
            <span className={`${open ? "block" : "hidden"} truncate`}>
              {item.name}
            </span>
          </Link>
        ))}
      </nav>

      {/* Org Hierarchy Tree Section */}
      <div className="border-t border-gray-700">
        <button
          onClick={() => setShowTree(!showTree)}
          className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-gray-800"
        >
          <div className="flex items-center gap-2">
            <GitBranch size={18} />
            <span className={`${open ? "block" : "hidden"}`}>
              Org Hierarchy
            </span>
          </div>
          {open && <span>{showTree ? "−" : "+"}</span>}
        </button>

        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            showTree && open ? "max-h-64" : "max-h-0"
          }`}
        >
          <div className="px-4 pb-4 overflow-y-auto max-h-64 custom-scrollbar">
            <HierarchyTree onNodeSelect={fetchEmployeesByNode} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
