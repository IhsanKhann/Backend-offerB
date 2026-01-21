import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { Plus, Trash2, X, Users, Grid, List, ChevronDown, ChevronRight, Building2, UserCircle } from "lucide-react";

const emptySalaryComponent = { name: "", type: "fixed", value: 0 };

export default function AdvancedRoleManager() {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [viewMode, setViewMode] = useState("list"); // list, grid, grouped, employees
  const [groupedData, setGroupedData] = useState([]);
  const [selectedRoleForEmployees, setSelectedRoleForEmployees] = useState(null);
  const [employeesByRole, setEmployeesByRole] = useState([]);
  const [expandedRoles, setExpandedRoles] = useState(new Set());

  const [form, setForm] = useState({
    roleName: "",
    description: "",
    category: "Staff",
    salaryRules: {
      baseSalary: "",
      salaryType: "monthly",
      allowances: [],
      deductions: [],
      terminalBenefits: [],
    },
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ================= FETCH ================= */

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const res = await api.get("/roles/getAllRolesList");
      setRoles(res.data?.Roles || []);
      setError(null);
    } catch (err) {
      setError("Failed to load roles");
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupedAssignments = async () => {
    try {
      const res = await api.get("/roles/assignments/grouped");
      setGroupedData(res.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch grouped assignments:", err);
      setGroupedData([]);
    }
  };

  const fetchEmployeesByRole = async (roleId) => {
    try {
      const res = await api.get(`/roles/assignments/employees/${roleId}`);
      setEmployeesByRole(res.data?.departments || []);
      setSelectedRoleForEmployees(roleId);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
      setEmployeesByRole([]);
    }
  };

  const fetchRoleById = async (id) => {
    try {
      const res = await api.get(`/roles/${id}`);
      const role = res.data.role;

      setSelectedRole(role);
      setForm({
        roleName: role.roleName || "",
        description: role.description || "",
        category: role.category || "Staff",
        salaryRules: {
          baseSalary: role.salaryRules?.baseSalary ?? "",
          salaryType: role.salaryRules?.salaryType || "monthly",
          allowances: role.salaryRules?.allowances || [],
          deductions: role.salaryRules?.deductions || [],
          terminalBenefits: role.salaryRules?.terminalBenefits || [],
        },
      });
    } catch {
      setError("Failed to fetch role details");
    }
  };

  useEffect(() => {
    fetchRoles();
    if (viewMode === "grouped") {
      fetchGroupedAssignments();
    }
  }, [viewMode]);

  /* ================= SALARY HELPERS ================= */

  const addComponent = (key) => {
    setForm({
      ...form,
      salaryRules: {
        ...form.salaryRules,
        [key]: [...form.salaryRules[key], { ...emptySalaryComponent }],
      },
    });
  };

  const updateComponent = (key, index, field, value) => {
    const updated = [...form.salaryRules[key]];
    updated[index][field] = value;

    setForm({
      ...form,
      salaryRules: { ...form.salaryRules, [key]: updated },
    });
  };

  const removeComponent = (key, index) => {
    const updated = [...form.salaryRules[key]];
    updated.splice(index, 1);

    setForm({
      ...form,
      salaryRules: { ...form.salaryRules, [key]: updated },
    });
  };

  /* ================= CRUD ================= */

  const createRole = async () => {
    try {
      await api.post("/roles/addRole", {
        ...form,
        salaryRules: {
          ...form.salaryRules,
          baseSalary: Number(form.salaryRules.baseSalary),
        },
      });

      resetForm();
      fetchRoles();
      if (viewMode === "grouped") fetchGroupedAssignments();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create role");
    }
  };

  const updateRole = async () => {
    try {
      await api.put(`/roles/${selectedRole._id}`, {
        ...form,
        salaryRules: {
          ...form.salaryRules,
          baseSalary: Number(form.salaryRules.baseSalary),
        },
      });

      resetForm();
      fetchRoles();
      if (viewMode === "grouped") fetchGroupedAssignments();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update role");
    }
  };

  const deleteRole = async (id) => {
    if (!window.confirm("Are you sure? This will fail if there are active assignments.")) return;
    
    try {
      await api.delete(`/roles/deleteRole/${id}`);
      fetchRoles();
      if (viewMode === "grouped") fetchGroupedAssignments();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete role");
    }
  };

  const resetForm = () => {
    setSelectedRole(null);
    setForm({
      roleName: "",
      description: "",
      category: "Staff",
      salaryRules: {
        baseSalary: "",
        salaryType: "monthly",
        allowances: [],
        deductions: [],
        terminalBenefits: [],
      },
    });
  };

  /* ================= VIEW TOGGLES ================= */

  const toggleRoleExpansion = (roleId) => {
    const newExpanded = new Set(expandedRoles);
    if (newExpanded.has(roleId)) {
      newExpanded.delete(roleId);
    } else {
      newExpanded.add(roleId);
      fetchEmployeesByRole(roleId);
    }
    setExpandedRoles(newExpanded);
  };

  /* ================= RENDERERS ================= */

  const renderListView = () => (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="font-semibold mb-3 text-lg">All Roles ({roles.length})</h2>
      <div className="space-y-2">
        {roles.map((r) => (
          <div key={r._id} className="flex justify-between items-center p-3 border rounded hover:bg-gray-50">
            <div className="flex-1 cursor-pointer" onClick={() => fetchRoleById(r._id)}>
              <div className="font-medium">{r.roleName}</div>
              <div className="text-sm text-gray-500">
                Category: {r.category} • Base Salary: ${r.salaryRules?.baseSalary || 0}
              </div>
            </div>
            <Trash2 
              className="text-red-600 cursor-pointer hover:text-red-800" 
              size={18} 
              onClick={(e) => {
                e.stopPropagation();
                deleteRole(r._id);
              }} 
            />
          </div>
        ))}
      </div>
    </div>
  );

  const renderGridView = () => (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="font-semibold mb-3 text-lg">All Roles ({roles.length})</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((r) => (
          <div 
            key={r._id} 
            className="border rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer relative group"
            onClick={() => fetchRoleById(r._id)}
          >
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 
                className="text-red-600 hover:text-red-800" 
                size={16} 
                onClick={(e) => {
                  e.stopPropagation();
                  deleteRole(r._id);
                }} 
              />
            </div>
            <div className="flex items-start gap-3">
              <UserCircle size={40} className="text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{r.roleName}</h3>
                <p className="text-xs text-gray-500 mt-1">{r.description || "No description"}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    {r.category}
                  </span>
                  <span className="text-xs text-gray-600">
                    ${r.salaryRules?.baseSalary || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderGroupedView = () => (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="font-semibold mb-3 text-lg">Roles with Assignments</h2>
      <div className="space-y-4">
        {groupedData.map((item) => (
          <div key={item.roleId} className="border rounded-lg overflow-hidden">
            <div 
              className="bg-gray-50 p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100"
              onClick={() => toggleRoleExpansion(item.roleId)}
            >
              <div className="flex items-center gap-3">
                {expandedRoles.has(item.roleId) ? (
                  <ChevronDown size={20} />
                ) : (
                  <ChevronRight size={20} />
                )}
                <div>
                  <h3 className="font-semibold">{item.role.roleName}</h3>
                  <p className="text-sm text-gray-600">
                    {item.totalAssignments} assignment{item.totalAssignments !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  {item.role.category}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fetchRoleById(item.roleId);
                  }}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Edit
                </button>
              </div>
            </div>
            
            {expandedRoles.has(item.roleId) && selectedRoleForEmployees === item.roleId && (
              <div className="p-4 bg-white">
                {employeesByRole.length === 0 ? (
                  <p className="text-gray-500 text-sm">No employees assigned yet</p>
                ) : (
                  <div className="space-y-3">
                    {employeesByRole.map((dept) => (
                      <div key={dept.departmentCode || 'org-wide'} className="border-l-4 border-blue-500 pl-4">
                        <div className="font-medium text-sm text-gray-700 mb-2">
                          {dept.departmentCode || 'Organization-wide'} ({dept.totalEmployees})
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {dept.employees.map((emp) => (
                            <div key={emp.employeeId} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
                              <Users size={14} className="text-gray-400" />
                              <div>
                                <div className="font-medium">{emp.name}</div>
                                <div className="text-xs text-gray-500">{emp.email}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  /* ================= MAIN UI ================= */

  if (loading) return <div className="p-10 flex justify-center">Loading...</div>;
  if (error && roles.length === 0) return <div className="p-10 text-red-600">{error}</div>;

  return (
    <div className="p-6 bg-gray-100 min-h-screen space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Role Manager</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage global role declarations and view assignments
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("list")}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              viewMode === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-700"
            }`}
          >
            <List size={18} />
            List
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              viewMode === "grid" ? "bg-blue-600 text-white" : "bg-white text-gray-700"
            }`}
          >
            <Grid size={18} />
            Grid
          </button>
          <button
            onClick={() => setViewMode("grouped")}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              viewMode === "grouped" ? "bg-blue-600 text-white" : "bg-white text-gray-700"
            }`}
          >
            <Building2 size={18} />
            Grouped
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* ROLE LIST/GRID/GROUPED */}
        <div className="md:col-span-2">
          {viewMode === "list" && renderListView()}
          {viewMode === "grid" && renderGridView()}
          {viewMode === "grouped" && renderGroupedView()}
        </div>

        {/* ROLE FORM */}
        <div className="bg-white p-4 rounded shadow space-y-3 h-fit">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-lg">
              {selectedRole ? "Edit Role" : "Add Role"}
            </h2>
            {selectedRole && (
              <button
                onClick={resetForm}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            )}
          </div>

          <input
            className="border p-2 w-full rounded"
            placeholder="Role Name *"
            value={form.roleName}
            onChange={(e) => setForm({ ...form, roleName: e.target.value })}
          />

          <textarea
            className="border p-2 w-full rounded"
            placeholder="Description"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <select
            className="border p-2 w-full rounded"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            <option value="Executive">Executive</option>
            <option value="Management">Management</option>
            <option value="Staff">Staff</option>
            <option value="Support">Support</option>
            <option value="Technical">Technical</option>
          </select>

          <input
            className="border p-2 w-full rounded"
            type="number"
            placeholder="Base Salary *"
            value={form.salaryRules.baseSalary}
            onChange={(e) =>
              setForm({
                ...form,
                salaryRules: { ...form.salaryRules, baseSalary: e.target.value },
              })
            }
          />

          <select
            className="border p-2 w-full rounded"
            value={form.salaryRules.salaryType}
            onChange={(e) =>
              setForm({
                ...form,
                salaryRules: { ...form.salaryRules, salaryType: e.target.value },
              })
            }
          >
            <option value="monthly">Monthly</option>
            <option value="hourly">Hourly</option>
          </select>

          {["allowances", "deductions", "terminalBenefits"].map((key) => (
            <div key={key} className="border p-2 rounded">
              <div className="font-medium capitalize text-sm mb-2">{key}</div>
              {form.salaryRules[key].map((item, i) => (
                <div key={i} className="flex gap-2 mt-2">
                  <input
                    className="border p-1 flex-1 text-sm rounded"
                    placeholder="Name"
                    value={item.name}
                    onChange={(e) => updateComponent(key, i, "name", e.target.value)}
                  />
                  <select
                    className="border p-1 text-sm rounded"
                    value={item.type}
                    onChange={(e) => updateComponent(key, i, "type", e.target.value)}
                  >
                    <option value="fixed">Fixed</option>
                    <option value="percentage">%</option>
                  </select>
                  <input
                    type="number"
                    className="border p-1 w-20 text-sm rounded"
                    value={item.value}
                    onChange={(e) =>
                      updateComponent(key, i, "value", Number(e.target.value))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => removeComponent(key, i)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-blue-600 text-sm mt-2 hover:text-blue-800"
                onClick={() => addComponent(key)}
              >
                + Add
              </button>
            </div>
          ))}

          <button
            onClick={selectedRole ? updateRole : createRole}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            {selectedRole ? "Update Role" : <><Plus size={18} /> Create Role</>}
          </button>
        </div>
      </div>
    </div>
  );
}