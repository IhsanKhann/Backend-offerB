import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [finalizedEmployees, setFinalizedEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState(null);

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
        setFinalizedEmployees((prev) => prev.filter((e) => e._id !== finalizedEmployeeId));

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
        setFinalizedEmployees((prev) => prev.filter((e) => e._id !== finalizedEmployeeId));
      }
    } catch (error) {
      console.error(error);
      alert("Failed to reject employee.");
    }
  };

  const handleDelete = async (finalizedEmployeeId) => {
    try {

    // fetch all the drafts -> if the name,email etc of the finalizedEmployee matches with any draft -> send the draft id to the url -> all this to update the status of the employee/draft.
            
      const res = await axios.delete(
        `http://localhost:3000/api/employees/delete/${finalizedEmployeeId}`
      );
      if (res.status === 200) {
        alert("Employee deleted successfully!");
        setFinalizedEmployees((prev) => prev.filter((e) => e._id !== finalizedEmployeeId));
      }
    } catch (error) {
      console.error(error);
      alert("Failed to delete employee.");
    }
  }

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
    <div className="flex min-h-screen bg-gray-100">
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
          {/* Add more routes here */}
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
                    <p className="text-xs text-gray-400">ID: {emp.employeeId}</p>
                    <p className="text-xs text-gray-400">
                      Created: {new Date(emp.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div>
                    <p className=" ml-12 text-xs text-gray-600"> Role: {emp.role} </p>
                    <p className=" ml-12 text-xs text-gray-600">  <strong> Decision: {emp.profileStatus?.decision || "N/A"} </strong>  </p>
                    {/* here we will add post assigned... */}
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
                        disabled={emp.profileStatus?.decision === "Approved" || emp.profileStatus?.decision === "Rejected"}

                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-100"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(emp._id)}
                        disabled={emp.profileStatus?.decision === "Approved" || emp.profileStatus?.decision === "Rejected"}
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
                      {/* Additional actions can be added here */}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
