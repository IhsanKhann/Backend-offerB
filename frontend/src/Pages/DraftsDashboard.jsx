import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { deleteDraft, startEditDraft, submitDraft } from "../store/sliceDraft.jsx";
import axios from "axios";

const DraftDashboard = () => {
  const drafts = useSelector((state) => state.draft.drafts);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch employees and roles directly from backend
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

  // Draft card handlers (Redux store)
  const handleEditDraft = (draft) => {
    dispatch(startEditDraft({ id: draft.draftId }));
    navigate(`/assign-roles`);
  };

  const handleSubmitDraft = (draft) => {
    dispatch(submitDraft({ id: draft.draftId }));
    alert(`Draft ${draft.draftId} submitted successfully!`);
  };

  const handleCancelDraft = (draftId) => {
    if (confirm("Are you sure you want to delete this draft?")) {
      dispatch(deleteDraft({ id: draftId }));
    }
  };

  // Employee card handlers (Backend) - empty for now
  const handleEditEmployee = (employeeId) => {
    // TODO: Call backend edit API
    console.log("Edit employee:", employeeId);
  };


  const handleSubmitEmployee = async(employeeId) => {
    try{
      const response = await axios.post("http://localhost:3000/api/employees/Submit",{
        employeeId
      });
      console.log("Response:", response.data); // return the finalized employee id.
      console.log("Id in submit response:", response.data.finalizedEmployeeId);

      // this will need to be passed to the admin page or reject/approve wont work
      const finalizedEmployeeId = response.data.finalizedEmployeeId;

      if(response.status === 200){
        alert("Employee submitted successfully");
      }
    }
    catch(error){
      console.error("Failed to submit employee:", error);
    }
    console.log("Submit employee:", employeeId);
  };

  const handleCancelEmployee = async(employeeId) => {
    try {
      const response = await fetch(`http://localhost:3000/api/deleteEmployee/${employeeId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        alert("Employee deleted successfully");
        setEmployees(employees.filter((emp) => emp.employeeId !== employeeId));
        setRoles(roles.filter((role) => role.employeeId !== employeeId));

        // reload..
        window.location.reload();

      } else {
        alert("Failed to delete employee");
      }
    } catch (error) {
      console.error("Error deleting employee:", error);
      alert("An error occurred while deleting the employee");
    }

    console.log("Cancel employee:", employeeId);
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const totalDrafts = drafts.length + employees.length;
  const pendingCount =
    drafts.filter((d) => d.status === "Draft").length +
    employees.length; // all employees initially pending
  const submittedCount = drafts.filter((d) => d.status === "Submitted").length;

  if (drafts.length === 0 && employees.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Drafts or Employees Available</h2>
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
          {/* Draft Cards */}
          {drafts.map((draft) => (
            <div
              key={draft.draftId}
              className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-all duration-300"
            >
              {/* Header with Status */}
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <span className={getStatusBadge(draft.status)}>{draft.status}</span>
                <span className="text-xs text-gray-500">{formatDate(draft.createdAt)}</span>
              </div>

              {/* Employee Info */}
              <div className="px-6 py-4 flex items-center space-x-4">
                {draft.employee?.avatar ? (
                 <img
                    src={draft.employee?.avatar?.url || 'https://via.placeholder.com/150'}
                    alt="Employee Avatar"
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-gray-500">
                    N/A
                  </div>
                )}
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {draft.employee?.individualName || "Unknown Employee"}
                  </p>
                  <p className="text-sm text-gray-500">{draft.employee?.officialEmail || "No email"}</p>
                  <p className="text-xs text-gray-400">
                    ID: {draft.employee?.employeeId || draft.draftId?.slice(0, 8)}
                  </p>
                </div>
              </div>

              {/* Roles Info */}
              {draft.roles && draft.roles.role && (
                <div className="px-6 py-4 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Post Assigned</h4>
                  {["division", "department", "group", "cell"].map(
                    (field) =>
                      draft.roles.role[field] && (
                        <div key={field} className="flex justify-between text-xs">
                          <span className="text-gray-500">
                            {field.charAt(0).toUpperCase() + field.slice(1)}:
                          </span>
                          <span className="text-gray-900">{draft.roles.role[field]}</span>
                        </div>
                      )
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between space-x-2">
                <button
                  onClick={() => handleEditDraft(draft)}
                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Edit
                </button>
                {draft.status === "Draft" && (
                  <button
                    onClick={() => handleSubmitDraft(draft)}
                    className="flex-1 bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700"
                  >
                    Submit
                  </button>
                )}
                <button
                  onClick={() => handleCancelDraft(draft.draftId)}
                  className="flex-1 bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {/* Employee Cards */}
          {employees.map((emp) => {
            const empRoles = roles.filter(
              (r) => r.employeeId === emp._id || r.employeeId === emp.employeeId
            );
            return (
              <div
                key={emp._id}
                className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-all duration-300"
              >
                <div className="px-6 py-4 flex items-center space-x-4">
                  {emp.avatar ? (
                   <img
                      src={emp.avatar?.url || 'https://via.placeholder.com/150'}
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
                    <p className="text-xs text-gray-400">ID: {emp.employeeId}</p>
                  </div>
                </div>
                {empRoles.length > 0 && (
                  <div className="px-6 py-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Assigned Roles</h4>
                    {empRoles.map((r, idx) => (
                      <div key={idx} className="text-xs mb-2">
                        {["division", "department", "group", "cell"].map(
                          (field) =>
                            r.role[field] && (
                              <div key={field} className="flex justify-between">
                                <span className="text-gray-500">
                                  {field.charAt(0).toUpperCase() + field.slice(1)}:
                                </span>
                                <span className="text-gray-900">{r.role[field]}</span>
                              </div>
                            )
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Employee Action Buttons */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between space-x-2">
                  <button
                    onClick={() => handleEditEmployee(emp._id)}
                    className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleSubmitEmployee(emp._id)}
                    className="flex-1 bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700"
                  >
                    Submit
                  </button>
                  <button
                    onClick={() => handleCancelEmployee(emp._id)}
                    className="flex-1 bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700"
                  >
                    Delete
                  </button>
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
