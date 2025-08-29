import React, { useState, useEffect } from 'react';
import { FiMoreVertical, FiX, FiEdit2, FiPlus, FiCheck, FiXCircle, FiTrash2 } from 'react-icons/fi';
import api from '../api/axios';

const PermissionHandler = () => {

  const [permissions, setPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPermission, setEditingPermission] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [newPermission, setNewPermission] = useState({ name: '', description: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);

  // Simulate fetching permissions from backend
  useEffect(() => {
    const fetchPermissions = async () => {
      try{
        setIsLoading(true);
        const response = await api.get("/permissions/AllPermissions");
        setPermissions(response.data.Permissions);
      }catch(error){
        console.log("Error was caused: ",error);
      }
      finally{
        setIsLoading(false);
      }
    };

    fetchPermissions();
  }, []);

  const handleEdit = (permission) => {
    setEditingPermission({ ...permission });
    setActiveMenu(null);
  };

  const handleSaveEdit = () => {
    if (!editingPermission.name.trim() || !editingPermission.description.trim()) return;
    
    setPermissions(permissions.map(p => 
      p.id === editingPermission.id ? editingPermission : p
    ));
    setEditingPermission(null);
    
    // In a real app, you would send the update to the backend here
    // updatePermission(editingPermission);
  };

const handleDelete = async (permission) => {
  setIsLoading(true);
  try {
    const response = await api.delete(`/permissions/removePermission/${permission.id}`);

    // Use the updated array returned by backend (with IDs reassigned)
    setPermissions(response.data.updatedPermissions);

    setDeleteConfirm(null);
  } catch (error) {
    console.log(error.response?.data?.message || "Failed to delete permission");
  } finally {
    setIsLoading(false);
  }
};

  const handleCreate = async () => {
  if (!newPermission.name.trim() || !newPermission.description.trim()) return;

  setIsLoading(true);

  try {
    const response = await api.post("/permissions/createPermission", newPermission);

    // Append the newly created permission returned by backend
    setPermissions([...permissions, response.data.permission]);
    setNewPermission({ name: "", description: "" });
    setShowCreateModal(false);
  } catch (error) {
    console.log(error.response?.data?.message || "Something went wrong. Try again.");
  } finally {
    setIsLoading(false);
  }
};

  const toggleMenu = (id, e) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === id ? null : id);
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenu(null);
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Permission Management</h1>
            <p className="text-gray-600 mt-2">Manage user permissions and access levels and prevligies </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg flex items-center transition-colors shadow-lg hover:shadow-xl"
          >
            <FiPlus className="mr-2" />
            Add Permission
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading permissions...</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-8 py-5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Permission Name
                  </th>
                  <th scope="col" className="px-8 py-5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-8 py-5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {permissions.map((permission) => (
                  <tr key={permission.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{permission.name}</div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="text-sm text-gray-600">{permission.description}</div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-right text-sm font-medium">
                      <div className="relative inline-block text-left">
                        <button
                          onClick={(e) => toggleMenu(permission.id, e)}
                          className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
                        >
                          <FiMoreVertical size={18} />
                        </button>
                        
                        {activeMenu === permission.id && (
                          <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                            <div className="py-1" role="menu" aria-orientation="vertical">
                              <button
                                onClick={() => handleEdit(permission)}
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

      {/* Edit Permission Modal */}
      {editingPermission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-semibold text-gray-800">Edit Permission</h3>
              <button
                onClick={() => setEditingPermission(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={24} />
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permission Name</label>
                <input
                  type="text"
                  value={editingPermission.name}
                  onChange={(e) => setEditingPermission({...editingPermission, name: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., view_reports"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={editingPermission.description}
                  onChange={(e) => setEditingPermission({...editingPermission, description: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="3"
                  placeholder="Describe what this permission allows"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-7">
              <button
                onClick={() => setEditingPermission(null)}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-semibold text-gray-800">Confirm Deletion</h3>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={24} />
              </button>
            </div>
            
            <p className="text-gray-600 mb-1">
              Are you sure you want to delete the following permission?
            </p>
            <div className="bg-red-50 p-4 rounded-lg mb-6 mt-4">
              <p className="font-medium text-red-800">{deleteConfirm.name}</p>
              <p className="text-red-600 text-sm mt-1">{deleteConfirm.description}</p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center"
              >
                <FiTrash2 className="mr-2" />
                Delete Permission
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Permission Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-semibold text-gray-800">Create New Permission</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={24} />
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permission Name</label>
                <input
                  type="text"
                  value={newPermission.name}
                  onChange={(e) => setNewPermission({...newPermission, name: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., view_reports"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={newPermission.description}
                  onChange={(e) => setNewPermission({...newPermission, description: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="3"
                  placeholder="Describe what this permission allows"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-7">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Permission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermissionHandler;