import React, { useState, useEffect } from "react";
import {
  FiMoreVertical,
  FiX,
  FiEdit2,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import api from "../api/axios";

const PermissionHandler = () => {
  const [permissions, setPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // State for modals
  const [editingPermission, setEditingPermission] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [newPermission, setNewPermission] = useState({
    name: "",
    description: "",
  });
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [activeMenu, setActiveMenu] = useState(null);

  // Fetch permissions on mount
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        setIsLoading(true);
        const response = await api.get("/permissions/AllPermissions");
        const perms = response.data?.Permissions ?? response.data ?? [];
        setPermissions(Array.isArray(perms) ? perms : []);
      } catch (error) {
        console.error("Error fetching permissions: ", error);
        setPermissions([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPermissions();
  }, []);

  // Create Permission
  const handleCreate = async () => {
    if (!newPermission.name.trim() || !newPermission.description.trim()) return;

    setIsLoading(true);
    try {
      const response = await api.post(
        "/permissions/createPermission",
        newPermission
      );
      const created = response.data?.permission ?? null;
      if (created) setPermissions([...permissions, created]);

      setNewPermission({ name: "", description: "" });
      setShowCreateModal(false);
    } catch (error) {
      console.error(error.response?.data?.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  // Edit Permission
  const handleSaveEdit = async () => {
    if (
      !editingPermission?.name.trim() ||
      !editingPermission?.description.trim()
    )
      return;

    try {
      const response = await api.put(
        `/permissions/updatePermission/${editingPermission._id}`,
        {
          name: editingPermission.name,
          description: editingPermission.description,
        }
      );

      const updated = response.data?.permission ?? editingPermission;
      setPermissions((prev) =>
        prev.map((p) => (p._id === updated._id ? updated : p))
      );

      setEditingPermission(null);
    } catch (error) {
      console.error(
        error.response?.data?.message || "Failed to update permission"
      );
    }
  };

  // Delete Permission
  const handleDelete = async () => {
    if (!deleteConfirm) return;

    setIsLoading(true);
    try {
      await api.delete(`/permissions/removePermission/${deleteConfirm._id}`);
      setPermissions((prev) =>
        prev.filter((p) => p._id !== deleteConfirm._id)
      );
      setDeleteConfirm(null);
    } catch (error) {
      console.error(
        error.response?.data?.message || "Failed to delete permission"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Menu toggle
  const toggleMenu = (id, e) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === id ? null : id);
  };

  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Permission Management
            </h1>
            <p className="text-gray-600 mt-2">
              Manage user permissions and access levels
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg flex items-center transition-colors shadow-lg hover:shadow-xl"
          >
            <FiPlus className="mr-2" />
            Add Permission
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading permissions...</p>
            </div>
          ) : permissions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No permissions found.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-8 py-5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Permission Name
                  </th>
                  <th className="px-8 py-5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-8 py-5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {permissions.map((permission) => (
                  <tr
                    key={permission._id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-8 py-5 whitespace-nowrap text-sm font-medium text-gray-900">
                      {permission.name}
                    </td>
                    <td className="px-8 py-5 text-sm text-gray-600">
                      {permission.description}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-right text-sm font-medium">
                      <div className="relative inline-block text-left">
                        <button
                          onClick={(e) => toggleMenu(permission._id, e)}
                          className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
                        >
                          <FiMoreVertical size={18} />
                        </button>

                        {activeMenu === permission._id && (
                          <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                            <div
                              className="py-1"
                              role="menu"
                              aria-orientation="vertical"
                            >
                              <button
                                onClick={() => setEditingPermission(permission)}
                                className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 w-full text-left transition-colors"
                                role="menuitem"
                              >
                                <FiEdit2 className="mr-3 text-blue-600" />
                                Edit
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(permission)}
                                className="flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 w-full text-left transition-colors"
                                role="menuitem"
                              >
                                <FiTrash2 className="mr-3" />
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                Create Permission
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={22} />
              </button>
            </div>

            <input
              type="text"
              placeholder="Permission Name"
              value={newPermission.name}
              onChange={(e) =>
                setNewPermission({ ...newPermission, name: e.target.value })
              }
              className="w-full mb-4 p-3 border rounded-lg"
            />
            <textarea
              placeholder="Description"
              value={newPermission.description}
              onChange={(e) =>
                setNewPermission({
                  ...newPermission,
                  description: e.target.value,
                })
              }
              className="w-full mb-6 p-3 border rounded-lg"
            ></textarea>

            <button
              onClick={handleCreate}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg w-full"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingPermission && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                Edit Permission
              </h2>
              <button
                onClick={() => setEditingPermission(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={22} />
              </button>
            </div>

            <input
              type="text"
              placeholder="Permission Name"
              value={editingPermission.name}
              onChange={(e) =>
                setEditingPermission({
                  ...editingPermission,
                  name: e.target.value,
                })
              }
              className="w-full mb-4 p-3 border rounded-lg"
            />
            <textarea
              placeholder="Description"
              value={editingPermission.description}
              onChange={(e) =>
                setEditingPermission({
                  ...editingPermission,
                  description: e.target.value,
                })
              }
              className="w-full mb-6 p-3 border rounded-lg"
            ></textarea>

            <button
              onClick={handleSaveEdit}
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg w-full"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Delete Permission
            </h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deleteConfirm.name}</span>?
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-6 py-3 rounded-lg border text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white"
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

export default PermissionHandler;
