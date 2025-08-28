import React, { useEffect, useState } from "react";
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

const AssignRolesForm = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [hierarchy, setHierarchy] = useState({ offices: [] });
  const [loading, setLoading] = useState(false);
  const [employeeError, setEmployeeError] = useState(null);
  const [actionModal, setActionModal] = useState({ 
    type: null, 
    level: null, 
    name: "", 
    id: null, 
    parentId: null, 
    open: false 
  });
  const [actionLoading, setActionLoading] = useState(false);

  const employeeData = useSelector((state) => state.draft.employeeData);
  const editingDraft = useSelector((state) => state.draft.editingDraft);
  const isEditing = !!editingDraft;

  const [employee, setEmployee] = useState("");
  const [roles, setRoles] = useState("");

  const [office, setOffice] = useState("");
  const [group, setGroup] = useState("");
  const [division, setDivision] = useState("");
  const [department, setDepartment] = useState("");
  const [branch, setBranch] = useState("");
  const [cell, setCell] = useState("");
  const [desk, setDesk] = useState("");

  const [role_dropdown, setRoleDropdown] = useState("");
  const [allPermissions, setAllPermissions] = useState([]);

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

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await api.get(`/employees/${employeeId}`);
        if (res.data?.employee) {
          setEmployee(res.data.employee);
          dispatch(addEmployeeData({ employeeData: res.data.employee }));
        } else {
          setEmployeeError("No employee found. Please create one first.");
        }
      } catch (err) {
        console.error(err);
        setEmployeeError("Failed to fetch employee data.");
      }
    };

    const fetchRoles = async () => {
      try {
        const res = await api.get(`/roles/${employeeId}`);
        if (res.data?.roles) {
          setRoles(res.data.roles);
          dispatch(addRolesData({ rolesData: res.data.roles }));
        } else setRoles([]);
      } catch {
        setRoles([]);
      }
    };

    if (employeeId) {
      fetchEmployee();
      fetchRoles();
    }
  }, [employeeId, dispatch]);

  useEffect(() => { fetchHierarchy(); }, []);

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

  const resetDependentFields = (level) => {
    if (level === "office") {
      setGroup(""); setDivision(""); setDepartment(""); setBranch(""); setCell(""); setDesk("");
    } else if (level === "group") {
      setDivision(""); setDepartment(""); setBranch(""); setCell(""); setDesk("");
    } else if (level === "division") {
      setDepartment(""); setBranch(""); setCell(""); setDesk("");
    } else if (level === "department") {
      setBranch(""); setCell(""); setDesk("");
    } else if (level === "branch") {
      setCell(""); setDesk("");
    } else if (level === "cell") {
      setDesk("");
    }
  };

  const officesOptions = hierarchy?.offices || [];
  const groupsOptions = officesOptions.find(o => o.name === office)?.groups || [];
  const divisionsOptions = [
    ...(groupsOptions.find(g => g.name === group)?.divisions || []),
    ...(officesOptions.find(o => o.name === office)?.divisions || []),
  ];
  const departmentsOptions = [
    ...(divisionsOptions.find(d => d.name === division)?.departments || []),
    ...(officesOptions.find(o => o.name === office)?.departments || []),
  ];
  const branchesOptions = [
    ...(departmentsOptions.find(d => d.name === department)?.branches || []),
    ...(officesOptions.find(o => o.name === office)?.branches || []),
  ];
  const cellsOptions = [
    ...(branchesOptions.find(b => b.name === branch)?.cells || []),
    ...(departmentsOptions.find(d => d.name === department)?.cells || []),
    ...(divisionsOptions.find(d => d.name === division)?.cells || []),
    ...(officesOptions.find(o => o.name === office)?.cells || []),
  ];
  const desksOptions = [
    ...(cellsOptions.find(c => c.name === cell)?.desks || []),
    ...(branchesOptions.find(b => b.name === branch)?.desks || []),
    ...(departmentsOptions.find(d => d.name === department)?.desks || []),
    ...(divisionsOptions.find(d => d.name === division)?.desks || []),
    ...(officesOptions.find(o => o.name === office)?.desks || []),
  ];

  // Helper function to find ID by name in options
  const findIdByName = (options, name) => {
    const item = options.find(o => o.name === name);
    return item ? item._id : null;
  };

  const openCreateModal = (level) => {
    // Determine parent ID based on the current selections
    let parentId = null;
    
    if (level === "office") {
      parentId = null; // Offices are at root level
    } else if (level === "group") {
      parentId = findIdByName(officesOptions, office);
    } else if (level === "division") {
      parentId = findIdByName(groupsOptions, group) || findIdByName(officesOptions, office);
    } else if (level === "department") {
      parentId = findIdByName(divisionsOptions, division) || findIdByName(officesOptions, office);
    } else if (level === "branch") {
      parentId = findIdByName(departmentsOptions, department) || findIdByName(officesOptions, office);
    } else if (level === "cell") {
      parentId = findIdByName(branchesOptions, branch) || findIdByName(departmentsOptions, department) || 
                 findIdByName(divisionsOptions, division) || findIdByName(officesOptions, office);
    } else if (level === "desk") {
      parentId = findIdByName(cellsOptions, cell) || findIdByName(branchesOptions, branch) || 
                 findIdByName(departmentsOptions, department) || findIdByName(divisionsOptions, division) || 
                 findIdByName(officesOptions, office);
    }
    
    setActionModal({ 
      type: "create", 
      level, 
      name: "", 
      id: null, 
      parentId,
      open: true 
    });
  };

  const openEditModal = (level, options, value) => {
  if (!value) return alert(`Please select a ${level} first.`);
  const selected = options.find(o => o.name === value);
  if (!selected) return alert(`${level} not found in hierarchy.`);
  
  setActionModal({ 
    type: "edit", 
    level, 
    name: selected.name, 
    id: selected._id, 
    parentId: null,
    open: true 
  });
};

  const openDeleteModal = (level, options, value) => {
    const selected = options.find(o => o.name === value);
    if (!selected) return alert(`Select a ${level} to delete.`);
    
    setActionModal({ 
      type: "delete", 
      level, 
      name: selected.name, 
      id: selected._id, 
      parentId: null,
      open: true 
    });
  };

  const closeActionModal = () => setActionModal({ 
    type: null, 
    level: null, 
    name: "", 
    id: null, 
    parentId: null,
    open: false 
  });

  const buildPathForLevel = (level) => {
  const path = [];
  if(level === "group" && office) path.push({ level: "offices", id: findIdByName(officesOptions, office) });
  if(level === "division") {
    if(group) path.push({ level: "groups", id: findIdByName(groupsOptions, group) });
    else if(office) path.push({ level: "offices", id: findIdByName(officesOptions, office) });
  }
  if(level === "department") {
    if(division) path.push({ level: "divisions", id: findIdByName(divisionsOptions, division) });
    else if(office) path.push({ level: "offices", id: findIdByName(officesOptions, office) });
  }
  if(level === "branch") {
    if(department) path.push({ level: "departments", id: findIdByName(departmentsOptions, department) });
    else if(office) path.push({ level: "offices", id: findIdByName(officesOptions, office) });
  }
  if(level === "cell") {
    if(branch) path.push({ level: "branches", id: findIdByName(branchesOptions, branch) });
    else if(department) path.push({ level: "departments", id: findIdByName(departmentsOptions, department) });
    else if(division) path.push({ level: "divisions", id: findIdByName(divisionsOptions, division) });
    else if(office) path.push({ level: "offices", id: findIdByName(officesOptions, office) });
  }
  if(level === "desk") {
    if(cell) path.push({ level: "cells", id: findIdByName(cellsOptions, cell) });
    else if(branch) path.push({ level: "branches", id: findIdByName(branchesOptions, branch) });
    else if(department) path.push({ level: "departments", id: findIdByName(departmentsOptions, department) });
    else if(division) path.push({ level: "divisions", id: findIdByName(divisionsOptions, division) });
    else if(office) path.push({ level: "offices", id: findIdByName(officesOptions, office) });
  }
  return path;
};

  const submitCreate = async (name) => {
    try { 
      setActionLoading(true);
      await api.post("/hierarchy/createNode", { 
        level: actionModal.level, 
        name, 
        parentId: actionModal.parentId 
      });
      await fetchHierarchy(); 
      closeActionModal();
    } catch(err){ 
      console.error(err); 
      alert(err.response?.data?.message || "Create failed"); 
    } finally { 
      setActionLoading(false); 
    }
  };

  const submitEdit = async (name) => {
  if(!name) return alert("Name is required");
  try{ 
    setActionLoading(true);

    const path = buildPathForLevel(actionModal.level);

    await api.put(`/hierarchy/editNode/${actionModal.id}`, {
      updateData: { name },
      path,
      level: actionModal.level
    });

    await fetchHierarchy(); 
    closeActionModal();
  } catch(err){ 
    console.error(err); 
    alert(err.response?.data?.message || "Edit failed"); 
  } finally { 
    setActionLoading(false); 
  }
};

  const submitDelete = async () => {
    if(!confirm(`Delete ${actionModal.level} "${actionModal.name}"? This cannot be undone.`)) return;
    try{ 
      setActionLoading(true);
      await api.delete(`/hierarchy/deleteNode/${actionModal.id}`);
      await fetchHierarchy(); 
      closeActionModal();
      
      // Reset the form field if the deleted item was selected
      if (actionModal.level === "office" && office === actionModal.name) setOffice("");
      else if (actionModal.level === "group" && group === actionModal.name) setGroup("");
      else if (actionModal.level === "division" && division === actionModal.name) setDivision("");
      else if (actionModal.level === "department" && department === actionModal.name) setDepartment("");
      else if (actionModal.level === "branch" && branch === actionModal.name) setBranch("");
      else if (actionModal.level === "cell" && cell === actionModal.name) setCell("");
      else if (actionModal.level === "desk" && desk === actionModal.name) setDesk("");
    } catch(err){ 
      console.error(err); 
      alert(err.response?.data?.message || "Delete failed"); 
    } finally { 
      setActionLoading(false); 
    }
  };

  const debugHierarchy = async() => {
    // /debug-hierarchy
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!employeeData) return alert("No employee found. Please create one first.");
    try{
      setLoading(true);
      const orgUnitRes = await api.post("/org-units/resolve", { office, group, division, department, branch, cell, desk });
      const orgUnitId = orgUnitRes.data?.orgUnitId;
      if(!orgUnitId) throw new Error("OrgUnit resolution failed");

      const rolesData = {
        employeeId: employeeData._id,
        roleName: role_dropdown,
        orgUnit: orgUnitId,
        permissions: allPermissions,
      };

      if(isEditing) dispatch(updateDraft({ draftId: editingDraft.draftId, roles: rolesData }));
      else {
        dispatch(assignRolesDraft(rolesData));
        dispatch(addDraft());
        await api.post("/employees/roles", rolesData);
      }

      navigate("/DraftDashboard");
    } catch(err){ console.error(err); alert("Failed to save draft."); }
    finally { setLoading(false); }
  };
  
  const handleCancel = () => { 
    if(isEditing) dispatch(cancelEdit()); 
    navigate("/DraftDashboard"); 
  };

  if(loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if(employeeError) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <h2 className="text-xl text-red-600 mb-4">{employeeError}</h2>
      <button onClick={()=>navigate("/admin/dashboard")} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-2">Admin Dashboard</button>
      <button onClick={()=>navigate("/register-employee")} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create New Employee</button>
    </div>
  );

  // --------------------------- Render ---------------------------
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
          <select className="flex-1 border shadow-sm rounded px-3 py-2" value={role_dropdown} onChange={(e)=>setRoleDropdown(e.target.value)}>
            <option value="">Select Role</option>
            {[
              "Chairman","BoD Member","Company Secretary","Group Head","Division Head",
              "Department Head","Branch Manager","Officer","Manager","Senior Manager",
              "Cell Incharge","Executive (Contract)","Executive (Permanent)","Senior Group Head"
            ].map(role=><option key={role} value={role}>{role}</option>)}
          </select>
        </div>
      </div>

      {/* Permissions Selector */}
      <div className="flex flex-col gap-2">
        <label className="font-semibold">Permissions</label>
        <select value="" onChange={e => {
          const val = e.target.value;
          if(val && !allPermissions.includes(val)) setAllPermissions([...allPermissions,val]);
        }} className="border rounded px-3 py-2 w-full">
          <option value="">Select Permission</option>
          {[
            "view_all_employees","view_single_employee","register_employee","approve_employee","reject_employee",
            "delete_employee","assign_employee_role","view_all_roles","resolve_org_unit","create_org_unit",
            "view_org_units","view_employees_by_org_unit","view_all_finalized_employees"
          ].map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <div className="flex flex-wrap gap-2 mt-2">
          {allPermissions.map(p=>(
            <span key={p} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
              {p} <span onClick={()=>setAllPermissions(allPermissions.filter(x=>x!==p))} className="cursor-pointer font-bold">×</span>
            </span>
          ))}
        </div>
      </div>

      {/* Hierarchy Dropdowns */}
      {[
        {level:"office",options:officesOptions,value:office,setValue:setOffice},
        {level:"group",options:groupsOptions,value:group,setValue:setGroup},
        {level:"division",options:divisionsOptions,value:division,setValue:setDivision},
        {level:"department",options:departmentsOptions,value:department,setValue:setDepartment},
        {level:"branch",options:branchesOptions,value:branch,setValue:setBranch},
        {level:"cell",options:cellsOptions,value:cell,setValue:setCell},
        {level:"desk",options:desksOptions,value:desk,setValue:setDesk}
      ].map(({level,options,value,setValue})=>(
        <div key={level} className="flex flex-col gap-2 mt-3">
          <div className="flex items-center gap-2">
            <label className="w-36 font-semibold">{level.charAt(0).toUpperCase()+level.slice(1)}</label>
            <select className="flex-1 border shadow-sm rounded px-3 py-2" value={value} onChange={(e)=>{ setValue(e.target.value); resetDependentFields(level); }}>
              <option value="">Select {level.charAt(0).toUpperCase()+level.slice(1)}</option>
              {options.map(opt=><option key={opt._id} value={opt.name}>{opt.name}</option>)}
            </select>
            <button type="button" onClick={()=>openCreateModal(level)} className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700">Create</button>
            <button type="button" onClick={()=>openEditModal(level, options, value)} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Edit</button>
            <button type="button" onClick={()=>openDeleteModal(level, options, value)} className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700">Delete</button>
          </div>
        </div>
      ))}

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-4">
        <button type="button" onClick={handleCancel} className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">Cancel</button>
        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
      </div>

      {/* Action Modal */}
      {actionModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 shadow-lg">
            <h3 className="text-lg font-bold mb-3">{actionModal.type.charAt(0).toUpperCase()+actionModal.type.slice(1)} {actionModal.level}</h3>
            {actionModal.type !== "delete" && (
              <input 
                type="text" 
                className="w-full border rounded px-3 py-2 mb-3" 
                value={actionModal.name}   // ✅ always bind to state
                onChange={(e)=>setActionModal({...actionModal, name: e.target.value})} 
                placeholder={`Enter ${actionModal.level} name`} 
              />
            )}
            {actionModal.type === "delete" && (
              <p className="mb-3">Are you sure you want to delete "{actionModal.name}"?</p>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeActionModal} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancel</button>
              <button 
                type="button" 
                onClick={() => actionModal.type === "delete" ? submitDelete() : actionModal.type === "edit" ? submitEdit(actionModal.name) : submitCreate(actionModal.name)} 
                className={`px-4 py-2 ${
                  actionModal.type === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                } text-white rounded ${actionLoading ? 'opacity-70 cursor-not-allowed' : ''}`} 
                disabled={actionLoading}
              >
                {actionModal.type === "delete" ? "Delete" : actionModal.type.charAt(0).toUpperCase() + actionModal.type.slice(1)}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

export default AssignRolesForm;