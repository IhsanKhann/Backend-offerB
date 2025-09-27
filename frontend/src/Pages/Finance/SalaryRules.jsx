import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";
import SidebarNav from "../../components/Sidebar.jsx"; 
import { Table, SplitSquareVertical } from "lucide-react";

export default function SalaryRulesTable() {
  const [roles, setRoles] = useState([]);
  const [editRoleId, setEditRoleId] = useState(null);
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navItems = [
    { name: "Salary Dashboard", path: "/salary-dashboard"},
    { name: "All Summaries", path: "/summary-table"},
    { name: "Non-Business Tables", path: "/tables" },
    { name: "Business Breakup Tables", path: "/BussinessBreakupTables" },
    { name: "Salary Rules", path: "/salary/rulesTable" },
    { name: "Testing", path: "/paymentDashboard"},
  ];

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

  // Edit role
  const handleEdit = (role) => {
    setEditRoleId(role._id);
    setFormData(JSON.parse(JSON.stringify(role.salaryRules)));
  };

  const handleCancel = () => {
    setEditRoleId(null);
    setFormData(null);
  };

  // Input changes
  const handleInputChange = (section, index, field, value) => {
    const updated = { ...formData };
    if (section === "baseSalary" || section === "salaryType") {
      updated[section] = value;
    } else {
      updated[section][index][field] = field === "value" ? Number(value) : value;
    }
    setFormData(updated);
  };

  // Add/Remove benefit
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

  // Save edits
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

  // Create new role
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

  if (loading) return (
    <div className="flex min-h-screen">
      <SidebarNav title="Rules Navigation" navItems={navItems} />
      <div className="flex-1 p-6 text-center">Loading...</div>
    </div>
  );
  
  if (error) return (
    <div className="flex min-h-screen">
      <SidebarNav title="Rules Navigation" navItems={navItems} />
      <div className="flex-1 p-6 text-red-600">{error}</div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar - Fixed and Sticky */}
      <div className="sticky top-0 h-screen overflow-y-auto">
        <SidebarNav title="Rules Navigation" navItems={navItems} />
      </div>
      
      {/* Main Content - Grows and shrinks with sidebar */}
      <div className="flex-1 p-6 space-y-6 overflow-x-auto">
        <h2 className="text-xl font-semibold mb-2">Salary Rules Table</h2>
        
        {/* Explanation Note */}
        <div className="p-4 bg-yellow-100 border-l-4 border-yellow-400 text-yellow-800 rounded">
          <p>
            This dashboard shows the salary rules for each role. Each employee has an assigned role, 
            and each role has specific salary rules attached to it. When we pay the salary, these rules 
            are used to calculate allowances, deductions, terminal benefits, and other components 
            for the employees.
          </p>
        </div>
        
        {roles.map((role) => (
          <div key={role._id} className="border rounded-lg shadow-md bg-white p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">{role.name}</h3>
              <div className="flex gap-2">
                {editRoleId === role._id ? (
                  <>
                    <button
                      onClick={handleSave}
                      className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancel}
                      className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleEdit(role)}
                    disabled={editRoleId !== null}
                    className={`bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 ${
                      editRoleId !== null ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            {/* Base Salary & Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium">Base Salary</label>
                {editRoleId === role._id ? (
                  <input
                    type="number"
                    value={formData.baseSalary}
                    onChange={(e) => handleInputChange("baseSalary", null, null, e.target.value)}
                    className="border px-2 py-1 rounded w-full"
                  />
                ) : (
                  <p>PKR {role.salaryRules.baseSalary?.toLocaleString()}</p>
                )}
              </div>
              <div>
                <label className="block font-medium">Salary Type</label>
                {editRoleId === role._id ? (
                  <select
                    value={formData.salaryType}
                    onChange={(e) => handleInputChange("salaryType", null, null, e.target.value)}
                    className="border px-2 py-1 rounded w-full"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="hourly">Hourly</option>
                  </select>
                ) : (
                  <p>{role.salaryRules.salaryType}</p>
                )}
              </div>
            </div>

            {/* Allowances, Deductions, Terminal Benefits */}
            {["allowances", "deductions", "terminalBenefits"].map((section) => (
              <div key={section} className="border rounded-md p-3 bg-gray-50">
                <h4 className="font-semibold mb-2">
                  {section.charAt(0).toUpperCase() + section.slice(1)}
                </h4>
                {(editRoleId === role._id ? formData[section] : role.salaryRules[section])?.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center mb-1">
                    {editRoleId === role._id ? (
                      <>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleInputChange(section, idx, "name", e.target.value)}
                          placeholder="Name"
                          className="border px-2 py-1 rounded w-40"
                        />
                        <select
                          value={item.type}
                          onChange={(e) => handleInputChange(section, idx, "type", e.target.value)}
                          className="border px-2 py-1 rounded w-32"
                        >
                          <option value="fixed">Fixed</option>
                          <option value="percentage">Percentage</option>
                        </select>
                        <input
                          type="number"
                          value={item.value}
                          onChange={(e) => handleInputChange(section, idx, "value", e.target.value)}
                          placeholder="Value"
                          className="border px-2 py-1 rounded w-24"
                        />
                        <button
                          onClick={() => removeBenefit(section, idx)}
                          className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-sm"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <p>
                        {item.name} - {item.type} - {item.value}
                      </p>
                    )}
                  </div>
                ))}
                {editRoleId === role._id && (
                  <button
                    onClick={() => addBenefit(section)}
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm mt-1"
                  >
                    + Add
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}

        <button
          onClick={handleCreate}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          + Create New Role
        </button>
      </div>
    </div>
  );
}