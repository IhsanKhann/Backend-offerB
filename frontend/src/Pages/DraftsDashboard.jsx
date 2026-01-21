import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { UserPlus, Home, ArrowRight, X, Edit2, Send, Trash2 } from "lucide-react";

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
              <p><span className="font-medium">Passport No:</span> {employee.passportNo || 'N/A'}</p>
              <p><span className="font-medium">Alien Reg No:</span> {employee.alienRegNo || 'N/A'}</p>
            </div>

            {/* Contact Information */}
            <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Contact Information</h3>
              <p><span className="font-medium">Official Email:</span> {employee.officialEmail}</p>
              <p><span className="font-medium">Personal Email:</span> {employee.personalEmail}</p>
              <p><span className="font-medium">Previous Org Email:</span> {employee.previousOrgEmail || 'N/A'}</p>
            </div>

            {/* Address */}
            <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Address</h3>
              <p><span className="font-medium">House No:</span> {employee.address?.houseNo || 'N/A'}</p>
              <p><span className="font-medium">Address Line:</span> {employee.address?.addressLine || 'N/A'}</p>
              <p><span className="font-medium">Street No:</span> {employee.address?.streetNo || 'N/A'}</p>
              <p><span className="font-medium">City:</span> {employee.address?.city || 'N/A'}</p>
              <p><span className="font-medium">State:</span> {employee.address?.state || 'N/A'}</p>
              <p><span className="font-medium">Country:</span> {employee.address?.country || 'N/A'}</p>
              <p><span className="font-medium">Contact No:</span> {employee.address?.contactNo || 'N/A'}</p>
            </div>

            {/* Employment Details */}
            <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Employment Details</h3>
              <p><span className="font-medium">Status:</span> {employee.employmentStatus || 'N/A'}</p>
              <p><span className="font-medium">Joining Date:</span> {employee.tenure?.joining ? new Date(employee.tenure.joining).toLocaleDateString() : 'N/A'}</p>
              <p><span className="font-medium">Draft Status:</span> {employee.DraftStatus?.status || 'Draft'}</p>
              <p><span className="font-medium">Post Status:</span> {employee.DraftStatus?.PostStatus || 'Not Assigned'}</p>
            </div>

            {/* Salary Information */}
            <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Salary Information</h3>
              <p><span className="font-medium">Type:</span> {employee.salary?.type || 'N/A'}</p>
              <p><span className="font-medium">Amount:</span> ${employee.salary?.amount || '0'}</p>
              <p><span className="font-medium">Start Date:</span> {employee.salary?.startDate ? new Date(employee.salary.startDate).toLocaleDateString() : 'N/A'}</p>
            </div>

            {/* Role & OrgUnit Information */}
            <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Assignment Details</h3>
              <p><span className="font-medium">Role:</span> {employee.role?.roleName || 'Not Assigned'}</p>
              <p><span className="font-medium">OrgUnit:</span> {employee.orgUnit?.name || 'Not Assigned'}</p>
              <p><span className="font-medium">Department:</span> {employee.role?.code || 'N/A'}</p>
              <p><span className="font-medium">Level:</span> {employee.role?.status || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Edit Employee Modal
const EditEmployeeModal = ({ employee, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    individualName: employee.individualName || '',
    fatherName: employee.fatherName || '',
    dob: employee.dob ? new Date(employee.dob).toISOString().split('T')[0] : '',
    qualification: employee.qualification || '',
    officialEmail: employee.officialEmail || '',
    personalEmail: employee.personalEmail || '',
    employmentStatus: employee.employmentStatus || '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSave(employee._id, formData);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Edit Employee Draft</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                name="individualName"
                value={formData.individualName}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Father's Name</label>
              <input
                type="text"
                name="fatherName"
                value={formData.fatherName}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Qualification</label>
              <input
                type="text"
                name="qualification"
                value={formData.qualification}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Official Email</label>
              <input
                type="email"
                name="officialEmail"
                value={formData.officialEmail}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Personal Email</label>
              <input
                type="email"
                name="personalEmail"
                value={formData.personalEmail}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employment Status</label>
              <select
                name="employmentStatus"
                value={formData.employmentStatus}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                <option value="">Select Status</option>
                <option value="Permanent">Permanent</option>
                <option value="Contract">Contract</option>
                <option value="Probation">Probation</option>
                <option value="Temporary">Temporary</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Main Component
const DraftDashboard = () => {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [profileView, setProfileView] = useState(null);
  const [editView, setEditView] = useState(null);
  const [submitting, setSubmitting] = useState(null);

  // Fetch employees with full details
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await api.get("/employees/getAllEmployees");
      
      if (response.data.status) {
        const employeesData = response.data.employees || [];
        
        // Fetch role and orgUnit details for each employee
        const enrichedEmployees = await Promise.all(
          employeesData.map(async (emp) => {
            try {
              // Fetch role details if role exists
              if (emp.role) {
                const roleResponse = await api.get(`/roles/${emp.role}`);
                emp.role = roleResponse.data.roles || emp.role;
              }
              
              // ✅ FIXED: Use correct endpoint
              if (emp.orgUnit) {
                const orgUnitResponse = await api.get(`/org-units/${emp.orgUnit}`);
                // ✅ FIXED: Access correct property
                emp.orgUnit = orgUnitResponse.data.data || emp.orgUnit;
              }
            } catch (err) {
              console.warn(`Failed to enrich employee ${emp._id}:`, err.message);
            }
            return emp;
          })
        );
        
        setEmployees(enrichedEmployees);
      } else {
        setEmployees([]);
      }
    } catch (error) {
      console.error("Failed to fetch employees:", error);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Handle Submit
const handleSubmitEmployee = async (employeeId) => {
  try {
    setSubmitting(employeeId);
    
    const employee = employees.find(emp => emp._id === employeeId);
    
    console.log("🔍 Attempting to submit employee:", {
      _id: employee._id,
      name: employee.individualName,
      hasRole: !!employee.role,
      hasOrgUnit: !!employee.orgUnit,
      roleValue: employee.role,
      orgUnitValue: employee.orgUnit
    });

    // ✅ Enhanced validation - check for role
    if (!employee.role) {
      alert("❌ Cannot submit: Employee must have a role assigned.\n\nPlease click 'Assign Roles' first.");
      setSubmitting(null);
      return;
    }

    // ✅ Enhanced validation - check for orgUnit
    if (!employee.orgUnit) {
      alert("❌ Cannot submit: Employee must have an organizational unit assigned.\n\nPlease click 'Assign Roles' to assign both role and orgUnit.");
      setSubmitting(null);
      return;
    }

    // Extract orgUnit ID (handle both object and string)
    const orgUnitId = typeof employee.orgUnit === 'object' ? employee.orgUnit._id : employee.orgUnit;

    if (!orgUnitId) {
      alert("❌ Invalid orgUnit reference. Please reassign the role.");
      setSubmitting(null);
      return;
    }

    console.log("✅ Submitting with:", {
      employeeId,
      orgUnitId
    });

    const response = await api.post("/employees/submit-employee", {
      employeeId,
      orgUnitId,
    });

    console.log("📡 Submit response:", response.data);

    if (response.data.success) {
      alert("✅ Employee submitted successfully!");
      await fetchEmployees(); // Refresh the list
    } else {
      alert("❌ Submission failed: " + (response.data.message || "Unknown error"));
    }
  } catch (error) {
    console.error("❌ Submit error:", error);
    
    // Better error messaging
    const errorMessage = error.response?.data?.message || 
                        error.message || 
                        "An unexpected error occurred";
    
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

  // Handle Edit Save
  const handleEditSave = async (employeeId, formData) => {
    try {
      const response = await api.put(`/employees/edit/${employeeId}`, formData);
      
      if (response.data.success) {
        alert("Employee updated successfully!");
        setEditView(null);
        await fetchEmployees();
      }
    } catch (error) {
      console.error("Edit error:", error);
      alert("Failed to update employee: " + (error.response?.data?.message || error.message));
    }
  };

  // Handle Profile View
  const handleProfileView = async (employeeId) => {
    const employee = employees.find(emp => emp._id === employeeId);
    setProfileView(employee);
  };

  // Render Employee Card
  const renderEmployeeCard = (emp) => (
    <div key={emp._id} className="bg-white shadow rounded-xl flex justify-between items-center p-4 hover:shadow-xl transition-all">
      <div className="flex items-center space-x-4">
        {emp.avatar?.url ? (
          <img 
            src={emp.avatar.url} 
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
          <p className="text-xs text-gray-400">ID: {emp._id}</p>
          <p className="text-xs text-gray-400">Role: {emp.role?.roleName || 'Not Assigned'}</p>
          <p className="text-xs text-gray-400">OrgUnit: {emp.orgUnit?.name || 'Not Assigned'}</p>
          <p className="text-xs text-gray-400">
            Status: {emp.DraftStatus?.status || 'Draft'} | Post: {emp.DraftStatus?.PostStatus || 'Not Assigned'}
          </p>
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => setOpenDropdown(openDropdown === emp._id ? null : emp._id)}
          className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Actions ▼
        </button>

        {openDropdown === emp._id && (
          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
            <button
              onClick={() => handleProfileView(emp._id)}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-100 flex items-center"
            >
              <ArrowRight size={16} className="mr-2" />
              View Profile
            </button>
            <button
              onClick={() => {
                setEditView(emp);
                setOpenDropdown(null);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-yellow-100 flex items-center"
            >
              <Edit2 size={16} className="mr-2" />
              Edit
            </button>
            {!emp.role || !emp.orgUnit ? (
              <button
                onClick={() => navigate(`/assign-roles/${emp._id}`)}
                className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-100 flex items-center"
              >
                <UserPlus size={16} className="mr-2" />
                Assign Roles
              </button>
            ) : null}
            <button
              onClick={() => {
                setOpenDropdown(null);
                handleSubmitEmployee(emp._id);
              }}
              disabled={emp.DraftStatus?.status === "Submitted" || submitting === emp._id}
              className={`w-full text-left px-4 py-2 text-sm flex items-center ${
                emp.DraftStatus?.status === "Submitted"
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "text-green-700 hover:bg-green-100"
              }`}
            >
              <Send size={16} className="mr-2" />
              {submitting === emp._id ? "Submitting..." : emp.DraftStatus?.status === "Submitted" ? "Submitted" : "Submit"}
            </button>
            <button
              onClick={() => {
                setOpenDropdown(null);
                handleDeleteEmployee(emp._id);
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-100 flex items-center"
            >
              <Trash2 size={16} className="mr-2" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) return <Loader />;

  const totalDrafts = employees.length;
  const pendingCount = employees.filter(e => e.DraftStatus?.status !== "Submitted").length;
  const submittedCount = employees.filter(e => e.DraftStatus?.status === "Submitted").length;

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Employee Drafts</h1>
            <p className="mt-2 text-gray-600">Manage employee registration drafts</p>
          </div>
          <div className="space-x-2">
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700"
            >
              <Home size={16} className="mr-2" />
              Home
            </button>
            <button
              onClick={() => navigate("/register-employee")}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <UserPlus size={16} className="mr-2" />
              New Employee
            </button>
            <button
              onClick={() => navigate("/admin/dashboard")}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Admin Dashboard
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white overflow-hidden shadow rounded-lg p-5">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Drafts</dt>
            <dd className="text-3xl font-bold text-gray-900">{totalDrafts}</dd>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg p-5">
            <dt className="text-sm font-medium text-gray-500 truncate">Pending</dt>
            <dd className="text-3xl font-bold text-yellow-600">{pendingCount}</dd>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg p-5">
            <dt className="text-sm font-medium text-gray-500 truncate">Submitted</dt>
            <dd className="text-3xl font-bold text-green-600">{submittedCount}</dd>
          </div>
        </div>

        {/* Employee List */}
        {employees.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No employee drafts found</p>
            <button
              onClick={() => navigate("/register-employee")}
              className="mt-4 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <UserPlus size={20} className="mr-2" />
              Register First Employee
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {employees.map(renderEmployeeCard)}
          </div>
        )}

        {/* Modals */}
        {profileView && (
          <ProfileViewModal
            employee={profileView}
            onClose={() => setProfileView(null)}
          />
        )}

        {editView && (
          <EditEmployeeModal
            employee={editView}
            onClose={() => setEditView(null)}
            onSave={handleEditSave}
          />
        )}
      </div>
    </div>
  );
};

export default DraftDashboard;