import React, { useState } from "react";

const RolesManager = ({ onAddRole, onDeleteRole, roles }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Add Role states
  const [newRole, setNewRole] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [salaryType, setSalaryType] = useState("monthly");

  const [allowances, setAllowances] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [terminalBenefits, setTerminalBenefits] = useState([]);

  const [roleToDelete, setRoleToDelete] = useState("");

  // Handlers for dynamic fields
  const handleAddItem = (type, setter) => {
    setter((prev) => [...prev, { name: "", type: "fixed", value: 0 }]);
  };

  const handleChangeItem = (index, field, value, setter) => {
    setter((prev) => {
      const updated = [...prev];
      updated[index][field] = field === "value" ? Number(value) : value;
      return updated;
    });
  };

  const handleRemoveItem = (index, setter) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle add role
  const handleAdd = () => {
    if (!newRole.trim() || !baseSalary) return alert("Role name and base salary are required");

    const roleData = {
      name: newRole.trim(),
      description: newDescription.trim(),
      salaryRules: {
        baseSalary: Number(baseSalary),
        salaryType,
        allowances,
        deductions,
        terminalBenefits,
      },
    };

    onAddRole(roleData);

    // Reset all fields
    setNewRole("");
    setNewDescription("");
    setBaseSalary("");
    setSalaryType("monthly");
    setAllowances([]);
    setDeductions([]);
    setTerminalBenefits([]);
    setShowAddModal(false);
  };

  // Handle delete role
  const handleDelete = () => {
    if (!roleToDelete) return alert("Select a role to delete");
    onDeleteRole(roleToDelete);
    setRoleToDelete("");
    setShowDeleteModal(false);
  };

  return (
    <div className="space-x-2 flex flex-col md:flex-row items-start md:items-center">
      {/* Buttons */}
      <div className="flex space-x-2 mb-2 md:mb-0">
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
      </div>

      {/* Add Role Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 overflow-auto p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-3xl">
            <h2 className="text-lg font-bold mb-4">Add New Role</h2>

            {/* Warning note */}
      <p className="mb-4 text-sm text-red-600">
        ⚠️ Salary information is crucial! Later, salaries will be assigned based on these rules, so please enter them carefully.
      </p>

            <div className="mb-3">
              <input
                type="text"
                placeholder="Role Name"
                className="w-full border rounded px-3 py-2 mb-2"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              />
              <textarea
                placeholder="Role Description"
                className="w-full border rounded px-3 py-2"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>

            <div className="mb-3 flex space-x-2">
              <input
                type="number"
                placeholder="Base Salary"
                className="border rounded px-3 py-2 w-1/2"
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value)}
              />
              <select
                className="border rounded px-3 py-2 w-1/2"
                value={salaryType}
                onChange={(e) => setSalaryType(e.target.value)}
              >
                <option value="monthly">Monthly</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>

            {/* Dynamic Fields */}
            <DynamicFieldSection
              title="Allowances"
              items={allowances}
              setItems={setAllowances}
            />
            <DynamicFieldSection
              title="Deductions"
              items={deductions}
              setItems={setDeductions}
            />
            <DynamicFieldSection
              title="Terminal Benefits"
              items={terminalBenefits}
              setItems={setTerminalBenefits}
            />

            <div className="flex justify-end space-x-2 mt-4">
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
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-lg font-bold mb-4">Delete Role</h2>
            <select
              className="w-full border rounded px-3 py-2 mb-4"
              value={roleToDelete}
              onChange={(e) => setRoleToDelete(e.target.value)}
            >
              <option value="">Select Role</option>
              {roles.map((role) => (
                <option key={role._id} value={role._id}>
                  {role.name}
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

// Component for dynamic arrays
const DynamicFieldSection = ({ title, items, setItems }) => {
  return (
    <div className="mb-4 border-t pt-2">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold">{title}</h3>
        <button
          className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
          onClick={() => setItems([...items, { name: "", type: "fixed", value: 0 }])}
        >
          Add
        </button>
      </div>
      {items.map((item, index) => (
        <div key={index} className="flex space-x-2 mb-2 items-center">
          <input
            type="text"
            placeholder="Name"
            className="border rounded px-2 py-1 flex-1"
            value={item.name}
            onChange={(e) => {
              const updated = [...items];
              updated[index].name = e.target.value;
              setItems(updated);
            }}
          />
          <select
            className="border rounded px-2 py-1 w-24"
            value={item.type}
            onChange={(e) => {
              const updated = [...items];
              updated[index].type = e.target.value;
              setItems(updated);
            }}
          >
            <option value="fixed">Fixed</option>
            <option value="percentage">Percentage</option>
          </select>
          <input
            type="number"
            placeholder="Value"
            className="border rounded px-2 py-1 w-24"
            value={item.value}
            onChange={(e) => {
              const updated = [...items];
              updated[index].value = Number(e.target.value);
              setItems(updated);
            }}
          />
          <button
            className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
            onClick={() => setItems(items.filter((_, i) => i !== index))}
          >
            X
          </button>
        </div>
      ))}
    </div>
  );
};

export default RolesManager;
