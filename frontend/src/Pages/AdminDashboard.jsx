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
import { UserPlus, ClipboardList, Shield, FileText, Home, ArrowRight } from "lucide-react";

// Loader Component
const Loader = () => (
  <div className="flex justify-center items-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
  </div>
);

// ==========================
// Status Components
// ==========================
const EmployeeListByStatus = ({ status, employees, handleActions }) => {
  const filtered = employees.filter((emp) => emp.profileStatus?.decision === status);
  if (filtered.length === 0) return <p className="text-gray-500 text-center">No {status} employees found.</p>;
  return <div className="space-y-4">{filtered.map((emp) => handleActions(emp))}</div>;
};

const ActiveEmployees = ({ employees, handleActions }) => (
  <EmployeeListByStatus status="Approved" employees={employees} handleActions={handleActions} />
);

const RejectedEmployees = ({ employees, handleActions }) => (
  <EmployeeListByStatus status="Rejected" employees={employees} handleActions={handleActions} />
);

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
// Profile View Component
// ==========================
const ProfileViewModal = ({ employee, onClose }) => {
  if (!employee) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* Outer card */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] relative flex flex-col">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl"
        >
          ✕
        </button>

        {/* Header */}
        <h2 className="text-3xl font-bold mb-4 text-center pt-6">
          {employee.individualName}'s Profile
        </h2>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Personal Details */}
            <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Personal Details</h3>
              <p><span className="font-medium">Name:</span> {employee.individualName}</p>
              <p><span className="font-medium">Father's Name:</span> {employee.fatherName}</p>
              <p><span className="font-medium">DOB:</span> {new Date(employee.dob).toLocaleDateString()}</p>
              <p><span className="font-medium">Qualification:</span> {employee.qualification}</p>
              <p><span className="font-medium">Government ID:</span> {employee.govtId}</p>
              <p><span className="font-medium">Passport No:</span> {employee.passportNo}</p>
              <p><span className="font-medium">Alien Registration No:</span> {employee.alienRegNo}</p>
            </div>

            {/* Contact Information */}
            <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Contact Information</h3>
              <p><span className="font-medium">Official Email:</span> {employee.officialEmail}</p>
              <p><span className="font-medium">Personal Email:</span> {employee.personalEmail}</p>
              <p><span className="font-medium">Previous Org Email:</span> {employee.previousOrgEmail}</p>
              <p><span className="font-medium">User ID:</span> {employee.UserId}</p>
              <p><span className="font-medium">Organization ID:</span> {employee.OrganizationId}</p>
            </div>

            {/* Address */}
            <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Address</h3>
              <p><span className="font-medium">House No:</span> {employee.address?.houseNo}</p>
              <p><span className="font-medium">Address Line:</span> {employee.address?.addressLine}</p>
              <p><span className="font-medium">Street No:</span> {employee.address?.streetNo}</p>
              <p><span className="font-medium">Road:</span> {employee.address?.road}</p>
              <p><span className="font-medium">City:</span> {employee.address?.city}</p>
              <p><span className="font-medium">State:</span> {employee.address?.state}</p>
              <p><span className="font-medium">Country:</span> {employee.address?.country}</p>
              <p><span className="font-medium">Contact No:</span> {employee.address?.contactNo}</p>
              <p><span className="font-medium">Email:</span> {employee.address?.email}</p>
            </div>

            {/* Employment Details */}
            <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Employment Details</h3>
              <p><span className="font-medium">Status:</span> {employee.employmentStatus}</p>
              <p><span className="font-medium">Joining Date:</span> {new Date(employee.tenure?.joining).toLocaleDateString()}</p>
              <p><span className="font-medium">Confirmation Date:</span> {employee.tenure?.confirmation ? new Date(employee.tenure.confirmation).toLocaleDateString() : 'N/A'}</p>
              <p><span className="font-medium">Profile Status:</span> {employee.profileStatus?.decision || 'Active'}</p>
            </div>

            {/* Salary Information */}
            <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Salary Information</h3>
              <p><span className="font-medium">Type:</span> {employee.salary?.type}</p>
              <p><span className="font-medium">Amount:</span> ${employee.salary?.amount}</p>
              <p><span className="font-medium">Start Date:</span> {new Date(employee.salary?.startDate).toLocaleDateString()}</p>
            </div>

            {/* Additional Information */}
            <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Additional Information</h3>
              <p><span className="font-medium">Employment History:</span> {employee.employmentHistory?.orgName}</p>
              <p><span className="font-medium">Designation:</span> {employee.employmentHistory?.designation}</p>
              <p><span className="font-medium">Terminal Benefits:</span> {employee.salary?.terminalBenefits?.join(', ') || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================
// Permissions Management Modal
// ==========================
const PermissionsModal = ({ employee, allPermissions, onClose, onAddPermission, onDeletePermission }) => {
  const navigate = useNavigate();
  const [newPermission, setNewPermission] = useState("");

  if (!employee) return null;

  // Helper function to extract permission name
  const getPermissionName = (permission) => {
    if (typeof permission === 'string') return permission;
    if (permission && typeof permission === 'object') {
      return permission.name || permission._id || JSON.stringify(permission);
    }
    return String(permission);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-lg">
          ✕
        </button>
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">{employee.individualName}</h2>
            <p className="text-gray-600">ID: {employee.UserId}</p>
          </div>
          <button
            onClick={() => navigate("/Permission-handler")}
            className="flex items-center bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Advanced Permission Handler
            <ArrowRight size={16} className="ml-2" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Block - Add/Remove Single Permission */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-blue-600">Single Permission Management</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Add Permission</label>
              <div className="flex">
                <input
                  type="text"
                  value={newPermission}
                  onChange={(e) => setNewPermission(e.target.value)}
                  className="flex-1 border p-2 rounded-l-md"
                  placeholder="Enter permission name"
                />
                <button
                  onClick={() => {
                    onAddPermission(employee._id, newPermission);
                    setNewPermission("");
                  }}
                  className="bg-green-500 text-white px-4 py-2 rounded-r-md hover:bg-green-600"
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remove Permission</label>
              <div className="flex">
                <input
                  type="text"
                  id="delPermInput"
                  className="flex-1 border p-2 rounded-l-md"
                  placeholder="Enter permission name"
                />
                <button
                  onClick={() => onDeletePermission(employee._id, document.getElementById("delPermInput").value)}
                  className="bg-red-500 text-white px-4 py-2 rounded-r-md hover:bg-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          {/* Right Block - All Available Permissions */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-blue-600">Available Permissions</h3>
            <div className="max-h-60 overflow-y-auto">
              <ul className="space-y-2">
                {allPermissions.map((perm) => (
                  <li key={getPermissionName(perm)} className="flex justify-between items-center p-2 bg-white rounded-md shadow-sm">
                    <span>{getPermissionName(perm)}</span>
                    <div className="space-x-2">
                      <button
                        onClick={() => onAddPermission(employee._id, getPermissionName(perm))}
                        className="text-green-500 hover:text-green-700 text-sm"
                      >
                        Assign
                      </button>
                      <button
                        onClick={() => onDeletePermission(employee._id, getPermissionName(perm))}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Current Permissions */}
        <div className="mt-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-blue-600">Current Permissions</h3>
          <div className="flex flex-wrap gap-2">
            {employee.permissions?.map((perm) => (
              <span key={getPermissionName(perm)} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                {getPermissionName(perm)}
              </span>
            ))}
            {(!employee.permissions || employee.permissions.length === 0) && (
              <p className="text-gray-500">No permissions assigned</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

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

  const fetchEmployeesByStatus = async (status) => {
    try {
      setLoading(true);
      // Simulate loading for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const res = await api.get(`/finalizedEmployees/status/${status}`);
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
      console.error(`Failed to fetch ${status} employees:`, error);
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
    if (res.data.status) {
      // Extract just the permission names if the response contains objects
      const permissions = res.data.Permissions.map(perm => 
        typeof perm === 'object' ? perm.name || perm._id : perm
      );
      setAllPermissionsList(permissions);
    }
  } catch (err) {
    console.error("Error fetching all permissions", err);
  }
};

  useEffect(() => {
    if (managePermissionsView) fetchAllPermissions();
  }, [managePermissionsView]);

  const handleAddPermission = async (employeeId, permissionName) => {
    try {
      await api.post(`/permissions/addEmployeePermission`, {
        employeeId,
        permissionName
      });
      const updatedPerms = await fetchEmployeePermissions(employeeId);
      setManagePermissionsView((prev) => ({ ...prev, permissions: updatedPerms }));
      setFinalizedEmployees((prev) =>
        prev.map((emp) => (emp._id === employeeId ? { ...emp, permissions: updatedPerms } : emp))
      );
    } catch (err) {
      console.error(err);
      alert("Failed to add permission");
    }
  };

  const handleDeletePermission = async (employeeId, permissionName) => {
    try {
      await api.post(`/permissions/removeEmployeePermission`, {
        employeeId,
        permissionName
      });
      const updatedPerms = await fetchEmployeePermissions(employeeId);
      setManagePermissionsView((prev) => ({ ...prev, permissions: updatedPerms }));
      setFinalizedEmployees((prev) =>
        prev.map((emp) => (emp._id === employeeId ? { ...emp, permissions: updatedPerms } : emp))
      );
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
    <div key={emp._id} className="bg-white shadow rounded-xl flex justify-between items-center p-4 hover:shadow-xl transition-all">
      {/* Employee Info */}
      <div className="flex items-center space-x-4">
        {emp.avatar ? (
          <img src={emp.avatar.url || "https://via.placeholder.com/150"} alt="Avatar" className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center text-gray-500">
            N/A
          </div>
        )}
        <div>
          <p className="text-lg font-semibold text-gray-900">{emp.individualName}</p>
          <p className="text-sm text-gray-500">{emp.personalEmail || emp.officialEmail}</p>
          <p className="text-xs text-gray-400">ID: {emp.UserId}</p>
          <p className="text-xs text-gray-400">Role: {emp.roleName}</p>
          <p className="text-xs text-gray-400">Status: {emp.profileStatus?.decision}</p>
          <p className="text-xs text-gray-400">Previous Status: {emp.previous_status || "N/A"} </p>
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
          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
            <button onClick={() => handleApprove(emp._id)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-100">Approve</button>
            <button onClick={() => handleReject(emp._id)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-100">Reject</button>
            <button onClick={() => handleDelete(emp._id)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-100">Delete</button>
            <button onClick={() => handleProfileView(emp._id)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-100">View Profile</button>
            <button onClick={() => handleManagePermissions(emp._id)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-100">Manage Permissions</button>
            <button onClick={() => handleSuspendClick(emp)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-100">
              {emp.profileStatus?.decision === "Suspended" ? "Restore" : "Suspend"}
            </button>
            <button
              onClick={() => {
                setSelectedBlockEmployee(emp);
                setIsBlockModalOpen(true);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-100"
            >
              {emp.profileStatus?.decision === "Blocked" ? "Restore Block" : "Block"}
            </button>
            <button onClick={() => handleOpenTerminateModal(emp)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-100">
              {emp.profileStatus?.decision === "Terminated" ? "Restore Termination" : "Terminate"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    if (loading) return <Loader />;

    switch (activeStatusView) {
      case "Approved":
        return <ActiveEmployees employees={finalizedEmployees} handleActions={renderEmployeeCard} />;
      case "Rejected":
        return <RejectedEmployees employees={finalizedEmployees} handleActions={renderEmployeeCard} />;
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
    { 
     name: "Home",
     path: "/",
     icon: <Home size={18} />
    },
    {
      name: "Approved Employees",
      action: () => {
        setActiveStatusView("Approved");
        fetchEmployeesByStatus("Approved");
      },
      icon: <Shield size={18} /> 
    },
    {
      name: "Rejected Employees",
      action: () => {
        setActiveStatusView("Rejected");
        fetchEmployeesByStatus("Rejected");
      },
      icon: <Shield size={18} /> 
    },
    { 
      name: "Restored Employees", 
      action: () => {
        setActiveStatusView("Restored");
        fetchEmployeesByStatus("Restored");
      }, 
      icon: <Shield size={18} /> 
    },
    { 
      name: "Terminated Employees", 
      action: () => {
        setActiveStatusView("Terminated");
        fetchEmployeesByStatus("Terminated");
      }, 
      icon: <Shield size={18} /> 
    },
    { 
      name: "Blocked Employees", 
      action: () => {
        setActiveStatusView("Blocked");
        fetchEmployeesByStatus("Blocked");
      }, 
      icon: <Shield size={18} /> 
    },
    { 
      name: "Suspended Employees", 
      action: () => {
        setActiveStatusView("Suspended");
        fetchEmployeesByStatus("Suspended");
      }, 
      icon: <Shield size={18} /> 
    },
    { name: "Register Employee", path: "/register-employee", icon: <UserPlus size={18} /> },
    { name: "Assign Roles", path: "/assign-roles", icon: <ClipboardList size={18} /> },
    { name: "Permission Handler", path: "/Permission-handler", icon: <ClipboardList size={18} /> },
    { name: "Draft Dashboard", path: "/DraftDashboard", icon: <ClipboardList size={18} /> }
  ];

  // ==========================
  // Render
  // ==========================
 return (
  <div className="flex bg-gray-100 min-h-screen">
    {/* Sidebar should be sticky */}
    <div className="sticky top-0 h-screen">
      <Sidebar
        fetchEmployeesByNode={fetchEmployeesByNode}
        navItems={navItems}
        title="Admin Panel"
      />
    </div>

    {/* Main content */}
    <main className="flex-1 p-6 overflow-y-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Employees</h1>

      {renderContent()}

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
        <ProfileViewModal
          employee={profileView}
          onClose={() => setProfileView(null)}
        />
      )}

      {/* Permissions Management Modal */}
      {managePermissionsView && (
        <PermissionsModal
          employee={managePermissionsView}
          allPermissions={allPermissionsList}
          onClose={() => setManagePermissionsView(null)}
          onAddPermission={handleAddPermission}
          onDeletePermission={handleDeletePermission}
        />
      )}
    </main>
  </div>
);
}

export default AdminDashboard;