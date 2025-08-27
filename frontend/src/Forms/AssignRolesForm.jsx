import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import api from "../api/axios.js";

// Redux actions
import { assignRolesDraft } from "../store/sliceRoles.jsx";
import {
  addRolesData,
  addDraft,
  updateDraft,
  cancelEdit,
  addEmployeeData,
} from "../store/sliceDraft.jsx";
import axios from "axios";

const AssignRolesForm = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [office, setOffice] = useState("");
  const [group, setGroup] = useState("");
  const [division, setDivision] = useState("");
  const [department, setDepartment] = useState("");
  const [branch, setBranch] = useState("");
  const [cell, setCell] = useState("");
  const [desk, setDesk] = useState("");
  const [role_dropdown, setRoleDropdown] = useState("");
  const [allPermissions, setAllPermissions] = useState([]);

  const [loading, setLoading] = useState(false);
  const [hierarchy, setHierarchy] = useState({ offices: [] });
  const [employeeError, setEmployeeError] = useState(null);

  const employeeData = useSelector((state) => state.draft.employeeData);
  const editingDraft = useSelector((state) => state.draft.editingDraft);
  const isEditing = !!editingDraft;

  const [employee, setEmployee] = useState("");
  const [roles, setRoles] = useState("");

  // Available permissions
  const availablePermissions = [
    "view_all_employees",
    "view_single_employee",
    "register_employee",
    "approve_employee",
    "reject_employee",
    "delete_employee",
    "assign_employee_role",
    "view_all_roles",
    "resolve_org_unit",
    "create_org_unit",
    "view_org_units",
    "view_employees_by_org_unit",
    "view_all_finalized_employees",
  ];

  // Fetch Employee
  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await api.get(`/employees/${employeeId}`);
        // const res = await axios.get(`/employees/${employeeId}`);
        if (res.data?.employee) {
          setEmployee(res.data.employee);
          dispatch(addEmployeeData({ employeeData: res.data.employee }));
        } else {
          setEmployeeError("No employee found. Please create one first.");
        }
      } catch (err) {
        console.error("Error fetching employee:", err);
        setEmployeeError("Failed to fetch employee data.");
      }
    };
    if (employeeId) fetchEmployee();
  }, [employeeId, dispatch]);

  // Fetch Roles
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await api.get(`/roles/${employeeId}`);
        // const res = await axios.get(`/roles/${employeeId}`);
        if (res.data?.roles) {
          setRoles(res.data.roles);
          dispatch(addRolesData({ rolesData: res.data.roles }));
        } else {
          setRoles([]);
        }
      } catch (err) {
        console.warn("No roles found yet.");
        setRoles([]);
      }
    };
    if (employeeId) fetchRoles();
  }, [employeeId, dispatch]);

  // Fetch hierarchy
  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        setLoading(true);
        const res = await api.get("/hierarchy/get-hierarchy");
        // const res = await axios.get("http://localhost:3000/api/hierarchy/get-hierarchy");
        if (res.data?.data?.offices) setHierarchy(res.data.data);
        else if (Array.isArray(res.data?.data)) setHierarchy({ offices: res.data.data });
        else setHierarchy({ offices: [] });
      } catch (err) {
        console.error("Error fetching hierarchy:", err);
        setHierarchy({ offices: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchHierarchy();
  }, []);

  // Prefill when editing draft
  useEffect(() => {
    if (editingDraft?.roles?.role) {
      const { office, group, division, department, branch, cell, desk } = editingDraft.roles.role;
      setOffice(office || "");
      setGroup(group || "");
      setDivision(division || "");
      setDepartment(department || "");
      setBranch(branch || "");
      setCell(cell || "");
      setDesk(desk || "");
      setAllPermissions(editingDraft.roles.permissions || []);
    }
  }, [editingDraft]);

  // Reset dependent dropdowns
  const resetDependentFields = (level) => {
    if (level === "office") { setGroup(""); setDivision(""); setDepartment(""); setBranch(""); setCell(""); setDesk(""); }
    else if (level === "group") { setDivision(""); setDepartment(""); setBranch(""); setCell(""); setDesk(""); }
    else if (level === "division") { setDepartment(""); setBranch(""); setCell(""); setDesk(""); }
    else if (level === "department") { setBranch(""); setCell(""); setDesk(""); }
    else if (level === "branch") { setCell(""); setDesk(""); }
    else if (level === "cell") { setDesk(""); }
  };

  // Role options
  const rolesOptions = [
    { id: 1, name: "Chairman" }, { id: 2, name: "BoD Member" },
    { id: 3, name: "Company Secretary" }, { id: 4, name: "Group Head" },
    { id: 5, name: "Divison Head"}, { id: 6, name: "Department Head"},
    { id: 7, name: "Branch Manager" }, { id: 8, name: "Officer" },
    { id: 9, name: "Manager"}, { id: 10, name: "Senior Manager"},
    { id: 11, name: "Cell Incharge" }, { id: 12, name: "Executive (Contract)" },
    { id: 13, name: "Executive (Permanent)" }, { id: 14, name: "Senior Group Head" },
  ];

  // Derived hierarchy options
  const officesOptions = hierarchy?.offices || [];
  const groupsOptions = officesOptions.find((o) => o.name === office)?.groups || [];
  const divisionsOptions = [
    ...(groupsOptions.find((g) => g.name === group)?.divisions || []),
    ...(officesOptions.find((o) => o.name === office)?.divisions || []),
  ];
  const departmentsOptions = [
    ...(divisionsOptions.find((d) => d.name === division)?.departments || []),
    ...(officesOptions.find((o) => o.name === office)?.departments || []),
  ];
  const branchesOptions = [
    ...(departmentsOptions.find((d) => d.name === department)?.branches || []),
    ...(officesOptions.find((o) => o.name === office)?.branches || []),
  ];
  const cellsOptions = [
    ...(branchesOptions.find((b) => b.name === branch)?.cells || []),
    ...(departmentsOptions.find((d) => d.name === department)?.cells || []),
    ...(divisionsOptions.find((d) => d.name === division)?.cells || []),
    ...(officesOptions.find((o) => o.name === office)?.cells || []),
  ];
  const desksOptions = [
    ...(cellsOptions.find((c) => c.name === cell)?.desks || []),
    ...(branchesOptions.find((b) => b.name === branch)?.desks || []),
    ...(departmentsOptions.find((d) => d.name === department)?.desks || []),
    ...(divisionsOptions.find((d) => d.name === division)?.desks || []),
    ...(officesOptions.find((o) => o.name === office)?.desks || []),
  ];

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeData) return alert("No employee found. Please create one first.");
    try {
      setLoading(true);

      const orgUnitRes = await api.post("/org-units/resolve", {
        office, group, division, department, branch, cell, desk
      });
      const orgUnitId = orgUnitRes.data?.orgUnitId;
      if (!orgUnitId) throw new Error("OrgUnit resolution failed");

      const rolesData = {
        employeeId: employeeData._id,
        roleName: role_dropdown,
        orgUnit: orgUnitId,
        permissions: allPermissions,
      };

      if (isEditing) dispatch(updateDraft({ draftId: editingDraft.draftId, roles: rolesData }));
      else {
        dispatch(assignRolesDraft(rolesData));
        dispatch(addDraft());
        await api.post("/employees/roles", rolesData);
      }

      navigate("/DraftDashboard");
    } catch (err) {
      console.error(err);
      alert("Failed to save draft.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (isEditing) dispatch(cancelEdit());
    navigate("/DraftDashboard");
  };

  if (loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if (employeeError) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <h2 className="text-xl text-red-600 mb-4">{employeeError}</h2>
      <button onClick={() => navigate("/admin/dashboard")} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Admin Dashboard</button>
      <button onClick={() => navigate("/register-employee")} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create New Employee</button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-6 bg-white shadow rounded-lg space-y-4">
      <h2 className="text-xl font-semibold text-gray-700 mb-4">Assign Role</h2>
      <div className="flex flex-row gap-12 font-bold text-blue-600">
        <h2>Name: {employee?.individualName || "N/A"}</h2>
        <h2>Database ID: {employee?._id || "N/A"}</h2>
      </div>

      {/* Role dropdown */}
      <Dropdown label="Role" value={role_dropdown} onChange={setRoleDropdown} options={rolesOptions} />

      {/* Permissions multi-select dropdown */}
      <MultiSelectDropdown
        label="Permissions"
        options={availablePermissions}
        selected={allPermissions}
        setSelected={setAllPermissions}
      />

      {/* Hierarchy Dropdowns */}
      <Dropdown label="Office" value={office} onChange={(val) => { setOffice(val); resetDependentFields("office"); }} options={officesOptions} />
      <Dropdown label="Group" value={group} onChange={(val) => { setGroup(val); resetDependentFields("group"); }} options={groupsOptions} />
      <Dropdown label="Division" value={division} onChange={(val) => { setDivision(val); resetDependentFields("division"); }} options={divisionsOptions} />
      <Dropdown label="Department" value={department} onChange={(val) => { setDepartment(val); resetDependentFields("department"); }} options={departmentsOptions} />
      <Dropdown label="Branch" value={branch} onChange={(val) => { setBranch(val); resetDependentFields("branch"); }} options={branchesOptions} />
      <Dropdown label="Cell" value={cell} onChange={(val) => { setCell(val); resetDependentFields("cell"); }} options={cellsOptions} />
      <Dropdown label="Desk" value={desk} onChange={setDesk} options={desksOptions} />

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4">
        <button type="button" onClick={handleCancel} className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400">Cancel</button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
      </div>
    </form>
  );
};

// Basic Dropdown component
const Dropdown = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-gray-600 mb-1">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500">
      <option value="">Select {label}</option>
      {options.map((opt) => (
        <option key={opt._id || opt.name} value={opt.name}>{opt.name}</option>
      ))}
    </select>
  </div>
);

// MultiSelect dropdown
const MultiSelectDropdown = ({ label, options, selected, setSelected }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (opt) => {
    if (selected.includes(opt)) setSelected(selected.filter((s) => s !== opt));
    else setSelected([...selected, opt]);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-gray-600 mb-1">{label}</label>
      <div onClick={() => setOpen(!open)} className="border border-gray-300 rounded-lg p-2 cursor-pointer flex flex-wrap gap-1 min-h-[40px]">
        {selected.length === 0 && <span className="text-gray-400">Select permissions...</span>}
        {selected.map((s) => (
          <div key={s} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center gap-1">
            {s} <span onClick={(e) => { e.stopPropagation(); toggleOption(s); }} className="cursor-pointer font-bold text-red-500">×</span>
          </div>
        ))}
      </div>
      {open && (
        <div className="absolute z-10 bg-white border border-gray-300 mt-1 w-full max-h-60 overflow-y-auto rounded shadow">
          {options.map((opt) => (
            <div key={opt} onClick={() => toggleOption(opt)} className={`px-3 py-2 cursor-pointer hover:bg-blue-100 ${selected.includes(opt) ? "bg-blue-50" : ""}`}>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AssignRolesForm;
