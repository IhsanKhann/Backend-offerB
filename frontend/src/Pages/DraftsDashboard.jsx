import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { deleteDraft, startEditDraft, submitDraft } from "../store/sliceDraft.jsx";

const DraftDashboard = () => {
  const drafts = useSelector((state) => state.draft.drafts);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleEdit = (draft) => {
    dispatch(startEditDraft({ id: draft.draftId }));
    navigate(`/assign-roles`);
  };

  const handleSubmit = async (draft) => {
    try {
      dispatch(submitDraft({ id: draft.draftId }));
      alert(`Draft ${draft.draftId} submitted successfully!`);
    } catch (error) {
      console.error("Error submitting draft:", error);
      alert("Failed to submit draft.");
    }
  };

  const handleCancel = (draftId) => {
    if (confirm("Are you sure you want to delete this draft?")) {
      dispatch(deleteDraft({ id: draftId }));
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

  // if drafts not found...navigate to the employee Registration form to create  draft.
  if (drafts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Drafts Available</h2>
          <p className="text-gray-600 mb-6">Start by registering an employee to create your first draft.</p>
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

  // if drafts are not zero.
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Employee Drafts</h1>
              <p className="mt-2 text-gray-600">Manage your employee registration drafts</p>
            </div>
            <button
              onClick={() => navigate("/register-employee")}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Employee
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Drafts</dt>
                      <dd className="text-lg font-medium text-gray-900">{drafts.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Pending</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {drafts.filter(d => d.status === "Draft").length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Submitted</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {drafts.filter(d => d.status === "Submitted").length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Drafts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {drafts.map((draft) => (
            <div key={draft.draftId} className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-all duration-300">
              {/* Header with Status */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <span className={getStatusBadge(draft.status)}>{draft.status}</span>
                  <span className="text-xs text-gray-500">
                    {formatDate(draft.createdAt)}
                  </span>
                </div>
              </div>

              {/* Employee Info */}
              <div className="px-6 py-4">
                <div className="flex items-center space-x-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {draft.employee?.avatar ? (
                      <img
                        className="h-16 w-16 rounded-full object-cover border-4 border-gray-100"
                        src={draft.employee.avatar.url || "/api/placeholder/64/64"}
                        alt={draft.employee?.individualName}
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div 
                      className={`h-16 w-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center ${draft.employee?.avatar ? 'hidden' : 'flex'}`}
                    >
                      <span className="text-white font-bold text-lg">
                        {draft.employee?.individualName?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    </div>
                  </div>

                  {/* Employee Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-semibold text-gray-900 truncate">
                      {draft.employee?.individualName || "Unknown Employee"}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {draft.employee?.officialEmail || "No email"}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      ID: {draft.employee?.employeeId || draft.draftId?.slice(0, 8)}
                    </p>
                  </div>
                </div>

                {/* Employment Details */}
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Status:</span>
                    <span className="font-medium text-gray-900">
                      {draft.employee?.employmentStatus || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Role:</span>
                    <span className="font-medium text-gray-900 truncate">
                      {draft.employee?.role || "N/A"}
                    </span>
                  </div>
                </div>

                {/* Roles Information */}
                {draft.roles && Object.keys(draft.roles).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Post Assigned</h4>
                    <div className="space-y-1">
                      {draft.roles.role?.division && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Division:</span>
                          <span className="text-gray-900">{draft.roles.role.division}</span>
                        </div>
                      )}
                      {draft.roles.role?.department && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Department:</span>
                          <span className="text-gray-900">{draft.roles.role.department}</span>
                        </div>
                      )}
                      {draft.roles.role?.group && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Group:</span>
                          <span className="text-gray-900">{draft.roles.role.group}</span>
                        </div>
                      )}
                      {draft.roles.role?.cell && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Cell:</span>
                          <span className="text-gray-900">{draft.roles.role.cell}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-between space-x-2">
                  <button
                    onClick={() => handleEdit(draft)}
                    className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  
                  {draft.status === "Draft" && (
                    <button
                      onClick={() => handleSubmit(draft)}
                      className="flex-1 bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Submit
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleCancel(draft.draftId)}
                    className="flex-1 bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DraftDashboard;
