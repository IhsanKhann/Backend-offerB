import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { Plus, Trash2, X } from "lucide-react";

const emptySalaryComponent = { name: "", type: "fixed", value: 0 };

export default function RoleManager() {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);

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

  const [employeeId, setEmployeeId] = useState("");
  const [departmentCode, setDepartmentCode] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");
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
  }, []);

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
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update role");
    }
  };

  const deleteRole = async (id) => {
    try {
      await api.delete(`/roles/deleteRole/${id}`);
      fetchRoles();
    } catch {
      setError("Failed to delete role");
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

  /* ================= ASSIGN ================= */

  const assignRole = async () => {
    if (!employeeId || !assignRoleId) return alert("Missing fields");

    await api.post("/roles/assign", {
      employeeId,
      roleId: assignRoleId,
      departmentCode,
    });

    setEmployeeId("");
    setDepartmentCode("");
    setAssignRoleId("");
    alert("Role assigned");
  };

  /* ================= UI ================= */

  if (loading) return <div className="p-10">Loading...</div>;
  if (error) return <div className="p-10 text-red-600">{error}</div>;

  return (
    <div className="p-6 bg-gray-100 min-h-screen space-y-6">
      
      <div className="flex-col"> 
        <h1 className="text-3xl font-bold">Role Manager</h1>
        <p className="text-sm bg-gray-100 text-red-600"> Double click on a role for updating it </p>  
      </div>
      
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* ROLE LIST */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-3">Roles</h2>
          {roles.map((r) => (
            <div key={r._id} className="flex justify-between p-2 border rounded mb-2">
              <span onClick={() => fetchRoleById(r._id)} className="cursor-pointer">
                {r.roleName}
              </span>
              <Trash2 className="text-red-600 cursor-pointer" size={16} onClick={() => deleteRole(r._id)} />
            </div>
          ))}
        </div>

        {/* ROLE FORM */}
        <div className="bg-white p-4 rounded shadow space-y-3">
          <h2 className="font-semibold">{selectedRole ? "Edit Role" : "Add Role"}</h2>

          <input className="border p-2 w-full" placeholder="Role Name"
            value={form.roleName}
            onChange={(e) => setForm({ ...form, roleName: e.target.value })}
          />

          <textarea className="border p-2 w-full" placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <input className="border p-2 w-full" type="number" placeholder="Base Salary"
            value={form.salaryRules.baseSalary}
            onChange={(e) =>
              setForm({
                ...form,
                salaryRules: { ...form.salaryRules, baseSalary: e.target.value },
              })
            }
          />

          <select className="border p-2 w-full"
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
              <div className="font-medium capitalize">{key}</div>
              {form.salaryRules[key].map((item, i) => (
                <div key={i} className="flex gap-2 mt-2">
                  <input className="border p-1 flex-1" placeholder="Name"
                    value={item.name}
                    onChange={(e) => updateComponent(key, i, "name", e.target.value)}
                  />
                  <select className="border p-1"
                    value={item.type}
                    onChange={(e) => updateComponent(key, i, "type", e.target.value)}
                  >
                    <option value="fixed">Fixed</option>
                    <option value="percentage">%</option>
                  </select>
                  <input type="number" className="border p-1 w-24"
                    value={item.value}
                    onChange={(e) => updateComponent(key, i, "value", Number(e.target.value))}
                  />
                  <X size={16} className="cursor-pointer" onClick={() => removeComponent(key, i)} />
                </div>
              ))}
              <button className="text-blue-600 text-sm mt-2" onClick={() => addComponent(key)}>
                + Add
              </button>
            </div>
          ))}

          <button
            onClick={selectedRole ? updateRole : createRole}
            className="bg-blue-600 text-white py-2 px-2 rounded"
          >
            {selectedRole ? "Update Role" : "Create Role"}
          </button>
        </div>
      </div>
    </div>
  );
}
