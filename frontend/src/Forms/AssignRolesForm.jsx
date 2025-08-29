import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import api from "../api/axios.js";
import { assignRolesDraft } from "../store/sliceRoles.jsx";
import { addDraft, addEmployeeData } from "../store/sliceDraft.jsx";

const AssignRolesForm = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [hierarchy, setHierarchy] = useState({ offices: [] });
  const [loading, setLoading] = useState(false);
  const [employeeError, setEmployeeError] = useState(null);
  const [actionModal, setActionModal] = useState({ type: null, level: "", name: "", parentId: null, open: false });
  const [actionLoading, setActionLoading] = useState(false);

  const employeeData = useSelector((state) => state.draft.employeeData);
  const [employee, setEmployee] = useState(null);
  const [roleDropdown, setRoleDropdown] = useState("");
  const [allPermissions, setAllPermissions] = useState([]);

  const [office, setOffice] = useState("");
  const [group, setGroup] = useState("");
  const [division, setDivision] = useState("");
  const [department, setDepartment] = useState("");
  const [branch, setBranch] = useState("");
  const [cell, setCell] = useState("");
  const [desk, setDesk] = useState("");

  const levelOrder = ["office", "group", "division", "department", "branch", "cell", "desk"];
  const backendLevels = {
    office: "offices",
    group: "groups",
    division: "divisions",
    department: "departments",
    branch: "branches",
    cell: "cells",
    desk: "desks"
  };

  // ---------------- Fetch Hierarchy ----------------
  const fetchHierarchy = async () => {
    try {
      setLoading(true);
      const res = await api.get("/hierarchy/get-hierarchy");
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

  // ---------------- Fetch Employee ----------------
  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await api.get(`/employees/${employeeId}`);
        if (res.data?.employee) {
          setEmployee(res.data.employee);
          dispatch(addEmployeeData({ employeeData: res.data.employee }));
        } else setEmployeeError("No employee found. Please create one first.");
      } catch (err) {
        console.error(err);
        setEmployeeError("Failed to fetch employee data.");
      }
    };
    if (employeeId) fetchEmployee();
  }, [employeeId, dispatch]);

  useEffect(() => {
    fetchHierarchy();
  }, []);

  // ---------------- Reset Dependent Fields ----------------
  const resetDependentFields = (level) => {
    const index = levelOrder.indexOf(level);
    if (index === -1) return;
    for (let i = index + 1; i < levelOrder.length; i++) {
      const setter = { office: setOffice, group: setGroup, division: setDivision, department: setDepartment, branch: setBranch, cell: setCell, desk: setDesk }[levelOrder[i]];
      setter("");
    }
  };

  // ---------------- Dynamic Hierarchy Options ----------------
  const path = { office, group, division, department, branch, cell, desk };

  const getOptionsForLevel = (level) => {
    let current = hierarchy.offices;
    if (!current || current.length === 0) return [];

    for (const l of levelOrder) {
      if (l === level) break;
      const selected = path[l];
      if (!selected) return [];
      current = current.find(n => n.name === selected);
      if (!current) return [];
      current = current.groups || current.divisions || current.departments || current.branches || current.cells || current.desks || [];
    }
    return current;
  };

  const getParentOptions = (level) => {
    if (level === "office") return [];
    return getOptionsForLevel(levelOrder[levelOrder.indexOf(level) - 1]);
  };

  // ---------------- Centralized Create Node ----------------
  const submitCreate = async (name, level, parentId) => {
    if (!name || !level) return alert("Enter name and select level");
    setActionLoading(true);
    try {
      const res = await api.post("/hierarchy/createNode", { level, name, parentId: parentId || null });
      if (res.data.success) {
        alert(`${level} created successfully`);
        await fetchHierarchy();
        setActionModal({ type: null, open: false });
      }
    } catch (err) {
      console.error(err);
      alert("Failed to create node");
    } finally {
      setActionLoading(false);
    }
  };

  // ---------------- Handle Form Submit ----------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeData) return alert("No employee found");
    try {
      setLoading(true);
      const orgUnitRes = await api.post("/org-units/resolve", { office, group, division, department, branch, cell, desk });
      const orgUnitId = orgUnitRes.data?.orgUnitId;
      if (!orgUnitId) throw new Error("OrgUnit resolution failed");
      const rolesData = { employeeId: employeeData._id, roleName: roleDropdown, orgUnit: orgUnitId, permissions: allPermissions };
      dispatch(assignRolesDraft(rolesData));
      dispatch(addDraft());
      await api.post("/employees/roles", rolesData);
      navigate("/DraftDashboard");
    } catch (err) {
      console.error(err);
      alert("Failed to save draft.");
    } finally { setLoading(false); }
  };

  const handleCancel = () => navigate("/DraftDashboard");

  if (loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if (employeeError) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <h2 className="text-xl text-red-600 mb-4">{employeeError}</h2>
      <button onClick={() => navigate("/admin/dashboard")} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-2">Admin Dashboard</button>
      <button onClick={() => navigate("/register-employee")} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create New Employee</button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-8 bg-white shadow-md rounded-xl space-y-6 border-t-4 border-blue-600">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-blue-600">Assign Roles</h2>
        <p className="text-gray-600">Employee: <span className="font-semibold">{employee?.individualName || "N/A"}</span></p>
        <p className="text-gray-600">ID: <span className="font-semibold">{employee?._id || "N/A"}</span></p>
      </div>

      {/* Role Dropdown */}
      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2">
          <label className="w-36 font-semibold">Role</label>
          <select className="flex-1 border shadow-sm rounded px-3 py-2" value={roleDropdown} onChange={e => setRoleDropdown(e.target.value)}>
            <option value="">Select Role</option>
            {["Chairman","BoD Member","Company Secretary","Group Head","Division Head","Department Head","Branch Manager","Officer","Manager","Senior Manager","Cell Incharge","Executive (Contract)","Executive (Permanent)","Senior Group Head"].map(role => <option key={role} value={role}>{role}</option>)}
          </select>
        </div>
      </div>

      {/* Permissions Selector */}
      <div className="flex flex-col gap-2">
        <label className="font-semibold">Permissions</label>
        <select value="" onChange={e => { const val = e.target.value; if(val && !allPermissions.includes(val)) setAllPermissions([...allPermissions,val]); }} className="border rounded px-3 py-2 w-full">
          <option value="">Select Permission</option>
          {["view_all_employees","view_single_employee","register_employee","approve_employee","reject_employee","delete_employee","assign_employee_role","view_all_roles","resolve_org_unit","create_org_unit","view_org_units","view_employees_by_org_unit","view_all_finalized_employees"].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="flex flex-wrap gap-2 mt-2">
          {allPermissions.map(p => (
            <span key={p} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
              {p} <span onClick={() => setAllPermissions(allPermissions.filter(x => x !== p))} className="cursor-pointer font-bold">×</span>
            </span>
          ))}
        </div>
      </div>

      {/* Hierarchy Dropdowns */}
      {levelOrder.map(level => {
        const value = path[level];
        const setValue = {office:setOffice, group:setGroup, division:setDivision, department:setDepartment, branch:setBranch, cell:setCell, desk:setDesk}[level];
        const options = getOptionsForLevel(level);
        return (
          <div key={level} className="flex flex-col gap-2 mt-3">
            <div className="flex items-center gap-2">
              <label className="w-36 font-semibold">{level.charAt(0).toUpperCase() + level.slice(1)}</label>
              <select className="flex-1 border shadow-sm rounded px-3 py-2" value={value} onChange={e => { setValue(e.target.value); resetDependentFields(level); }}>
                <option value="">Select {level}</option>
                {options.map(opt => <option key={opt._id} value={opt.name}>{opt.name}</option>)}
              </select>
              {value && (
                <button type="button" className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" onClick={async () => {
                  if (!window.confirm(`Delete ${level} "${value}"?`)) return;
                  try {
                    const nodeToDelete = options.find(o => o.name === value);
                    if (!nodeToDelete) return;
                    await api.delete(`/hierarchy/deleteNode/${nodeToDelete._id}`);
                    alert(`${level} deleted`);
                    setValue("");
                    fetchHierarchy();
                  } catch(err) { console.error(err); alert("Failed to delete"); }
                }}>Delete</button>
              )}
            </div>
          </div>
        );
      })}

      {/* Centralized Create Node */}
      <div className="mt-6">
        <button type="button" onClick={() => setActionModal({ type: "create", name: "", level: "", parentId: null, open: true })} className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700">
          Create Hierarchy Node
        </button>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-4">
        <button type="button" onClick={handleCancel} className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">Cancel</button>
        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
      </div>

      {/* Action Modal */}
      {actionModal.open && actionModal.type === "create" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 shadow-lg">
            <h3 className="text-lg font-bold mb-3">Create Node</h3>
            <select className="w-full border rounded px-3 py-2 mb-3" value={actionModal.level} onChange={e => setActionModal({ ...actionModal, level: e.target.value, parentId: null })}>
              <option value="">Select Level</option>
              {levelOrder.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            {actionModal.level && actionModal.level !== "office" && (
              <select className="w-full border rounded px-3 py-2 mb-3" value={actionModal.parentId || ""} onChange={e => setActionModal({ ...actionModal, parentId: e.target.value })}>
                <option value="">Select Parent</option>
                {getParentOptions(actionModal.level).map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            )}
            <input type="text" className="w-full border rounded px-3 py-2 mb-3" value={actionModal.name} onChange={e => setActionModal({ ...actionModal, name: e.target.value })} placeholder="Enter name"/>
            <div className="flex justify-end gap-3">
              <button onClick={() => setActionModal({ type: null, open: false })} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancel</button>
              <button onClick={() => submitCreate(actionModal.name, backendLevels[actionModal.level], actionModal.parentId)} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Create</button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

export default AssignRolesForm;
