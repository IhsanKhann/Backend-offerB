import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";
import SidebarNav from "../../components/Sidebar.jsx";

export default function SalaryRulesTable() {
  const [roles, setRoles] = useState([]);
  const [editRoleId, setEditRoleId] = useState(null);
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navItems = [
    { name: "Salary Dashboard", path: "/salary-dashboard" },
    { name: "All Summaries", path: "/summary-table" },
    { name: "Non-Business Tables", path: "/tables" },
    { name: "Business Breakup Tables", path: "/BussinessBreakupTables" },
    { name: "Salary Rules", path: "/salary/rulesTable" },
    { name: "Testing", path: "/paymentDashboard" },
  ];

  // Fetch all roles
  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await api.get("/summaries/salarytable/all");
      setRoles(res.data.data || []);
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

  // Start editing
const handleEdit = (role) => {
  const rules = JSON.parse(JSON.stringify(role.salaryRules));

  // Ensure all arrays exist
  rules.allowances = rules.allowances || [];
  rules.deductions = rules.deductions || [];
  rules.terminalBenefits = rules.terminalBenefits || [];

  setEditRoleId(role._id);
  setFormData(rules);
};

  const handleCancel = () => {
    setEditRoleId(null);
    setFormData(null);
  };

  // Handle input
  const handleInputChange = (section, index, field, value) => {
    const updated = { ...formData };

    // baseSalary or salaryType
    if (section === "baseSalary" || section === "salaryType") {
      updated[section] = value;
    } 
    
    else {
      // allowances / deductions / terminalBenefits
      updated[section][index][field] = field === "value" ? Number(value) : value;
    }

    setFormData(updated);
  };

  // Add new benefit in array
const addBenefit = (section) => {
  const updated = { ...formData };

  // If this section doesn’t exist yet, initialize it
  if (!Array.isArray(updated[section])) {
    updated[section] = [];
  }

  updated[section].push({
    name: "",
    type: "fixed",
    value: 0,
  });

  setFormData(updated);
};


  const removeBenefit = (section, index) => {
    const updated = { ...formData };
    updated[section].splice(index, 1);
    setFormData(updated);
  };

  // Save role
  const handleSave = async () => {
    try {
      await api.put(`/summaries/salarytable/${editRoleId}`, {
        salaryRules: formData,
      });
      handleCancel();
      fetchRoles();
      alert("Salary rules updated!");
    } catch (err) {
      console.error(err);
      alert("Failed to update salary rules");
    }
  };

  // Create a new role
  const handleCreate = async () => {
    const name = prompt("Enter role name");
    if (!name) return;

    try {
      await api.post("/salarytable/", {
        name,
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

  if (loading)
    return (
      <div className="flex min-h-screen">
        <SidebarNav title="Rules Navigation" navItems={navItems} />
        <div className="flex-1 p-6 text-center">Loading...</div>
      </div>
    );

  if (error)
    return (
      <div className="flex min-h-screen">
        <SidebarNav title="Rules Navigation" navItems={navItems} />
        <div className="flex-1 p-6 text-red-600">{error}</div>
      </div>
    );

  return (
    <div className="flex min-h-screen">
      <div className="sticky top-0 h-screen overflow-y-auto">
        <SidebarNav title="Rules Navigation" navItems={navItems} />
      </div>

      <div className="flex-1 p-6 space-y-6 overflow-x-auto">
        <h2 className="text-xl font-semibold mb-2">Salary Rules</h2>

        {roles.map((role) => (
          <div key={role._id} className="border rounded-lg shadow bg-white p-4 space-y-4">
            
            {/* Header */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">{role.name}</h3>

              {editRoleId === role._id ? (
                <>
                  <button onClick={handleSave} className="bg-green-600 text-white px-3 py-1 rounded">
                    Save
                  </button>
                  <button onClick={handleCancel} className="bg-gray-500 text-white px-3 py-1 rounded">
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleEdit(role)}
                  className="bg-blue-600 text-white px-3 py-1 rounded"
                >
                  Edit
                </button>
              )}
            </div>

            {/* Base Salary + Type */}
            <div className="grid grid-cols-2 gap-4">
              {/* Base Salary */}
              <div>
                <label className="font-medium">Base Salary</label>
                {editRoleId === role._id ? (
                  <input
                    type="number"
                    className="border rounded px-2 py-1 w-full"
                    value={formData.baseSalary}
                    onChange={(e) =>
                      handleInputChange("baseSalary", null, null, e.target.value)
                    }
                  />
                ) : (
                  <p>PKR {role.salaryRules.baseSalary}</p>
                )}
              </div>

              {/* Salary Type */}
              <div>
                <label className="font-medium">Salary Type</label>
                {editRoleId === role._id ? (
                  <select
                    className="border rounded px-2 py-1 w-full"
                    value={formData.salaryType}
                    onChange={(e) =>
                      handleInputChange("salaryType", null, null, e.target.value)
                    }
                  >
                    <option value="monthly">Monthly</option>
                    <option value="hourly">Hourly</option>
                  </select>
                ) : (
                  <p>{role.salaryRules.salaryType}</p>
                )}
              </div>
            </div>

            {/* Arrays */}
             {["allowances", "deductions", "terminalBenefits"].map((section) => (
              <div key={section} className="bg-gray-50 p-3 border rounded">
                <h4 className="font-semibold">
                  {section.replace(/([A-Z])/g, " $1").toUpperCase()}
                </h4>

                {(editRoleId === role._id
                  ? (formData[section] || [])
                  : (role.salaryRules[section] || [])
                ).map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center mt-2">
                    {editRoleId === role._id ? (
                      <>
                        <input
                          type="text"
                          className="border rounded px-2 py-1 w-40"
                          value={item.name}
                          placeholder="Name"
                          onChange={(e) =>
                            handleInputChange(section, idx, "name", e.target.value)
                          }
                        />

                        <select
                          className="border rounded px-2 py-1 w-32"
                          value={item.type}
                          onChange={(e) =>
                            handleInputChange(section, idx, "type", e.target.value)
                          }
                        >
                          <option value="fixed">Fixed</option>
                          <option value="percentage">Percentage</option>
                        </select>

                        <input
                          type="number"
                          className="border rounded px-2 py-1 w-24"
                          value={item.value}
                          onChange={(e) =>
                            handleInputChange(section, idx, "value", e.target.value)
                          }
                        />

                        <button
                          className="bg-red-500 text-white px-2 py-1 rounded"
                          onClick={() => removeBenefit(section, idx)}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <p>
                        {item.name} — {item.type} — {item.value}
                      </p>
                    )}
                  </div>
                ))}

                {/* Add Button */}
                {editRoleId === role._id && (
                  <button
                    className="bg-blue-600 text-white px-3 py-1 rounded mt-2"
                    onClick={() => addBenefit(section)}
                  >
                    + Add
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Create Button */}
        <button
          onClick={handleCreate}
          className="bg-green-700 text-white px-4 py-2 rounded"
        >
          + Create New Role
        </button>
      </div>
    </div>
  );
}
