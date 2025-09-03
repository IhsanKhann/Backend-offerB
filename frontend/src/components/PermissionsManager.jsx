// src/pages/EmployeesPermissions.jsx
import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { UserPlus, Shield, Plus, Trash2 } from "lucide-react";

export const EmployeesPermissions = () => {
  const [employees, setEmployees] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedToAdd, setSelectedToAdd] = useState([]);
  const [selectedToDelete, setSelectedToDelete] = useState([]);

  // ✅ Fetch employees with populated roles + permissions
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get("/finalizedEmployees/allWithRoles");
      if (res.data.success) {
        setEmployees(res.data.data);
      }
    } catch (err) {
      console.error("Error fetching employees:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all permissions for adding
  const fetchAllPermissions = async () => {
    try {
      const res = await api.get("/permissions/AllPermissions");
      if (res.data.status) setAllPermissions(res.data.Permissions);
    } catch (err) {
      console.error("Error fetching all permissions:", err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchAllPermissions();
  }, []);

  // Handle selecting permissions to delete
  const toggleDelete = (permId) => {
    setSelectedToDelete((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  // Handle selecting permissions to add
  const toggleAdd = (permId) => {
    setSelectedToAdd((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  // Bulk delete permissions
  const handleDeletePermissions = async () => {
    if (!selectedEmployee || selectedToDelete.length === 0) return;

    try {
      const permissionNames = selectedToDelete.map(
        (permId) => allPermissions.find((p) => p._id === permId)?.name
      );

      await api.delete("/permissions/removePermissionsInBulk", {
        data: {
          employeeId: selectedEmployee._id,
          permissionNames,
        },
      });

      await fetchEmployees(); // ✅ refresh employees with updated roles/permissions
      alert("Permissions deleted successfully");
      setSelectedToDelete([]);
    } catch (err) {
      console.error("Bulk delete error:", err.response?.data || err);
      alert("Failed to delete permissions");
    }
  };

  // Bulk add permissions
  const handleAddPermissions = async () => {
    if (!selectedEmployee || selectedToAdd.length === 0) return;

    try {
      const permissionNames = selectedToAdd.map(
        (permId) => allPermissions.find((p) => p._id === permId)?.name
      );

      await api.post("/permissions/addPermissionsInBulk", {
        employeeId: selectedEmployee._id,
        permissionNames,
      });

      await fetchEmployees(); // ✅ refresh employees with updated roles/permissions
      alert("Permissions added successfully");
      setSelectedToAdd([]);
    } catch (err) {
      console.error("Bulk add error:", err.response?.data || err);
      alert("Failed to add permissions");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <p className="text-gray-700 text-xl font-medium">Loading employees...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Employee Permissions</h1>
      <div className="space-y-6">
        {employees.length === 0 && (
          <p className="text-gray-500 text-lg">No employees to display.</p>
        )}

        {employees.map((emp) => (
          <div
            key={emp._id}
            className="bg-white shadow-md rounded-xl p-6 flex flex-col md:flex-row md:items-center gap-6 transition-all hover:shadow-xl"
          >
            {/* Profile Info */}
            <div className="flex items-center gap-4">
              {emp.avatar ? (
                <img
                  src={emp.avatar.url || "https://via.placeholder.com/150"}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center text-gray-500 text-lg font-semibold">
                  N/A
                </div>
              )}
              <div className="flex flex-col">
                <p className="text-lg font-semibold text-gray-900">{emp.individualName}</p>
                <p className="text-sm text-gray-500">{emp.personalEmail || emp.officialEmail}</p>
                <p className="text-sm text-gray-500">
                  Role: {emp.role?.roleName || "N/A"}
                </p>
              </div>
            </div>

            {/* Permissions */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Shield size={16} /> Permissions
                </h3>
                <button
                  className="flex items-center gap-1 text-white bg-green-600 px-3 py-1 rounded hover:bg-green-700 text-sm"
                  onClick={() => setSelectedEmployee(emp)}
                >
                  <Plus size={14} /> Manage
                </button>
              </div>
              {emp.role?.permissions?.length > 0 ? (
                <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {emp.role.permissions.map((perm) => (
                    <li
                      key={perm._id}
                      className={`px-3 py-1 rounded-full text-sm font-medium cursor-pointer ${
                        selectedEmployee?._id === emp._id &&
                        selectedToDelete.includes(perm._id)
                          ? "bg-red-600 text-white"
                          : "bg-blue-100 text-blue-800"
                      }`}
                      title={perm.description || perm.name}
                      onClick={() =>
                        selectedEmployee?._id === emp._id ? toggleDelete(perm._id) : null
                      }
                    >
                      {perm.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm">No permissions assigned.</p>
              )}
            </div>
          </div>
        ))}

        {/* Manage Permissions Modal */}
        {selectedEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg w-4/5 max-h-[90vh] overflow-y-auto relative p-6">
              <button
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
                onClick={() => {
                  setSelectedEmployee(null);
                  setSelectedToAdd([]);
                  setSelectedToDelete([]);
                }}
              >
                ✖
              </button>
              <h2 className="text-xl font-bold mb-4">
                Manage Permissions for {selectedEmployee.individualName}
              </h2>

              {/* Delete Section */}
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Click to delete:</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedEmployee.role?.permissions?.length > 0 ? (
                    selectedEmployee.role.permissions.map((perm) => (
                      <div
                        key={perm._id}
                        className={`px-3 py-1 rounded-full text-sm font-medium cursor-pointer ${
                          selectedToDelete.includes(perm._id)
                            ? "bg-red-600 text-white"
                            : "bg-blue-100 text-blue-800"
                        }`}
                        onClick={() => toggleDelete(perm._id)}
                      >
                        {perm.name}
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No permissions to delete.</p>
                  )}
                </div>
                <button
                  onClick={handleDeletePermissions}
                  className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  <Trash2 size={16} className="inline mr-1" /> Delete Selected
                </button>
              </div>

              {/* Add Section */}
              <div>
                <h3 className="font-semibold mb-2">Click to add:</h3>
                <div className="flex flex-wrap gap-2">
                  {allPermissions
                    .filter(
                      (perm) =>
                        !selectedEmployee.role?.permissions?.some((p) => p._id === perm._id)
                    )
                    .map((perm) => (
                      <div
                        key={perm._id}
                        className={`px-3 py-1 rounded-full text-sm font-medium cursor-pointer ${
                          selectedToAdd.includes(perm._id)
                            ? "bg-green-600 text-white"
                            : "bg-gray-200 text-gray-800"
                        }`}
                        onClick={() => toggleAdd(perm._id)}
                      >
                        {perm.name}
                      </div>
                    ))}
                </div>
                <button
                  onClick={handleAddPermissions}
                  className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <Plus size={16} className="inline mr-1" /> Add Selected
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
