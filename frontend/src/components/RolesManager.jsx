import React, { useState } from "react";

const RolesManager = ({ onAddRole, onDeleteRole, roles }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [roleToDelete, setRoleToDelete] = useState("");

  // Handle add role
  const handleAdd = () => {
    if (newRole.trim()) {
      onAddRole(newRole);
      setNewRole("");
      setShowAddModal(false);
    }
  };

  // Handle delete role
  const handleDelete = () => {
    if (roleToDelete) {
      onDeleteRole(roleToDelete);
      setRoleToDelete("");
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="space-x-2">
      {/* Buttons */}
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
        onClick={() => setShowAddModal(true)}
      >
        Add Role
      </button>
      <button
        className="px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700"
        onClick={() => setShowDeleteModal(true)}
      >
        Delete Role
      </button>

      {/* Add Role Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-lg font-bold mb-4">Add New Role</h2>
            <input
              type="text"
              placeholder="Enter role name"
              className="w-full border rounded px-3 py-2 mb-4"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <button
                className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={handleAdd}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Role Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-lg font-bold mb-4">Delete Role</h2>
            <select
              className="w-full border rounded px-3 py-2 mb-4"
              value={roleToDelete}
              onChange={(e) => setRoleToDelete(e.target.value)}
            >
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role._id} value={role._id}>
                  {role.role}
                </option>
              ))}
            </select>
            <div className="flex justify-end space-x-2">
              <button
                className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolesManager;
