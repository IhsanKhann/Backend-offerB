import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { deleteDraft, startEditDraft, submitDraft } from "../store/sliceDraft.jsx";
import axios from "axios";

const DraftDashboard = () => {
  // const drafts = useSelector((state) => state.draft.drafts); // commented out as per instruction
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rolesAssigned, setRolesAssigned] = useState(null);
  const [submitting, setSubmitting] = useState(null); // State to track submitting employee

  // Fetch employees and roles from backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        const empRes = await fetch("http://localhost:3000/api/getAllEmployees");
        const rolesRes = await fetch("http://localhost:3000/api/getAllRoles");

        const empData = await empRes.json();
        const rolesData = await rolesRes.json();

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

  // Function to refresh employees and roles
  const fetchEmployees = async () => {
    try {
      const empRes = await fetch("http://localhost:3000/api/getAllEmployees");
      const rolesRes = await fetch("http://localhost:3000/api/getAllRoles");

      setEmployees((await empRes.json()).employees || []);
      setRoles((await rolesRes.json()).roles || []);
    } catch (error) {
      console.error("Failed to refresh employees or roles:", error);
    }
  };

  // Draft card handlers (Redux store) - commented out
  // const handleEditDraft = (draft) => {
  //   dispatch(startEditDraft({ id: draft.draftId }));
  //   navigate(`/assign-roles`);
  // };

  // const handleSubmitDraft = (draft) => {
  //   dispatch(submitDraft({ id: draft.draftId }));
  //   alert(`Draft ${draft.draftId} submitted successfully!`);
  // };

  // const handleCancelDraft = (draftId) => {
  //   if (confirm("Are you sure you want to delete this draft?")) {
  //     dispatch(deleteDraft({ id: draftId }));
  //   }
  // };

  // Employee card handlers (Backend)
  const handleEditEmployee = (employeeId) => {
    console.log("Edit employee:", employeeId);
    navigate(`/assign-roles/${employeeId}`);
  };

  const handleSubmitEmployee = async (employeeId) => {
    try {
      setSubmitting(employeeId);

      // Find employee's roles to get orgUnitId
      const employeeRoles = roles.filter(r => r.UserId === employeeId);
      if (!employeeRoles.length) {
        alert("Cannot submit: No roles assigned to this employee");
        return;
      }

      const orgUnitId = employeeRoles[0].orgUnit; // Use first role's orgUnit

      // Send as POST request body, not URL params
      const response = await axios.post(`http://localhost:3000/api/submit-employee`, {
        employeeId: employeeId,
        orgUnitId: orgUnitId
      });

      if (response.data.success) {
        alert("Employee submitted successfully!");
        fetchEmployees(); // Refresh the list
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
      const response = await fetch(`http://localhost:3000/api/deleteEmployee/${employeeId}`, {
        method: "DELETE",
      });
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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

  const hasRoles = (employeeId) => {
    const empRoles = roles.filter((r) => r.employeeId === employeeId);
    return empRoles.length > 0;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const totalDrafts = employees.length; // store drafts commented out
  const pendingCount = employees.length; // all employees initially pending
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Employee Drafts</h1>
            <p className="mt-2 text-gray-600">Manage your employee registration drafts</p>
          </div>
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
            admin dashboard
          </button>

          
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white overflow-hidden shadow rounded-lg p-5">
            <div className="flex items-center">
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Drafts</dt>
                  <dd className="text-lg font-medium text-gray-900">{totalDrafts}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg p-5">
            <div className="flex items-center">
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Pending</dt>
                  <dd className="text-lg font-medium text-gray-900">{pendingCount}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg p-5">
            <div className="flex items-center">
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Submitted</dt>
                  <dd className="text-lg font-medium text-gray-900">{submittedCount}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Store draft cards - commented out */}
          {/*
          {drafts.map((draft) => (
            <div key={draft.draftId} className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-all duration-300">
              ...
            </div>
          ))}
          */}

        {/* Employee cards from backend */}
        {employees.map((emp) => {
          // ✅ Filter roles assigned to this employee using UserId
          const empRoles = roles.filter((r) => r.UserId === emp._id);

          return (
            <div
              key={emp._id}
              className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-all duration-300"
            >
              {/* Header with Status */}
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <span className={getStatusBadge(emp.DraftStatus?.status || "Draft")}>
                  {emp.DraftStatus?.status || "Draft"}
                </span>
                <span className="text-xs text-gray-500">{formatDate(emp.createdAt)}</span>
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
                  <p className="text-xs text-gray-400">DataBase Id: {emp._id}</p>
                </div>
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
                          {/* Show populated orgUnit name or fallback */}
                          {role.orgUnit?.name || role.orgUnit || "N/A"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 space-y-2">
                <div className="flex justify-between gap-2">
                  <button
                    onClick={() => handleEditEmployee(emp._id)}
                    className="flex-1 bg-blue-600 text-white font-medium py-2 rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleSubmitEmployee(emp._id)}
                    className={`flex-1 bg-green-600 text-white font-medium py-2 rounded-lg transition-all duration-200 shadow-sm ${submitting === emp._id ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-700'}`}
                    disabled={submitting === emp._id}
                  >
                    {submitting === emp._id ? "Submitting..." : "Submit"}
                  </button>
                  <button
                    onClick={() => handleCancelEmployee(emp._id)}
                    className="flex-1 bg-red-600 text-white font-medium py-2 rounded-lg hover:bg-red-700 transition-all duration-200 shadow-sm"
                  >
                    Delete
                  </button>
                </div>

                {!hasRoles(emp._id) && (
                  <button
                    onClick={() => navigate(`/assign-roles/${emp._id}`)}
                    className="w-full bg-orange-500 text-white font-medium py-2 rounded-lg hover:bg-orange-600 transition-all duration-200 shadow-sm"
                  >
                    Assign Roles
                  </button>
                )}
              </div>
            </div>
          );
        })}

        </div>
      </div>
    </div>
  );
};

export default DraftDashboard;