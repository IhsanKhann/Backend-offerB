import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const DraftDashboard = () => {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(null); // track submitting employee
  const [openDropdown, setOpenDropdown] = useState(null); // track which dropdown is open

// Fetch employees and roles from backend
useEffect(() => {
  const fetchData = async () => {
    try {
      const empRes = await api.get("/getAllEmployees");
      const rolesRes = await api.get("/getAllRoles");

      // ✅ Axios already gives you parsed JSON in .data
      const empData = empRes.data;
      const rolesData = rolesRes.data;

      setEmployees(empData.employees || []);
      setRoles(rolesData.roles || []);
    } catch (error) {
      console.error("Failed to fetch employees or roles:", error);
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, []);


  // Refresh employees and roles
  const fetchEmployees = async () => {
    try {
      const empRes = await api.get("/getAllEmployees");
      const rolesRes = await api.get("/getAllRoles");

      
      setEmployees(empRes.employees || []);
      setRoles(rolesRes.roles || []);
    } catch (error) {
      console.error("Failed to refresh employees or roles:", error);
    }
  };

  // Actions
  const handleEditEmployee = (employeeId) => {
    navigate(`/assign-roles/${employeeId}`);
  };

  const handleSubmitEmployee = async (employeeId) => {
    try {
      setSubmitting(employeeId);

      const employeeRoles = roles.filter((r) => r.employeeId === employeeId);
      if (!employeeRoles.length) {
        alert("Cannot submit: No roles assigned to this employee");
        return;
      }

      const orgUnitId = employeeRoles[0].orgUnit;

      const response = await api.post(`/submit-employee`, {
        employeeId: employeeId,
        orgUnitId: orgUnitId,
      });

      if (response.data.success) {
        alert("Employee submitted successfully!");
        fetchEmployees();
      }
    } catch (error) {
      console.error("Submit error:", error);
      alert("Failed to submit employee: " + (error.response?.data?.message || error.message));
    } finally {
      setSubmitting(null);
    }
  };

  const handleCancelEmployee = async (employeeId) => {
    try {
      const response = await api.delete(`/deleteEmployee/${employeeId}`)

      if (response.ok) {
        alert("Employee deleted successfully");
        setEmployees(employees.filter((emp) => emp._id !== employeeId));
        setRoles(roles.filter((role) => role.employeeId !== employeeId));
      } else {
        alert("Failed to delete employee");
      }
    } catch (error) {
      console.error("Error deleting employee:", error);
      alert("An error occurred while deleting the employee");
    }
  };

  // Helpers
  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const getStatusBadge = (status) => {
    const baseClasses = "px-3 py-1 rounded-full text-xs font-semibold";
    switch (status) {
      case "Draft":
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case "Submitted":
        return `${baseClasses} bg-green-100 text-green-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const hasRoles = (employeeId) => roles.filter((r) => r.employeeId === employeeId).length > 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const totalDrafts = employees.length;
  const pendingCount = employees.length;
  const submittedCount = employees.filter((e) => e.DraftStatus?.status === "Submitted").length;

  if (employees.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Employees Available</h2>
          <p className="text-gray-600 mb-6">
            Start by registering an employee to create your first draft.
          </p>
          <button
            onClick={() => navigate("/register-employee")}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Register Employee
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Employee Drafts</h1>
            <p className="mt-2 text-gray-600">Manage your employee registration drafts</p>
          </div>
          <div className="space-x-2">
            <button
              onClick={() => navigate("/register-employee")}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              New Employee
            </button>
            <button
              onClick={() => navigate("/admin/dashboard")}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Admin Dashboard
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white overflow-hidden shadow rounded-lg p-5">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Drafts</dt>
            <dd className="text-lg font-medium text-gray-900">{totalDrafts}</dd>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg p-5">
            <dt className="text-sm font-medium text-gray-500 truncate">Pending</dt>
            <dd className="text-lg font-medium text-gray-900">{pendingCount}</dd>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg p-5">
            <dt className="text-sm font-medium text-gray-500 truncate">Submitted</dt>
            <dd className="text-lg font-medium text-gray-900">{submittedCount}</dd>
          </div>
        </div>

        {/* Employee Cards */}
        <div className="space-y-6">
          {employees.map((emp) => {
            const empRoles = roles.filter((r) => r.employeeId === emp._id);

            return (
              <div
                key={emp._id}
                className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-all duration-300"
              >
                {/* Header with Status & Dropdown */}
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <span className={getStatusBadge(emp.DraftStatus?.status || "Draft")}>
                    {emp.DraftStatus?.status || "Draft"}
                  </span>
                  <div className="relative">
                    <button
                      onClick={() => setOpenDropdown(openDropdown === emp._id ? null : emp._id)}
                      className="p-2 rounded-md bg-gray-200 text-black hover:bg-gray-300"
                    >
                      Actions <span> &#9660; </span>
                    </button>
                    {openDropdown === emp._id && (
                      <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                        <button
                          onClick={() => handleEditEmployee(emp._id)}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                          if (
                            emp?.DraftStatus?.status === "Submitted"
                          ) {
                            alert("Already Submitted");
                            return;
                          }
                          handleSubmitEmployee(emp._id);
                        }}
                          disabled={ emp?.DraftStatus?.status === "Submitted"}
                          className={`w-full text-left px-4 py-2 text-sm rounded 
                          ${
                             emp?.DraftStatus?.status === "Submitted"
                              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                              : "text-gray-700 hover:bg-red-100"
                          }`}
                        >
                          {submitting === emp._id ? "Submitting..." : "Submit"}
                        </button>
                        <button
                          onClick={() => handleCancelEmployee(emp._id)}
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                        >
                          Delete
                        </button>
                        {!hasRoles(emp._id) && (
                          <button
                            onClick={() => navigate(`/assign-roles/${emp._id}`)}
                            className="block w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-gray-100"
                          >
                            Assign Roles
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Employee Info */}
                <div className="px-6 py-4 flex items-center space-x-4">
                  {emp.avatar ? (
                    <img
                      src={emp.avatar?.url || "https://via.placeholder.com/150"}
                      alt="Employee Avatar"
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-gray-500">
                      N/A
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{emp.individualName}</p>
                    <p className="text-sm text-gray-500">{emp.officialEmail}</p>
                    <p className="text-xs text-gray-400">ID: {emp.UserId}</p>
                    <p className="text-xs text-gray-400">Database Id: {emp._id}</p>
                  </div>
                  <span className="ml-auto text-xs text-gray-500">{formatDate(emp.createdAt)}</span>
                </div>

                {/* Assigned Roles */}
                {empRoles.length > 0 && (
                  <div className="px-6 py-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Assigned Roles</h4>
                    {empRoles.map((role) => (
                      <div key={role._id} className="text-xs mb-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Role:</span>
                          <span className="text-gray-900">{role.roleName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">OrgUnit:</span>
                          <span className="text-gray-900">
                            {role.orgUnit?.name || role.orgUnit || "N/A"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DraftDashboard;
