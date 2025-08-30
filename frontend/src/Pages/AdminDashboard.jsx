import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { HierarchyTree } from "../components/HieararchyTree";
import axios from "axios";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [finalizedEmployees, setFinalizedEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [profileView, setProfileView] = useState(null);

  const [managePermissionsView, setManagePermissionsView] = useState(null);
  const [allPermissionsList, setAllPermissionsList] = useState([]);

  // Fetch finalized employees on mount
  useEffect(() => {
    handleAllEmployees();
  }, []);

//Fetch all permissions when modal opens:
const fetchAllPermissions = async () => {
  try {
    const res = await api.get("/permissions/AllPermissions");
    if (res.data.status) {
      setAllPermissionsList(res.data.Permissions);
    }
  } catch (err) {
    console.error("Error fetching all permissions", err);
  }
};

useEffect(() => {
  if (managePermissionsView) {
    fetchAllPermissions();
  }
}, [managePermissionsView]);

  // Fetch permissions for a given employee
  const fetchEmployeePermissions = async (employeeId) => {
    try {
      // const res = await api.get(`/permissions/getPermissions/${employeeId}`);
      const res = await axios.get(`/permissions/getPermissions/${employeeId}`);
      if (res.data.success) {
        return res.data.permissions || [];
      }
      return [];
    } catch (err) {
      console.error("Error fetching permissions:", err);
      return [];
    }
  };

    // Fetch ALL employees
  const handleAllEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get("/finalizedEmployees/allfinalized");
      const employees = res.data.data || [];

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

  // Fetch employees for a node
  const fetchEmployeesByNode = async (orgUnit, isLeaf) => {
    try {
      setLoading(true);
      console.log("Fetching employees for node:", orgUnit.name, "ID:", orgUnit._id);

      // Fetch employees for any node (leaf or intermediate)
      const res = await api.get(
        `/getorgUnit/${orgUnit._id}`
      );
      
      if (res.data.success) {
        setFinalizedEmployees(res.data.employees || []);
        console.log(`Found ${res.data.employees.length} employees for node: ${orgUnit.name}`);
      } else {
        console.log("No employees found for this node");
        setFinalizedEmployees([]);
      }
    } catch (err) {
      console.error("Error fetching employees for node:", err);
      setFinalizedEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  // Approve employee
  const handleApprove = async (finalizedEmployeeId) => {
    try {
      const res = await api.patch(
        `/finalizedEmployees/approve/${finalizedEmployeeId}`
      );
      if (res.status === 200) {
        alert("Employee approved successfully!");
        setFinalizedEmployees((prev) =>
          prev.filter((e) => e._id !== finalizedEmployeeId)
        );
      }
    } catch (error) {
      console.error(error);
      alert("Failed to approve employee.");
    }
  };

  // Reject employee
  const handleReject = async (finalizedEmployeeId) => {
    try {
      const res = await api.delete(
        `/finalizedEmployees/reject/${finalizedEmployeeId}`
      );
      if (res.status === 200) {
        alert("Employee rejected successfully!");
        setFinalizedEmployees((prev) =>
          prev.filter((e) => e._id !== finalizedEmployeeId)
        );
      }
    } catch (error) {
      console.error(error);
      alert("Failed to reject employee.");
    }
  };

  // Delete employee
  const handleDelete = async (finalizedEmployeeId) => {
    try {
      const res = await api.delete(
        `/finalizedEmployees/delete/${finalizedEmployeeId}`
      );
      if (res.status === 200) {
        alert("Employee deleted successfully!");
        setFinalizedEmployees((prev) =>
          prev.filter((e) => e._id !== finalizedEmployeeId)
        );
      }
    } catch (error) {
      console.error(error);
      alert("Failed to delete employee.");
    }
  };

  // Profile view
  const handleProfileView = async (finalizedEmployeeId) => {
  try {
    const res = await api.get(
      `/finalizedEmployees/getSingleFinalizedEmployee/${finalizedEmployeeId}`
    );
    if (!res.data) {
      alert("Profile data could not be fetched.");
      return;
    }
    const employeeData = res.data.finalizedEmployee || res.data;

    // Fetch permissions separately
    const permissions = await fetchEmployeePermissions(finalizedEmployeeId);
    employeeData.permissions = permissions;

    setProfileView(employeeData);
  } catch (err) {
    console.error("Error fetching profile:", err);
  }
  };

const handleAddPermission = async (employeeId, permissionName) => {
  try {
    await api.post(`/permissions/addEmployeePermission`, { employeeId, permissionName });
    alert("Permission added!");

    const updatedPerms = await fetchEmployeePermissions(employeeId);
    setManagePermissionsView((prev) => ({ ...prev, permissions: updatedPerms }));
    setFinalizedEmployees((prev) =>
      prev.map((emp) =>
        emp._id === employeeId ? { ...emp, permissions: updatedPerms } : emp
      )
    );

    // ✅ Clear the input after success
    document.getElementById("addPermInput").value = "";
  } catch (err) {
    console.error(err);
    alert("Failed to add permission");
  }
};

const handleDeletePermission = async (employeeId, permissionName) => {
  try {
    await api.post(`/permissions/removeEmployeePermission`, { employeeId, permissionName });
    alert("Permission deleted!");

    const updatedPerms = await fetchEmployeePermissions(employeeId);
    setManagePermissionsView((prev) => ({ ...prev, permissions: updatedPerms }));
    setFinalizedEmployees((prev) =>
      prev.map((emp) =>
        emp._id === employeeId ? { ...emp, permissions: updatedPerms } : emp
      )
    );

    // ✅ Clear the input after success
    document.getElementById("delPermInput").value = "";
  } catch (err) {
    console.error(err);
    alert("Failed to delete permission");
  }
};

// Open Manage Permissions modal
const handleManagePermissions = async (employeeId) => {
  try {
    // get employee info
    const res = await api.get(`/finalizedEmployees/getSingleFinalizedEmployee/${employeeId}`);
    if (!res.data) {
      alert("Failed to fetch employee details.");
      return;
    }
    const employeeData = res.data.finalizedEmployee || res.data;

    // fetch their permissions
    const permissions = await fetchEmployeePermissions(employeeId);
    employeeData.permissions = permissions;

    // open modal
    setManagePermissionsView(employeeData);
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

  return (
    <div className="flex min-h-screen bg-gray-100 relative">
      {/* Sidebar */}
      <aside className="w-72 bg-gray-300 shadow-lg flex-shrink-0 overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Admin Dashboard</h2>
        </div>

        {/* Org Hierarchy Tree */}
        <div className="px-6 py-4 border-b border-gray-200">
          <HierarchyTree onNodeSelect={fetchEmployeesByNode} />
        </div>

        {/* Show all employees button */}
        <button
          onClick={handleAllEmployees}
          className="w-[80%]  text-xs px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors ml-8 mt-8"
        >
          Show All Employees
        </button>

        <nav className="px-6 py-4 space-y-2">
          <button
            onClick={() => navigate("/DraftDashboard")}
            className="w-full text-left px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Move to Drafts
          </button>

          <button
            onClick={() => navigate("/register-employee")}
            className="w-full text-left px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Register Employee
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">

       <h1 className="text-3xl font-bold text-gray-900 mb-6">Employees</h1>
        {loading ? (
          <div className="text-gray-600">Loading employees...</div>
        ) : finalizedEmployees.length === 0 ? (
          <div className="text-gray-500 text-lg">No employees to show.</div>
        ) : (
          <div className="space-y-4">
            {finalizedEmployees.map((emp) => (
              <div
                key={emp._id}
                className="bg-white shadow rounded-xl flex justify-between items-center p-4 hover:shadow-xl transition-all"
              >
                {/* Left: Employee Info */}
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
                    <p className="text-lg font-semibold text-gray-900">
                      {emp.individualName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {emp.personalEmail || emp.officialEmail}
                    </p>
                    <p className="text-xs text-gray-400">ID: {emp.UserId}</p>
                    <p className="text-xs text-gray-400">
                      Database Id: {emp._id}
                    </p>
                    <p className="text-xs text-gray-400">
                      Organization Id: {emp.OrganizationId}
                    </p>

                    <p className="text-xs text-gray-400">
                      Created: {new Date(emp.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div>
                    <p className="ml-12 text-xs text-gray-600">
                      <strong>
                        Decision: {emp.profileStatus?.decision || "N/A"}
                      </strong>
                    </p>
                    <p className="ml-12 text-xs text-gray-600">
                      Role name: {emp.role?.roleName || "N/A"}
                    </p>
                   <p className="ml-12 text-xs text-gray-600">
                      Permissions: {Array.isArray(emp.permissions) && emp.permissions.length > 0
                        ? emp.permissions.map(p => p.name).join(", ")
                        : "None"}
                    </p>
                  </div>
                </div>

                {/* Right: Action Dropdown */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setOpenDropdown(openDropdown === emp._id ? null : emp._id)
                    }
                    className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Actions &#9660;
                  </button>

                  {openDropdown === emp._id && (
                    <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                      {/* Approve button */}
                      <button
                        onClick={() => {
                          if (
                            emp.profileStatus?.decision === "Approved" ||
                            emp.profileStatus?.decision === "Rejected"
                          ) {
                            alert("Approve action is disabled for this employee.");
                            return;
                          }
                          handleApprove(emp._id);
                        }}
                        disabled={
                          emp.profileStatus?.decision === "Approved" ||
                          emp.profileStatus?.decision === "Rejected"
                        }
                        className={`w-full text-left px-4 py-2 text-sm rounded 
                          ${
                            emp.profileStatus?.decision === "Approved" ||
                            emp.profileStatus?.decision === "Rejected"
                              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                              : "text-gray-700 hover:bg-green-100"
                          }`}
                      >
                        Approve
                      </button>

                      {/* Reject button */}
                      <button
                        onClick={() => {
                          if (
                            emp.profileStatus?.decision === "Approved" ||
                            emp.profileStatus?.decision === "Rejected"
                          ) {
                            alert("Reject action is disabled for this employee.");
                            return;
                          }
                          handleReject(emp._id);
                        }}
                        disabled={
                          emp.profileStatus?.decision === "Approved" ||
                          emp.profileStatus?.decision === "Rejected"
                        }
                        className={`w-full text-left px-4 py-2 text-sm rounded 
                          ${
                            emp.profileStatus?.decision === "Approved" ||
                            emp.profileStatus?.decision === "Rejected"
                              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                              : "text-gray-700 hover:bg-red-100"
                          }`}
                      >
                        Reject
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={() => handleDelete(emp._id)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-100"
                      >
                        Delete
                      </button>

                      {/* View Profile button */}
                      <button
                        onClick={() => handleProfileView(emp._id)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-100"
                      >
                        View Profile
                      </button>

                      <button
                        onClick={() => handleManagePermissions(emp._id)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-100"
                      >
                        Manage Permissions
                      </button>


                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

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
              <p className="ml-12 text-xs text-gray-600">
                Permissions: {Array.isArray(profileView.permissions) && profileView.permissions.length > 0
                  ? profileView.permissions.map(p => p.name).join(", ")
                  : "No permissions"}
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

              <h2 className="text-xl font-bold mb-4">
                Manage Permissions for {managePermissionsView.individualName}
              </h2>

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
                  <p className="text-gray-500">No permissions assigned.</p>
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
