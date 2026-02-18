import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { UserPlus, Home, ArrowRight, X, Edit2, Send, Trash2, FileText, Eye, XCircle, AlertCircle } from "lucide-react";
import DocumentUpload from '../components/DocumentUpload.jsx';
import DocumentReview from '../components/DocumentReview.jsx';
import Sidebar from '../components/Sidebar.jsx';

// Loader Component
const Loader = () => (
  <div className="flex justify-center items-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
  </div>
);

// Profile View Modal
const ProfileViewModal = ({ employee, onClose }) => {
  if (!employee) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] relative flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl z-10"
        >
          <X size={24} />
        </button>

        <h2 className="text-3xl font-bold mb-4 text-center pt-6">
          {employee.individualName}'s Draft Profile
        </h2>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Personal Details */}
            <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Personal Details</h3>
              <p><span className="font-medium">Name:</span> {employee.individualName}</p>
              <p><span className="font-medium">Father's Name:</span> {employee.fatherName}</p>
              <p><span className="font-medium">DOB:</span> {new Date(employee.dob).toLocaleDateString()}</p>
              <p><span className="font-medium">Qualification:</span> {employee.qualification || 'N/A'}</p>
              <p><span className="font-medium">Government ID:</span> {employee.govtId || 'N/A'}</p>
            </div>

            {/* Contact Information */}
            <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Contact Information</h3>
              <p><span className="font-medium">Official Email:</span> {employee.officialEmail}</p>
              <p><span className="font-medium">Personal Email:</span> {employee.personalEmail}</p>
            </div>

            {/* Address */}
            <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Address</h3>
              <p><span className="font-medium">City:</span> {employee.address?.city || 'N/A'}</p>
              <p><span className="font-medium">Country:</span> {employee.address?.country || 'N/A'}</p>
              <p><span className="font-medium">Contact No:</span> {employee.address?.contactNo || 'N/A'}</p>
            </div>

            {/* Employment Details */}
            <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Employment Details</h3>
              <p><span className="font-medium">Status:</span> {employee.employmentStatus || 'N/A'}</p>
              <p><span className="font-medium">Draft Status:</span> {employee.DraftStatus?.status || 'Draft'}</p>
              <p><span className="font-medium">Post Status:</span> {employee.DraftStatus?.PostStatus || 'Not Assigned'}</p>
            </div>

            {/* Role & OrgUnit Information */}
            <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Assignment Details</h3>
              <p><span className="font-medium">Role:</span> {employee.role?.roleName || 'Not Assigned'}</p>
              <p><span className="font-medium">OrgUnit:</span> {employee.orgUnit?.name || 'Not Assigned'}</p>
            </div>

            {/* Document Status */}
            <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Document Status</h3>
              <p><span className="font-medium">Completion:</span> {employee.documentCompletionStatus || 'Incomplete'}</p>
              <p><span className="font-medium">Documents:</span> {employee.documents?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main DraftDashboard Component
const DraftDashboard = () => {
  const navigate = useNavigate();
  
  // Existing states
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileView, setProfileView] = useState(null);
  const [editView, setEditView] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [submitting, setSubmitting] = useState(null);
  
  // Document management states
  const [selectedEmployeeForDocs, setSelectedEmployeeForDocs] = useState(null);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showDocumentReview, setShowDocumentReview] = useState(false);
  const [documentsForReview, setDocumentsForReview] = useState([]);
  const [selectedEmployeeForReview, setSelectedEmployeeForReview] = useState(null);
  const [globalError, setGlobalError] = useState(null);

  // Fetch employees
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setGlobalError(null);
      const response = await api.get("/employees/getAllEmployees");
      setEmployees(response.data?.data || response.data?.employees || []);
    } catch (error) {
      console.error("Failed to fetch drafts:", error);
      setGlobalError(error.response?.data?.message || "Failed to load employee drafts");
    } finally {
      setLoading(false);
    }
  };

  // Fetch employee documents
  const fetchEmployeeDocuments = async (employeeId) => {
    try {
      const response = await api.get(`/documents/employees/${employeeId}/documents`, {
        params: { isFinal: "false" }
      });
      setDocumentsForReview(response.data?.data?.documents || []);
      setSelectedEmployeeForReview(employeeId);
      setShowDocumentReview(true);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      alert("Failed to load documents: " + (error.response?.data?.message || error.message));
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Handle Submit Employee
  const handleSubmitEmployee = async (employeeId) => {
    try {
      setSubmitting(employeeId);
      
      const employee = employees.find(emp => emp._id === employeeId);
      
      // Enhanced validation - check for role
      if (!employee.role) {
        alert("❌ Cannot submit: Employee must have a role assigned.\n\nPlease click 'Assign Roles' first.");
        setSubmitting(null);
        return;
      }

      // Enhanced validation - check for orgUnit
      if (!employee.orgUnit) {
        alert("❌ Cannot submit: Employee must have an organizational unit assigned.\n\nPlease click 'Assign Roles' to assign both role and orgUnit.");
        setSubmitting(null);
        return;
      }

      // Extract orgUnit ID
      const orgUnitId = typeof employee.orgUnit === 'object' ? employee.orgUnit._id : employee.orgUnit;

      if (!orgUnitId) {
        alert("❌ Invalid orgUnit reference. Please reassign the role.");
        setSubmitting(null);
        return;
      }

      const response = await api.post("/employees/submit-employee", {
        employeeId,
        orgUnitId,
      });

      if (response.data.success) {
        alert("✅ Employee submitted successfully!");
        await fetchEmployees();
      } else {
        alert("❌ Submission failed: " + (response.data.message || "Unknown error"));
      }
    } catch (error) {
      console.error("❌ Submit error:", error);
      const errorMessage = error.response?.data?.message || error.message || "An unexpected error occurred";
      alert(`❌ Failed to submit employee:\n\n${errorMessage}`);
    } finally {
      setSubmitting(null);
    }
  };

  // Handle Delete
  const handleDeleteEmployee = async (employeeId) => {
    if (!confirm("Are you sure you want to delete this employee draft?")) return;
    
    try {
      const response = await api.delete(`/employees/deleteEmployee/${employeeId}`);
      
      if (response.data.success) {
        alert("Employee deleted successfully");
        setEmployees(employees.filter((emp) => emp._id !== employeeId));
      }
    } catch (error) {
      console.error("Error deleting employee:", error);
      alert("Failed to delete employee");
    }
  };

  // Handle Profile View
  const handleProfileView = async (employeeId) => {
    const employee = employees.find(emp => emp._id === employeeId);
    setProfileView(employee);
  };

  // Get Document Badge
  const getDocumentBadge = (employee) => {
    const status = employee.documentCompletionStatus || 'Incomplete';
    const colors = {
      'Complete': 'bg-green-100 text-green-700',
      'Incomplete': 'bg-red-100 text-red-700',
      'Under Review': 'bg-yellow-100 text-yellow-700',
      'Approved': 'bg-blue-100 text-blue-700'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    );
  };

  // Render Employee Card
  const renderEmployeeCard = (emp) => (
    <div key={emp._id} className="bg-white shadow rounded-xl p-6 hover:shadow-xl transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-4">
          {/* ✅ FIXED: Proper avatar display with fallback */}
          {emp.avatar?.url ? (
            <img 
              src={emp.avatar.url} 
              alt={emp.individualName} 
              className="w-16 h-16 rounded-full object-cover border-2 border-gray-200" 
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://via.placeholder.com/150/cccccc/666666?text=' + emp.individualName.charAt(0).toUpperCase();
              }}
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
              {emp.individualName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-gray-900">{emp.individualName}</p>
            <p className="text-sm text-gray-500">{emp.personalEmail || emp.officialEmail}</p>
            <p className="text-xs text-gray-400">Role: {emp.role?.roleName || 'Not Assigned'}</p>
            <p className="text-xs text-gray-400">OrgUnit: {emp.orgUnit?.name || 'Not Assigned'}</p>
            <div className="mt-2">
              {getDocumentBadge(emp)}
            </div>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === emp._id ? null : emp._id)}
            className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Actions <ArrowRight className="ml-2" size={16} />
          </button>

          {openDropdown === emp._id && (
            <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
              <div className="py-1">
                <button
                  onClick={() => {
                    handleProfileView(emp._id);
                    setOpenDropdown(null);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <Eye size={16} /> View Profile
                </button>
                
                <button
                  onClick={() => {
                    navigate(`/assign-roles/${emp._id}`);
                    setOpenDropdown(null);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <Edit2 size={16} /> Assign Roles
                </button>

                <button
                  onClick={() => {
                    setSelectedEmployeeForDocs(emp);
                    setShowDocuments(true);
                    setOpenDropdown(null);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 flex items-center gap-2"
                >
                  <FileText size={16} /> Manage Documents
                </button>

                <button
                  onClick={() => {
                    fetchEmployeeDocuments(emp._id);
                    setSelectedEmployeeForDocs(emp);
                    setOpenDropdown(null);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 flex items-center gap-2"
                >
                  <Eye size={16} /> Review Documents
                </button>

                <button
                  onClick={() => {
                    handleSubmitEmployee(emp._id);
                    setOpenDropdown(null);
                  }}
                  disabled={submitting === emp._id}
                  className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 flex items-center gap-2 disabled:opacity-50"
                >
                  <Send size={16} /> {submitting === emp._id ? 'Submitting...' : 'Submit'}
                </button>

                <button
                  onClick={() => {
                    handleDeleteEmployee(emp._id);
                    setOpenDropdown(null);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Sidebar navigation items
  const navItems = [
    { 
      name: "All Drafts", 
      action: () => fetchEmployees(), 
      icon: <FileText size={18} /> 
    },
    { 
      name: "New Employee", 
      path: "/register-employee", 
      icon: <UserPlus size={18} /> 
    },
    { 
      name: "Admin Dashboard", 
      path: "/admin/dashboard", 
      icon: <Home size={18} /> 
    }
  ];

  return (
    <div className="flex bg-gray-100 min-h-screen">
      {/* Sidebar */}
      <div className="sticky top-0 h-screen">
        <Sidebar
          navItems={navItems}
          title="Draft Dashboard"
        />
      </div>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800">Draft Employees</h1>
            <p className="text-gray-600 mt-2">
              Manage employee drafts before final submission
            </p>
          </div>

          {/* Global Error Banner */}
          {globalError && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <XCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{globalError}</p>
                </div>
                <div className="ml-auto pl-3">
                  <button onClick={() => setGlobalError(null)} className="text-red-400 hover:text-red-600">
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && <Loader />}

          {/* Empty State */}
          {!loading && employees.length === 0 && (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No draft employees</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new employee.</p>
              <div className="mt-6">
                <button
                  onClick={() => navigate("/register-employee")}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <UserPlus className="-ml-1 mr-2 h-5 w-5" />
                  New Employee
                </button>
              </div>
            </div>
          )}

          {/* Employee Grid */}
          {!loading && employees.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {employees.map(renderEmployeeCard)}
            </div>
          )}

          {/* Profile View Modal */}
          {profileView && (
            <ProfileViewModal 
              employee={profileView} 
              onClose={() => setProfileView(null)} 
            />
          )}

          {/* ✅ FIXED: Document Upload Modal with proper state management */}
          {showDocuments && selectedEmployeeForDocs && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-xl font-bold">
                    Documents - {selectedEmployeeForDocs.individualName}
                  </h3>
                  <button
                    onClick={() => {
                      setShowDocuments(false);
                      setSelectedEmployeeForDocs(null);
                      fetchEmployees(); // Refresh to update document status
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle size={24} />
                  </button>
                </div>
                
                <div className="p-6">
                  <DocumentUpload
                    employeeId={selectedEmployeeForDocs._id}
                    isFinal={false}
                    readOnly={false}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ✅ FIXED: Document Review Modal with proper functionality */}
          {showDocumentReview && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-xl font-bold">Review Employee Documents</h3>
                  <button
                    onClick={() => {
                      setShowDocumentReview(false);
                      setDocumentsForReview([]);
                      setSelectedEmployeeForDocs(null);
                      setSelectedEmployeeForReview(null);
                      fetchEmployees(); // Refresh to update document status
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle size={24} />
                  </button>
                </div>
                
                <div className="p-6 space-y-4">
                  {documentsForReview.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No documents uploaded yet</p>
                  ) : (
                    documentsForReview.map(doc => (
                      <div key={doc._id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <FileText className="text-blue-500" size={24} />
                            <div>
                              <p className="font-semibold">
                                {doc.documentType === 'Other' && doc.customDocumentName
                                  ? doc.customDocumentName
                                  : doc.documentType}
                              </p>
                              <p className="text-sm text-gray-500">{doc.file.originalName}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              doc.status === 'Approved' ? 'bg-green-100 text-green-700' :
                              doc.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                              doc.status === 'Needs Revision' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {doc.status}
                            </span>
                            
                            <a
                              href={doc.file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                            >
                              View
                            </a>
                            
                            <DocumentReview
                              employeeId={selectedEmployeeForReview}
                              document={doc}
                              isFinal={false}
                              onReviewComplete={() => {
                                // Refresh documents
                                fetchEmployeeDocuments(selectedEmployeeForReview);
                              }}
                            />
                          </div>
                        </div>
                        
                        {doc.reviewNotes && (
                          <div className="mt-3 p-3 bg-gray-50 rounded">
                            <p className="text-xs font-semibold text-gray-700">Review Notes:</p>
                            <p className="text-sm text-gray-600 mt-1">{doc.reviewNotes}</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DraftDashboard;