import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import axios from "axios";

// Components
import Sidebar from "../components/Sidebar";
import SuspendModal from "../components/SuspendModal.jsx";
import BlockModal from "../components/BlockModal.jsx";
import TerminateModal from "../components/TerminateModal.jsx";

// Icons
import { UserPlus, ClipboardList, Shield, FileText, Home } from "lucide-react";

// ==========================
// Status Components
// ==========================
const EmployeeListByStatus = ({ status, employees, handleActions }) => {
  const filtered = employees.filter((emp) => emp.profileStatus?.decision === status);

  if (filtered.length === 0)
    return <p className="text-gray-500 text-center">No {status} employees found.</p>;

  return <div className="space-y-4">{filtered.map((emp) => handleActions(emp))}</div>;
};

const RestoredEmployees = ({ employees, handleActions }) => (
  <EmployeeListByStatus status="Restored" employees={employees} handleActions={handleActions} />
);

const TerminatedEmployees = ({ employees, handleActions }) => (
  <EmployeeListByStatus status="Terminated" employees={employees} handleActions={handleActions} />
);

const BlockedEmployees = ({ employees, handleActions }) => (
  <EmployeeListByStatus status="Blocked" employees={employees} handleActions={handleActions} />
);

const SuspendedEmployees = ({ employees, handleActions }) => (
  <EmployeeListByStatus status="Suspended" employees={employees} handleActions={handleActions} />
);

// ==========================
// AdminDashboard
// ==========================
const AdminDashboard = () => {
  const navigate = useNavigate();

  // ✅ Employees state
  const [finalizedEmployees, setFinalizedEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ✅ Dropdown (actions)
  const [openDropdown, setOpenDropdown] = useState(null);

  // ✅ Profile / Permissions views
  const [profileView, setProfileView] = useState(null);
  const [managePermissionsView, setManagePermissionsView] = useState(null);
  const [allPermissionsList, setAllPermissionsList] = useState([]);

  // ✅ Modals (suspend, block, terminate)
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [selectedBlockEmployee, setSelectedBlockEmployee] = useState(null);

  const [terminateModalOpen, setTerminateModalOpen] = useState(false);
  const [selectedTerminateEmployee, setSelectedTerminateEmployee] = useState(null);

  // ✅ Active Status Filter
  const [activeStatusView, setActiveStatusView] = useState(null); // null = all employees

  // ==========================
  // API Calls
  // ==========================
  const handleAllEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get("/finalizedEmployees/all");
      const employees = res.data.data || [];

      // Fetch permissions for each employee
      const employeesWithPermissions = await Promise.all(
        employees.map(async (emp) => {
          const perms = await fetchEmployeePermissions(emp._id);
          return { ...emp, permissions: perms };
        })
      );

      setFinalizedEmployees(employeesWithPermissions);
    } catch (error) {
      console.error("Failed to fetch finalized employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeePermissions = async (employeeId) => {
    try {
      const res = await axios.get(`/permissions/getPermissions/${employeeId}`);
      return res.data.success ? res.data.permissions || [] : [];
    } catch (err) {
      console.error("Error fetching permissions:", err);
      return [];
    }
  };

  const fetchEmployeesByNode = async (orgUnit, isLeaf) => {
    try {
      setLoading(true);
      const res = await api.get(`/orgUnits/getorgUnit/${orgUnit._id}`);
      if (res.data.success) {
        setFinalizedEmployees(res.data.employees || []);
      } else {
        setFinalizedEmployees([]);
      }
    } catch (err) {
      console.error("Error fetching employees for node:", err);
      setFinalizedEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  // ==========================
  // Employee Actions
  // ==========================
  const handleApprove = async (id) => {
    try {
      const res = await api.patch(`/finalizedEmployees/approve/${id}`);
      if (res.status === 200) {
        alert("Employee approved successfully!");
        setFinalizedEmployees((prev) => prev.filter((e) => e._id !== id));
      }
    } catch (error) {
      console.error(error);
      alert("Failed to approve employee.");
    }
  };

  const handleReject = async (id) => {
    try {
      const res = await api.delete(`/finalizedEmployees/reject/${id}`);
      if (res.status === 200) {
        alert("Employee rejected successfully!");
        setFinalizedEmployees((prev) => prev.filter((e) => e._id !== id));
      }
    } catch (error) {
      console.error(error);
      alert("Failed to reject employee.");
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await api.delete(`/finalizedEmployees/delete/${id}`);
      if (res.status === 200) {
        alert("Employee deleted successfully!");
        setFinalizedEmployees((prev) => prev.filter((e) => e._id !== id));
      }
    } catch (error) {
      console.error(error);
      alert("Failed to delete employee.");
    }
  };

  // ==========================
  // Modals Handlers
  // ==========================
  const handleSuspendClick = (employee) => {
    setSelectedEmployee(employee);
    setSuspendModalOpen(true);
  };

  const handleSuspendAction = async (employeeId, action, date) => {
    try {
      if (action === "suspend") {
        await api.post(`/finalizedEmployees/suspend/${employeeId}`, { endDate: date });
      } else if (action === "restore") {
        await api.post(`/finalizedEmployees/restore-suspension/${employeeId}`);
      }
      await handleAllEmployees(); 
      setSuspendModalOpen(false);
    } catch (err) {
      console.error("Error handling suspension:", err);
    }
  };

  const handleOpenTerminateModal = (employee) => {
    setSelectedTerminateEmployee(employee);
    setTerminateModalOpen(true);
  };

  const handleTerminateAction = async (employeeId, action, data) => {
    try {
      if (action === "terminate") {
        await api.post(`/finalizedEmployees/terminate/${employeeId}`, {
          terminationReason: data.reason,
          terminationStartDate: data.startDate,
          terminationEndDate: data.endDate,
        });
      } else if (action === "restore") {
        await api.patch(`/finalizedEmployees/restore-terminate/${employeeId}`);
      }
      await handleAllEmployees();
      setTerminateModalOpen(false);
      setSelectedTerminateEmployee(null);
    } catch (err) {
      console.error("Error handling termination:", err);
      alert("Failed to handle termination");
    }
  };

  const handleConfirmTerminate = async (employee) => {
    try {
      await api.post("/finalizedEmployees/terminate", {
        employeeId: employee._id,
        prevRole: employee.roleName,
      });
      setTerminateModalOpen(false);
    } catch (error) {
      console.error("Error terminating employee:", error);
    }
  };

  // ==========================
  // Permissions Management
  // ==========================
  const fetchAllPermissions = async () => {
    try {
      const res = await api.get("/permissions/AllPermissions");
      if (res.data.status) setAllPermissionsList(res.data.Permissions);
    } catch (err) {
      console.error("Error fetching all permissions", err);
    }
  };

  useEffect(() => {
    if (managePermissionsView) fetchAllPermissions();
  }, [managePermissionsView]);

  const handleAddPermission = async (employeeId, permissionName) => {
    try {
      await api.post(`/permissions/addEmployeePermission`, { employeeId, permissionName });
      const updatedPerms = await fetchEmployeePermissions(employeeId);

      setManagePermissionsView((prev) => ({ ...prev, permissions: updatedPerms }));
      setFinalizedEmployees((prev) =>
        prev.map((emp) => (emp._id === employeeId ? { ...emp, permissions: updatedPerms } : emp))
      );

      document.getElementById("addPermInput").value = "";
    } catch (err) {
      console.error(err);
      alert("Failed to add permission");
    }
  };

  const handleDeletePermission = async (employeeId, permissionName) => {
    try {
      await api.post(`/permissions/removeEmployeePermission`, { employeeId, permissionName });
      const updatedPerms = await fetchEmployeePermissions(employeeId);

      setManagePermissionsView((prev) => ({ ...prev, permissions: updatedPerms }));
      setFinalizedEmployees((prev) =>
        prev.map((emp) => (emp._id === employeeId ? { ...emp, permissions: updatedPerms } : emp))
      );

      document.getElementById("delPermInput").value = "";
    } catch (err) {
      console.error(err);
      alert("Failed to delete permission");
    }
  };

  const handleManagePermissions = async (employeeId) => {
    try {
      const res = await api.get(`/finalizedEmployees/getSingleFinalizedEmployee/${employeeId}`);
      if (!res.data) return alert("Failed to fetch employee details.");

      const employeeData = res.data.finalizedEmployee || res.data;
      const permissions = await fetchEmployeePermissions(employeeId);
      employeeData.permissions = permissions;

      setManagePermissionsView(employeeData);
    } catch (err) {
      console.error("Error opening manage permissions modal:", err);
      alert("Error fetching employee details.");
    }
  };

  // ==========================
  // Profile View
  // ==========================
  const handleProfileView = async (id) => {
    try {
      const res = await api.get(`/finalizedEmployees/getSingleFinalizedEmployee/${id}`);
      if (!res.data) return alert("Profile data could not be fetched.");

      const employeeData = res.data.finalizedEmployee || res.data;
      const permissions = await fetchEmployeePermissions(id);
      employeeData.permissions = permissions;

      setProfileView(employeeData);
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  };

  // ==========================
  // Lifecycle
  // ==========================
  useEffect(() => {
    handleAllEmployees();
  }, []);

  // ==========================
  // Render Helpers
  // ==========================
  const renderEmployeeCard = (emp) => (
    <div
      key={emp._id}
      className="bg-white shadow rounded-xl flex justify-between items-center p-4 hover:shadow-xl transition-all"
    >
      {/* Employee Info */}
      <div className="flex items-center space-x-4">
        {emp.avatar ? (
          <img
            src={emp.avatar.url || "https://via.placeholder.com/150"}
            alt="Avatar"
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center text-gray-500">
            N/A
          </div>
        )}
        <div>
          <p className="text-lg font-semibold text-gray-900">{emp.individualName}</p>
          <p className="text-sm text-gray-500">{emp.personalEmail || emp.officialEmail}</p>
          <p className="text-xs text-gray-400">ID: {emp.UserId}</p>
        </div>
      </div>

      {/* Actions Dropdown */}
      <div className="relative">
        <button
          onClick={() => setOpenDropdown(openDropdown === emp._id ? null : emp._id)}
          className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Actions &#9660;
        </button>

        {openDropdown === emp._id && (
          <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-50">
            <button onClick={() => handleApprove(emp._id)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-100">Approve</button>
            <button onClick={() => handleReject(emp._id)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-100">Reject</button>
            <button onClick={() => handleDelete(emp._id)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-100">Delete</button>
            <button onClick={() => setProfileView(emp)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-100">View Profile</button>
            <button onClick={() => handleManagePermissions(emp._id)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-100">Manage Permissions</button>
            <button onClick={() => handleSuspendClick(emp)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-100">{emp.profileStatus?.decision === "Suspended" ? "Restore" : "Suspend"}</button>
            <button onClick={() => { setSelectedBlockEmployee(emp); setIsBlockModalOpen(true); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-100">{emp.profileStatus?.decision === "Blocked" ? "Restore Block" : "Block"}</button>
            <button onClick={() => handleOpenTerminateModal(emp)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-100">{emp.profileStatus?.decision === "Terminated" ? "Restore Termination" : "Terminate"}</button>
          </div>
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeStatusView) {
      case "Restored":
        return <RestoredEmployees employees={finalizedEmployees} handleActions={renderEmployeeCard} />;
      case "Terminated":
        return <TerminatedEmployees employees={finalizedEmployees} handleActions={renderEmployeeCard} />;
      case "Blocked":
        return <BlockedEmployees employees={finalizedEmployees} handleActions={renderEmployeeCard} />;
      case "Suspended":
        return <SuspendedEmployees employees={finalizedEmployees} handleActions={renderEmployeeCard} />;
      default:
        return finalizedEmployees.length === 0 ? (
          <div className="text-gray-500 text-lg">No employees to show.</div>
        ) : (
          <div className="space-y-4">{finalizedEmployees.map((emp) => renderEmployeeCard(emp))}</div>
        );
    }
  };

  // ==========================
  // Nav Items for Sidebar
  // ==========================
  const navItems = [
    { name: "Home", action: () => setActiveStatusView(null), icon: <Home size={18} /> },
    { name: "Restored Employees", action: () => setActiveStatusView("Restored"), icon: <Shield size={18} /> },
    { name: "Terminated Employees", action: () => setActiveStatusView("Terminated"), icon: <Shield size={18} /> },
    { name: "Blocked Employees", action: () => setActiveStatusView("Blocked"), icon: <Shield size={18} /> },
    { name: "Suspended Employees", action: () => setActiveStatusView("Suspended"), icon: <Shield size={18} /> },
    { name: "Register Employee", path: "/register-employee", icon: <UserPlus size={18} /> },
    { name: "Assign Roles", path: "/assign-roles", icon: <ClipboardList size={18} /> },
    { name: "Permission Handler", path: "/Permission-handler", icon: <ClipboardList size={18} /> },
    { name : "Draft Dashboard" , path: "/DraftDashboard", icon: <ClipboardList size={18} /> }
  ];

  // ==========================
  // Render
  // ==========================
  return (
    <div className="flex bg-gray-100 min-h-screen">
      <Sidebar fetchEmployeesByNode={fetchEmployeesByNode} navItems={navItems} title="Admin Panel" />
      <main className="flex-1 p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Employees</h1>
        {loading ? (
          <div className="flex justify-center items-center min-h-[60vh]">
            <div className="text-xl font-medium text-gray-700">Loading finalized employees...</div>
          </div>
        ) : (
          renderContent()
        )}

        {/* Modals */}
        <SuspendModal
          isOpen={suspendModalOpen}
          onClose={() => setSuspendModalOpen(false)}
          employee={selectedEmployee}
          refreshEmployees={handleAllEmployees}
        />

        <BlockModal
          isOpen={isBlockModalOpen}
          onClose={() => setIsBlockModalOpen(false)}
          employee={selectedBlockEmployee}
          refreshEmployees={handleAllEmployees}
        />

        <TerminateModal
          isOpen={terminateModalOpen}
          onClose={() => setTerminateModalOpen(false)}
          onConfirm={handleConfirmTerminate}
          employee={selectedTerminateEmployee}
        />

        {/* Profile Modal */}
        {profileView && (
          <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50">
            {/* Profile content here (unchanged from your previous) */}
            <div className="bg-white p-6 rounded-xl max-w-lg w-full relative">
              <button
                onClick={() => setProfileView(null)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
              >
                X
              </button>
              <h2 className="text-xl font-bold mb-2">{profileView.individualName}</h2>
              <p>Email: {profileView.personalEmail || profileView.officialEmail}</p>
              <p>ID: {profileView.UserId}</p>
              <p>Status: {profileView.profileStatus?.decision || "Active"}</p>
              {/* Additional profile details */}
            </div>
          </div>
        )}

        {/* Permissions Management */}
        {managePermissionsView && (
          <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl max-w-lg w-full relative">
              <button
                onClick={() => setManagePermissionsView(null)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
              >
                X
              </button>
              <h2 className="text-xl font-bold mb-4">{managePermissionsView.individualName} - Permissions</h2>

              <div className="space-y-2">
                <div>
                  <input type="text" id="addPermInput" placeholder="Add Permission" className="border p-2 rounded mr-2" />
                  <button
                    onClick={() =>
                      handleAddPermission(managePermissionsView._id, document.getElementById("addPermInput").value)
                    }
                    className="bg-green-500 text-white px-4 py-2 rounded"
                  >
                    Add
                  </button>
                </div>
                <div>
                  <input type="text" id="delPermInput" placeholder="Delete Permission" className="border p-2 rounded mr-2" />
                  <button
                    onClick={() =>
                      handleDeletePermission(managePermissionsView._id, document.getElementById("delPermInput").value)
                    }
                    className="bg-red-500 text-white px-4 py-2 rounded"
                  >
                    Delete
                  </button>
                </div>
                <div>
                  <h3 className="font-semibold">Current Permissions:</h3>
                  <ul className="list-disc list-inside">
                    {managePermissionsView.permissions?.map((perm) => (
                      <li key={perm}>{perm}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
