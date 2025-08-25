import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [finalizedEmployees, setFinalizedEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState(null);

  const [profileView, setProfileView] = useState(null);

  // Fetch all finalized employees
  useEffect(() => {
    const fetchFinalizedEmployees = async () => {
      try {
        const res = await axios.get(
          "http://localhost:3000/api/employees/allfinalized"
        );
        setFinalizedEmployees(res.data.data || []);
      } catch (error) {
        console.error("Failed to fetch finalized employees:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFinalizedEmployees();
  }, []);

  const handleApprove = async (finalizedEmployeeId) => {
    try {
      const res = await axios.patch(
        `http://localhost:3000/api/employees/approve/${finalizedEmployeeId}`
      );
      if (res.status === 200) {
        alert("Employee approved successfully!");
        setFinalizedEmployees((prev) =>
          prev.filter((e) => e._id !== finalizedEmployeeId)
        );
        window.location.reload();
      }
    } catch (error) {
      console.error(error);
      alert("Failed to approve employee.");
    }
  };

  const handleReject = async (finalizedEmployeeId) => {
    try {
      const res = await axios.delete(
        `http://localhost:3000/api/employees/reject/${finalizedEmployeeId}`
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
  
  const handleDelete = async (finalizedEmployeeId) => {
    try {
      const res = await axios.delete(
        `http://localhost:3000/api/employees/delete/${finalizedEmployeeId}`
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

  const handleProfileView = async (finalizedEmployeeId) => {
    try {
      const res = await axios.get(
        `http://localhost:3000/api/employees/getSingleFinalizedEmployee/${finalizedEmployeeId}`
      );
      if (!res.data) {
        alert("Profile data could not be fetched.");
        return;
      }
      setProfileView(res.data.finalizedEmployee || res.data);
    } catch (err) {
      console.error("Error fetching profile:", err);
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
      <aside className="w-64 bg-white shadow-lg flex-shrink-0">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Admin Dashboard</h2>
        </div>
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
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Finalized Employees
        </h1>

        {finalizedEmployees.length === 0 ? (
          <div className="text-gray-500 text-lg">No finalized employees.</div>
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
                    <p className="text-xs text-gray-400">Database Id: {emp._id}</p>
                    <p className="text-xs text-gray-400">Organization Id: {emp.OrganizationId} </p>
                  
                    <p className="text-xs text-gray-400">
                      Created: {new Date(emp.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div>
                    <p className=" ml-12 text-xs text-gray-600">
                      Role: {emp.role}
                    </p>
                    <p className=" ml-12 text-xs text-gray-600">
                      <strong>
                        Decision: {emp.profileStatus?.decision || "N/A"}
                      </strong>
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
                      <button
                        onClick={() => handleApprove(emp._id)}
                        disabled={
                          emp.profileStatus?.decision === "Approved" ||
                          emp.profileStatus?.decision === "Rejected"
                        }
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-100"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(emp._id)}
                        disabled={
                          emp.profileStatus?.decision === "Approved" ||
                          emp.profileStatus?.decision === "Rejected"
                        }
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-100"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleDelete(emp._id)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-100"
                      >
                        Delete
                      </button>

                      <button
                        onClick={() => handleProfileView(emp._id)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-100"
                      >
                        View Profile
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
                <p className="text-gray-600">{profileView.role}</p>
                <p className="text-gray-500">{profileView.officialEmail}</p>
              </div>
            </div>

            {/* Profile Details */}
            <div className="grid grid-cols-2 gap-6 text-sm text-gray-700">

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Personal Details
                </h3>
                <p>Employee ID: {profileView.UserId}</p>
                <p>Database ID: {profileView._id} </p>
                <p>Organization Id: {profileView.OrganizationId} </p>
                <p>Father Name: {profileView.fatherName}</p>
                <p>DOB: {new Date(profileView.dob).toLocaleDateString()}</p>
                <p>Govt ID: {profileView.govtId || "N/A"}</p>
                <p>Passport No: {profileView.passportNo || "N/A"}</p>
                <p>Personal Email: {profileView.personalEmail}</p>
                <p>Password: {profileView.password || "Profile not approved yet."} </p>

              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Address</h3>
                <p>{profileView.address?.houseNo}, {profileView.address?.addressLine}</p>
                <p>
                  {profileView.address?.city}, {profileView.address?.state}{" "}
                  {profileView.address?.country}
                </p>
                <p>Contact: {profileView.address?.contactNo}</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Employment</h3>
                <p>Status: {profileView.employmentStatus}</p>
                <p>Joining: {new Date(profileView.tenure?.joining).toLocaleDateString()}</p>
                <p>Confirmation: {profileView.tenure?.confirmation ? new Date(profileView.tenure.confirmation).toLocaleDateString() : "N/A"}</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Salary</h3>
                <p>Type: {profileView.salary?.type}</p>
                <p>Amount: {profileView.salary?.amount}</p>
                <p>Start Date: {new Date(profileView.salary?.startDate).toLocaleDateString()}</p>
              </div>

              {/* <div>
            
              </div> */}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
