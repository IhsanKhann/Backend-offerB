import React, { useEffect, useState } from "react"; 
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import Sidebar from "../components/Sidebar";
import SuspendModal from "../components/SuspendModal.jsx";
import BlockModal from "../components/BlockModal.jsx";
import TerminateModal from "../components/TerminateModal.jsx";
import { UserPlus, ClipboardList, Shield, FileText, Home } from "lucide-react";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [finalizedEmployees, setFinalizedEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [profileView, setProfileView] = useState(null);
  const [managePermissionsView, setManagePermissionsView] = useState(null);
  const [allPermissionsList, setAllPermissionsList] = useState([]);
  
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [selectedBlockEmployee, setSelectedBlockEmployee] = useState(null);
  
  const [terminateModalOpen, setTerminateModalOpen] = useState(false);
  const [selectedTerminateEmployee, setSelectedTerminateEmployee] = useState(null);

  const [statusFilter, setStatusFilter] = useState("All"); 
  const [open, setOpen] = useState(true);

  // Fetch permissions for a given employee
  const fetchEmployeePermissions = async (employeeId) => {
    try {
      const res = await api.get(`/permissions/getPermissions/${employeeId}`);
      return res.data.permissions || [];
    } catch (err) {
      console.error("Error fetching permissions:", err);
      return [];
    }
  };

  // Fetch all employees with permissions
  const fetchEmployees = async (status = "All") => {
    try {
      setLoading(true);
      const url =
        status === "All"
          ? "/finalizedEmployees/all"
          : `/finalizedEmployees/employees-by-status?status=${status}`;
      const res = await api.get(url);
      const employees = res.data.employees || res.data.data || [];

      const employeesWithPermissions = await Promise.all(
        employees.map(async (emp) => {
          const perms = await fetchEmployeePermissions(emp._id);
          return { ...emp, permissions: perms };
        })
      );

      setFinalizedEmployees(employeesWithPermissions);
    } catch (err) {
      console.error("Error fetching employees:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleFilterChange = (e) => {
    const status = e.target.value;
    setStatusFilter(status);
    fetchEmployees(status);
  };

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
      fetchEmployees();
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
      fetchEmployees();
      setTerminateModalOpen(false);
      setSelectedTerminateEmployee(null);
    } catch (err) {
      console.error("Error handling termination:", err);
      alert("Failed to handle termination");
    }
  };
  
  const handleDelete = async (employeeId) => {
  if (!window.confirm("Are you sure you want to delete this employee?")) return;
  try {
    await api.delete(`/finalizedEmployees/${employeeId}`);
    fetchEmployees();
  } catch (err) {
    console.error("Error deleting employee:", err);
    alert("Failed to delete employee");
  }
};

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
    if (!permissionName) return;
    try {
      await api.post("/permissions/addEmployeePermission", { employeeId, permissionName });
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
    if (!permissionName) return;
    try {
      await api.post("/permissions/removeEmployeePermission", { employeeId, permissionName });
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
      setManagePermissionsView({ ...employeeData, permissions });
    } catch (err) {
      console.error("Error opening manage permissions modal:", err);
      alert("Error fetching employee details.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="text-xl font-medium text-gray-700">
          Loading finalized employees...
        </div>
      </div>
    );
  }

  const navItems = [
    { name: "Home", path: "/", icon: <Home size={18} /> },
    { name: "PermissionHandler", path: "/Permission-handler", icon: <Shield size={18} /> },
    { name: "Draft Dashboard", path: "/Draftdashboard", icon: <FileText size={18} /> },
    { name: "Register Employee", path: "/register-employee", icon: <UserPlus size={18} /> },
    { name: "Assign Roles", path: "/assign-roles", icon: <ClipboardList size={18} /> },
  ];

  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="bg-gray-900 text-gray-100 h-screen sticky top-0 flex flex-col">
        <Sidebar fetchEmployeesByNode={() => {}} title="Admin Panel" navItems={navItems} />
      </div>

      <main className={`flex-1 p-6 transition-all duration-300`} style={{ marginLeft: open ? "18rem" : "5rem" }}>
        {/* Header + Filter */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Employees</h1>
          <select
            value={statusFilter}
            onChange={handleFilterChange}
            className="border rounded px-3 py-2"
          >
            {["All", "Approved", "Pending", "Suspended", "Blocked", "Terminated"].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {finalizedEmployees.length === 0 ? (
          <div className="text-gray-500 text-lg">No employees to show.</div>
        ) : (
          <div className="space-y-4">
            {finalizedEmployees.map((emp) => (
              <div key={emp._id} className="bg-white shadow rounded-xl flex justify-between items-center p-4 hover:shadow-xl transition-all">
                <div className="flex items-center space-x-4">
                  {emp.avatar ? (
                    <img src={emp.avatar.url || "https://via.placeholder.com/150"} alt="Avatar" className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center text-gray-500">N/A</div>
                  )}
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{emp.individualName}</p>
                    <p className="text-sm text-gray-500">{emp.personalEmail || emp.officialEmail}</p>
                    <p className="text-sm text-gray-500">UserID: {emp.UserId}</p>
                    <p className="text-sm font-semibold text-gray-900">Status: {emp.profileStatus?.decision}</p>
                  </div>
                </div>
                
                <div className="relative">
                  <button
                    onClick={() => setOpenDropdown(openDropdown === emp._id ? null : emp._id)}
                    className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Actions &#9660;
                  </button>

                  {openDropdown === emp._id && (
                    <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                      <button
                        onClick={() => alert("Approve action not implemented")}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-100"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => alert("Reject action not implemented")}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-100"
                      >
                        Reject
                      </button>
                      <button onClick={() => handleDelete(emp._id)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-100">
                        Delete
                      </button>
                      <button onClick={() => setProfileView(emp)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-100">
                        View Profile
                      </button>
                      <button onClick={() => handleManagePermissions(emp._id)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-100">
                        Manage Permissions
                      </button>
                      <button onClick={() => handleSuspendClick(emp)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-100">
                        {emp.profileStatus?.decision === "Suspended" ? "Restore" : "Suspend"}
                      </button>
                      <button
                        onClick={() => { setSelectedBlockEmployee(emp); setIsBlockModalOpen(true); }}
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
            ))}
          </div>
        )}
      </main>


      {/* ✅ Suspend Modal */}
        <SuspendModal
            isOpen={suspendModalOpen}
            onClose={() => setSuspendModalOpen(false)}
            employee={selectedEmployee}
            refreshEmployees={fetchEmployees}
        />

        <BlockModal
          isOpen={isBlockModalOpen}
          onClose={() => setIsBlockModalOpen(false)}
          employee={selectedBlockEmployee}
          refreshEmployees={fetchEmployees}
      />

         {/* Terminate Modal */}
          <TerminateModal
        isOpen={terminateModalOpen}
        onClose={() => setTerminateModalOpen(false)}
        employee={selectedTerminateEmployee}
        onConfirm={(action, data) =>
          handleTerminateAction(selectedTerminateEmployee._id, action, data)
        }
      />

      {/* Profile Modal */}
      {profileView && (
        <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-3/4 max-h-[90vh] overflow-y-auto relative p-6">
            {/* Close button */}
            <button
              onClick={() => setProfileView(null)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
            >
              ✖
            </button>

            {/* Profile Header */}
            <div className="flex items-center space-x-4 border-b pb-4 mb-4">
              {profileView.avatar ? (
                <img
                  src={profileView.avatar.url}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center text-gray-500">
                  N/A
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {profileView.individualName}
                </h2>
               {/* Profile modal role */}
             <p className="ml-12 text-xs text-gray-600">
                Role: {profileView.role?.roleName || "N/A"}
              </p>
              <p className="text-gray-500">{profileView.officialEmail}</p>
              </div>
            </div>

            {/* Profile Details */}
            <div className="grid grid-cols-2 gap-6 text-sm text-gray-700">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Personal Details
                </h3>
                <p>UserID: {profileView.UserId}</p>
                <p>Database ID: {profileView._id} </p>
                <p>Organization Id: {profileView.OrganizationId} </p>
                <p>Father Name: {profileView.fatherName}</p>
                <p>DOB: {new Date(profileView.dob).toLocaleDateString()}</p>
                <p>Govt ID: {profileView.govtId || "N/A"}</p>
                <p>Passport No: {profileView.passportNo || "N/A"}</p>
                <p>Personal Email: {profileView.personalEmail}</p>
                <p>
                  Password:{" "}
                  {profileView.password || "Profile not approved yet."}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Address</h3>
                <p>
                  {profileView.address?.houseNo},{" "}
                  {profileView.address?.addressLine}
                </p>
                <p>
                  {profileView.address?.city}, {profileView.address?.state}{" "}
                  {profileView.address?.country}
                </p>
                <p>Contact: {profileView.address?.contactNo}</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Employment</h3>
                <p>Status: {profileView.employmentStatus}</p>
                <p>
                  Joining:{" "}
                  {new Date(profileView.tenure?.joining).toLocaleDateString()}
                </p>
                <p>
                  Confirmation:{" "}
                  {profileView.tenure?.confirmation
                    ? new Date(profileView.tenure.confirmation).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Salary</h3>
                <p>Type: {profileView.salary?.type}</p>
                <p>Amount: {profileView.salary?.amount}</p>
                <p>
                  Start Date:{" "}
                  {new Date(profileView.salary?.startDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

    {/* manage profile window */}
    {managePermissionsView && (
          <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg w-4/5 max-h-[90vh] overflow-y-auto relative p-6">
              {/* Close */}
              <button
                onClick={() => setManagePermissionsView(null)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
              >
                ✖
              </button>

            <div className="flex flex-row justify-between">
              <h2 className="text-xl font-bold mb-4">
                Manage Permissions for {managePermissionsView.individualName}
              </h2>

              <button className="bg-blue-600 text-white px-4 py-2 mr-12 rounded-full font-bold cursor-pointer shadow-sm hover:bg-blue-800 "
                onClick={()=>{
                  navigate("/Permission-handler")
                }}
              >
                Advance Manage Permissions  
              </button>
            </div>

              {/* Top: Employee Permissions */}
              <div className="flex flex-wrap gap-2 mb-6">
              {Array.isArray(managePermissionsView.permissions) && managePermissionsView.permissions.length > 0 ? (
                  managePermissionsView.permissions.map((perm) => (
                    <span
                      key={perm._id}
                      className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                    >
                      {perm.name}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500">No permissions assigned.</span>
                )}
              </div>

              {/* Bottom: Two-column layout */}
              <div className="grid grid-cols-2 gap-6">
                {/* Left side: Add / Delete */}
                <div className="space-y-4">
                  {/* Add Permission */}
                  <div className="p-4 border rounded-lg shadow-sm">
                    <h3 className="font-semibold mb-2">Add Permission</h3>
                    <input
                      type="text"
                      placeholder="Permission name"
                      id="addPermInput"
                      className="border rounded px-3 py-2 w-full mb-2"
                    />
                    <button
                      onClick={() =>
                        handleAddPermission(managePermissionsView._id, document.getElementById("addPermInput").value)
                      }
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Add
                    </button>
                  </div>

                  {/* Delete Permission */}
                  <div className="p-4 border rounded-lg shadow-sm">
                    <h3 className="font-semibold mb-2">Delete Permission</h3>
                    <input
                      type="text"
                      placeholder="Permission name"
                      id="delPermInput"
                      className="border rounded px-3 py-2 w-full mb-2"
                    />
                    <button
                      onClick={() =>
                        handleDeletePermission(managePermissionsView._id, document.getElementById("delPermInput").value)
                      }
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Right side: All Permissions */}
                <div className="p-4 border rounded-lg shadow-sm">
                  <h3 className="font-semibold mb-4">All Permissions</h3>
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                   {Array.isArray(allPermissionsList) && allPermissionsList.length > 0 ? (
                      allPermissionsList.map((perm) => (
                        <div key={perm._id} className="p-2 border rounded text-sm flex justify-between">
                          <span>{perm.name}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500">No permissions found.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default AdminDashboard;
