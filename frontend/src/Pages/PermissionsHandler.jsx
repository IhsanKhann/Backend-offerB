import React, { useState, useEffect } from 'react';
import { FiMoreVertical, FiX, FiEdit2, FiPlus, FiCheck, FiXCircle } from 'react-icons/fi';

const PermissionHandler = () => {
  // Initial demo permissions data
  const initialPermissions = [
    { id: 1, name: 'view_employees', description: 'Permission for who can view the employees' },
    { id: 2, name: 'edit_employees', description: 'Permission for who can edit employee details' },
    { id: 3, name: 'delete_employees', description: 'Permission for who can delete employees' },
    { id: 4, name: 'view_reports', description: 'Permission for who can view reports' },
    { id: 5, name: 'generate_reports', description: 'Permission for who can generate reports' },
  ];

  const [permissions, setPermissions] = useState(initialPermissions);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPermission, setEditingPermission] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [newPermission, setNewPermission] = useState({ name: '', description: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);

  // Simulate fetching permissions from backend
  useEffect(() => {
    const fetchPermissions = async () => {
      setIsLoading(true);
      // Simulate API call
      setTimeout(() => {
        setIsLoading(false);
        // In a real app, you would set permissions from API response
        // setPermissions(response.data);
      }, 1000);
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

  const handleDelete = (permission) => {
    setPermissions(permissions.filter(p => p.id !== permission.id));
    setDeleteConfirm(null);
    
    // In a real app, you would send the delete request to the backend here
    // deletePermission(permission.id);
  };

  const handleCreate = () => {
    if (!newPermission.name.trim() || !newPermission.description.trim()) return;
    
    const newPerm = {
      id: Math.max(...permissions.map(p => p.id), 0) + 1,
      name: newPermission.name,
      description: newPermission.description
    };
    
    setPermissions([...permissions, newPerm]);
    setNewPermission({ name: '', description: '' });
    setShowCreateModal(false);
    
    // In a real app, you would send the create request to the backend here
    // createPermission(newPerm);
  };

  const toggleMenu = (id) => {
    setActiveMenu(activeMenu === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Permission Management</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors"
          >
            <FiPlus className="mr-2" />
            Add Permission
          </button>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading permissions...</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Permission Name
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {permissions.map((permission) => (
                  <tr key={permission.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingPermission?.id === permission.id ? (
                        <input
                          type="text"
                          value={editingPermission.name}
                          onChange={(e) => setEditingPermission({...editingPermission, name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="text-sm font-medium text-gray-900">{permission.name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingPermission?.id === permission.id ? (
                        <input
                          type="text"
                          value={editingPermission.description}
                          onChange={(e) => setEditingPermission({...editingPermission, description: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="text-sm text-gray-600">{permission.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {editingPermission?.id === permission.id ? (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={handleSaveEdit}
                            className="text-green-600 hover:text-green-900 p-2"
                          >
                            <FiCheck size={18} />
                          </button>
                          <button
                            onClick={() => setEditingPermission(null)}
                            className="text-gray-600 hover:text-gray-900 p-2"
                          >
                            <FiXCircle size={18} />
                          </button>
                        </div>
                      ) : (
                        <div className="relative flex justify-end">
                          <button
                            onClick={() => toggleMenu(permission.id)}
                            className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
                          >
                            <FiMoreVertical size={18} />
                          </button>
                          
                          {activeMenu === permission.id && (
                            <div className="absolute right-0 mt-8 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                              <button
                                onClick={() => handleEdit(permission)}
                                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                              >
                                <FiEdit2 className="mr-2" />
                                Edit
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(permission)}
                                className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-100 w-full text-left"
                              >
                                <FiX className="mr-2" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Confirm Deletion</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete the permission "{deleteConfirm.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Permission Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Permission</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Permission Name</label>
                <input
                  type="text"
                  value={newPermission.name}
                  onChange={(e) => setNewPermission({...newPermission, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., view_reports"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newPermission.description}
                  onChange={(e) => setNewPermission({...newPermission, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Describe what this permission allows"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop for closing menus */}
      {activeMenu && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => setActiveMenu(null)}
        ></div>
      )}
    </div>
  );
};

export default PermissionHandler;