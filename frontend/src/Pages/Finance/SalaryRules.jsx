import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";

export default function SalaryRulesTable() {
  const [roles, setRoles] = useState([]);
  const [editRoleId, setEditRoleId] = useState(null);
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all roles with salary rules
  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await api.get("/summaries/salarytable/all");
      setRoles(res.data.data || res.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleEdit = (role) => {
    setEditRoleId(role._id);
    setFormData(JSON.parse(JSON.stringify(role.salaryRules)));
  };

  const handleCancel = () => {
    setEditRoleId(null);
    setFormData(null);
  };

  const handleInputChange = (section, index, field, value) => {
    const updated = { ...formData };
    if (section === "baseSalary" || section === "salaryType") {
      updated[section] = value;
    } else {
      updated[section][index][field] = field === "value" ? Number(value) : value;
    }
    setFormData(updated);
  };

  const addBenefit = (section) => {
    const updated = { ...formData };
    updated[section].push({ name: "", type: "fixed", value: 0 });
    setFormData(updated);
  };

  const removeBenefit = (section, index) => {
    const updated = { ...formData };
    updated[section].splice(index, 1);
    setFormData(updated);
  };

  const handleSave = async () => {
    try {
      await api.put(`/summaries/salarytable/${editRoleId}`, { salaryRules: formData });
      handleCancel();
      fetchRoles();
      alert("Salary rules updated!");
    } catch (err) {
      console.error(err);
      alert("Failed to update salary rules");
    }
  };

  const handleCreate = async () => {
    const roleName = prompt("Enter new role name:");
    if (!roleName) return;

    try {
      await api.post("/salarytable/", {
        name: roleName,
        description: "",
        salaryRules: {
          baseSalary: 0,
          salaryType: "monthly",
          allowances: [],
          deductions: [],
          terminalBenefits: [],
        },
      });
      fetchRoles();
      alert("New role created!");
    } catch (err) {
      console.error(err);
      alert("Failed to create role");
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-8 space-y-8 bg-gray-100 min-h-screen">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Salary Rules Table</h2>
        <button
          onClick={handleCreate}
          className="bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition"
        >
          + Create New Role
        </button>
      </div>

      {/* Explanation Note */}
      <div className="p-4 bg-blue-50 border-l-4 border-blue-500 text-blue-800 rounded-lg shadow-sm">
        <p>
          Each card below represents a <strong>Role</strong>. Inside each card are the{" "}
          <strong>Salary Rules</strong> like base salary, allowances, deductions, 
          and terminal benefits. Employees linked to this role will follow these rules 
          when salaries are calculated.
        </p>
      </div>

      {roles.map((role) => (
        <div
          key={role._id}
          className="border rounded-xl shadow-md bg-white p-6 space-y-6 hover:shadow-lg transition"
        >
          {/* Role Header */}
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="text-xl font-semibold text-gray-700">{role.name}</h3>
            <div className="flex gap-2">
              {editRoleId === role._id ? (
                <>
                  <button
                    onClick={handleSave}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleEdit(role)}
                  disabled={editRoleId !== null}
                  className={`bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition ${
                    editRoleId !== null ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          {/* Base Salary & Type */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block font-medium mb-1 text-gray-600">Base Salary</label>
              {editRoleId === role._id ? (
                <input
                  type="number"
                  value={formData.baseSalary}
                  onChange={(e) => handleInputChange("baseSalary", null, null, e.target.value)}
                  className="border px-3 py-2 rounded-lg w-full"
                />
              ) : (
                <p className="text-gray-800 font-medium">
                  PKR {role.salaryRules.baseSalary?.toLocaleString()}
                </p>
              )}
            </div>
            <div>
              <label className="block font-medium mb-1 text-gray-600">Salary Type</label>
              {editRoleId === role._id ? (
                <select
                  value={formData.salaryType}
                  onChange={(e) => handleInputChange("salaryType", null, null, e.target.value)}
                  className="border px-3 py-2 rounded-lg w-full"
                >
                  <option value="monthly">Monthly</option>
                  <option value="hourly">Hourly</option>
                </select>
              ) : (
                <p className="text-gray-800 font-medium">{role.salaryRules.salaryType}</p>
              )}
            </div>
          </div>

          {/* Allowances, Deductions, Terminal Benefits */}
          {["allowances", "deductions", "terminalBenefits"].map((section) => (
            <div key={section} className="border rounded-lg overflow-hidden shadow-sm">
              <h4 className="bg-blue-50 px-4 py-2 font-semibold text-lg capitalize border-b border-blue-200 text-blue-800">
                {section}
              </h4>
              <table className="w-full text-left border-collapse">
                <thead className="bg-blue-100 text-blue-900">
                  <tr>
                    <th className="border px-4 py-2">Name</th>
                    <th className="border px-4 py-2">Type</th>
                    <th className="border px-4 py-2">Value</th>
                    {editRoleId === role._id && <th className="border px-4 py-2">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {(editRoleId === role._id ? formData[section] : role.salaryRules[section])?.map(
                    (item, idx) => (
                      <tr
                        key={idx}
                        className={idx % 2 === 0 ? "bg-white" : "bg-blue-50"}
                      >
                        {editRoleId === role._id ? (
                          <>
                            <td className="border px-4 py-2">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) =>
                                  handleInputChange(section, idx, "name", e.target.value)
                                }
                                className="border px-2 py-1 rounded w-full"
                              />
                            </td>
                            <td className="border px-4 py-2">
                              <select
                                value={item.type}
                                onChange={(e) =>
                                  handleInputChange(section, idx, "type", e.target.value)
                                }
                                className="border px-2 py-1 rounded w-full"
                              >
                                <option value="fixed">Fixed</option>
                                <option value="percentage">Percentage</option>
                              </select>
                            </td>
                            <td className="border px-4 py-2">
                              <input
                                type="number"
                                value={item.value}
                                onChange={(e) =>
                                  handleInputChange(section, idx, "value", e.target.value)
                                }
                                className="border px-2 py-1 rounded w-full"
                              />
                            </td>
                            <td className="border px-4 py-2 text-center">
                              <button
                                onClick={() => removeBenefit(section, idx)}
                                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                              >
                                Delete
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="border px-4 py-2">{item.name}</td>
                            <td className="border px-4 py-2">{item.type}</td>
                            <td className="border px-4 py-2">{item.value}</td>
                          </>
                        )}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
              {editRoleId === role._id && (
                <div className="p-3 bg-gray-50 border-t">
                  <button
                    onClick={() => addBenefit(section)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                  >
                    + Add {section.slice(0, -1)}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
