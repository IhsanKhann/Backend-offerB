import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { GitBranch, Menu, X } from "lucide-react";
import { HierarchyTree } from "../components/HieararchyTree.jsx";

const Sidebar = ({ fetchEmployeesByNode, navItems: customNavItems, title = "Admin Panel" }) => {
  const [open, setOpen] = useState(true); // Desktop toggle
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false); // Mobile toggle
  const [showTree, setShowTree] = useState(true); // Org hierarchy toggle
  const location = useLocation();

  const navItems = customNavItems || [];

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-gray-900 text-white rounded"
        onClick={() => setSidebarOpenMobile(true)}
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {sidebarOpenMobile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-40 md:hidden"
          onClick={() => setSidebarOpenMobile(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          bg-gray-900 text-gray-100 h-screen flex flex-col transition-all duration-300
          fixed md:relative z-50
          ${open ? "w-72" : "w-20"} 
          ${sidebarOpenMobile ? "translate-x-0" : "-translate-x-full"} 
          md:translate-x-0
        `}
      >
        {/* Top section */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
          <span className={`${open ? "block" : "hidden"} font-bold text-lg`}>{title}</span>

          {/* Desktop toggle */}
          <button
            onClick={() => setOpen(!open)}
            className="text-gray-300 md:block hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Mobile close */}
          <button
            onClick={() => setSidebarOpenMobile(false)}
            className="text-gray-300 md:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 mt-4 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={`
                flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md mx-2 mb-2 transition-colors
                ${location.pathname === item.path ? "bg-blue-600 text-white" : "hover:bg-gray-700"}
              `}
            >
              {item.icon && item.icon}
              <span className={`${open ? "block" : "hidden"} truncate`}>{item.name}</span>
            </Link>
          ))}
        </nav>

        {/* Org Hierarchy Tree */}
        {title === "Admin Panel" && (
          <div className="border-t border-gray-700">
            <button
              onClick={() => setShowTree(!showTree)}
              className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-gray-800"
            >
              <div className="flex items-center gap-2">
                <GitBranch size={18} />
                <span className={`${open ? "block" : "hidden"}`}>Org Hierarchy</span>
              </div>
              {open && <span>{showTree ? "−" : "+"}</span>}
            </button>

            <div
              className={`
                transition-all duration-300 ease-in-out overflow-hidden
                ${showTree && open ? "max-h-64" : "max-h-0"}
              `}
            >
              <div className="px-4 pb-4 overflow-y-auto max-h-64 custom-scrollbar">
                <HierarchyTree onNodeSelect={fetchEmployeesByNode} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;
