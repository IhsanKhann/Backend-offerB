import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import api from "../api/axios.js";

import { assignRolesDraft } from "../store/sliceRoles.jsx";
import { addRolesData, addDraft, updateDraft, cancelEdit, addEmployeeData } from "../store/sliceDraft.jsx";

const AssignRolesForm = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [hierarchy, setHierarchy] = useState({ offices: [] });
  const [loading, setLoading] = useState(false);
  const [employeeError, setEmployeeError] = useState(null);
  const [actionModal, setActionModal] = useState({ type: null, level: null, name: "", id: null, open: false });
  const [actionLoading, setActionLoading] = useState(false);

  const employeeData = useSelector((state) => state.draft.employeeData);
  const editingDraft = useSelector((state) => state.draft.editingDraft);
  const isEditing = !!editingDraft;

  const [employee, setEmployee] = useState("");
  const [roles, setRoles] = useState([]);

  const [office, setOffice] = useState("");
  const [group, setGroup] = useState("");
  const [division, setDivision] = useState("");
  const [department, setDepartment] = useState("");
  const [branch, setBranch] = useState("");
  const [cell, setCell] = useState("");
  const [desk, setDesk] = useState("");

  const [role_dropdown, setRoleDropdown] = useState("");
  const [allPermissions, setAllPermissions] = useState([]);

  // ------------------ Fetch Data ------------------
  const fetchHierarchy = async () => {
    try {
      setLoading(true);
      const res = await api.get("/hierarchy/get-hierarchy");
      if (res.data?.data?.offices) setHierarchy(res.data.data);
      else if (Array.isArray(res.data?.data)) setHierarchy({ offices: res.data.data });
      else setHierarchy({ offices: [] });
    } catch (err) {
      console.error(err);
      setHierarchy({ offices: [] });
    } finally { setLoading(false); }
  };

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

    const fetchRoles = async () => {
      try {
        const res = await api.get(`/roles/${employeeId}`);
        if (res.data?.roles) {
          setRoles(res.data.roles);
          dispatch(addRolesData({ rolesData: res.data.roles }));
        }
      } catch { setRoles([]); }
    };

    if (employeeId) { fetchEmployee(); fetchRoles(); }
    fetchHierarchy();
  }, [employeeId, dispatch]);

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

  // ------------------ Hierarchy Helpers ------------------
  const resetDependentFields = (level) => {
    const map = { office:["group","division","department","branch","cell","desk"],
                  group:["division","department","branch","cell","desk"],
                  division:["department","branch","cell","desk"],
                  department:["branch","cell","desk"],
                  branch:["cell","desk"],
                  cell:["desk"] };
    (map[level]||[]).forEach(l => { if(l==="group") setGroup(""); if(l==="division") setDivision(""); if(l==="department") setDepartment(""); if(l==="branch") setBranch(""); if(l==="cell") setCell(""); if(l==="desk") setDesk(""); });
  };

  const getOptions = (level) => {
    const o = hierarchy.offices || [];
    const officeObj = o.find(x=>x.name===office);
    const groupObj = officeObj?.groups?.find(x=>x.name===group);
    const divisionObj = groupObj?.divisions || officeObj?.divisions?.filter(d=>d.name===division) || [];
    const departmentObj = divisionObj?.departments || officeObj?.departments?.filter(d=>d.name===department) || [];
    const branchObj = departmentObj?.branches || officeObj?.branches?.filter(b=>b.name===branch) || [];
    const cellObj = branchObj?.cells || departmentObj?.cells || divisionObj?.cells || officeObj?.cells || [];
    const deskObj = cellObj?.desks || branchObj?.desks || departmentObj?.desks || divisionObj?.desks || officeObj?.desks || [];

    return { office:o, group:officeObj?.groups||[], division:divisionObj, department:departmentObj, branch:branchObj, cell:cellObj, desk:deskObj };
  };

  const options = getOptions();

  // ------------------ Modal Actions ------------------
  const openActionModal = (type, level, val, opts) => {
    let selected = opts?.find(o=>o.name===val || o._id===val) || { name:"", _id:null };
    setActionModal({ type, level, name:selected.name, id:selected._id, open:true });
  };
  const closeActionModal = () => setActionModal({ type:null, level:null, name:"", id:null, open:false });

  const generatePath = () => {
    const path = [];
    if(office) path.push({ level:"office", name:office });
    if(group) path.push({ level:"group", name:group });
    if(division) path.push({ level:"division", name:division });
    if(department) path.push({ level:"department", name:department });
    if(branch) path.push({ level:"branch", name:branch });
    if(cell) path.push({ level:"cell", name:cell });
    return path;
  };

  const submitCreate = async (name) => {
    try { setActionLoading(true);
      await api.post("/hierarchy", { name, level: actionModal.level, path: generatePath() });
      await fetchHierarchy();
      closeActionModal();
    } catch(err){ console.error(err); alert(err.response?.data?.message || "Create failed"); }
    finally { setActionLoading(false); }
  };
  const submitEdit = async (name) => {
    try { setActionLoading(true);
      await api.put(`/hierarchy/${actionModal.id}`, { name, level:actionModal.level, path:generatePath() });
      await fetchHierarchy();
      closeActionModal();
    } catch(err){ console.error(err); alert(err.response?.data?.message || "Edit failed"); }
    finally { setActionLoading(false); }
  };
  const submitDelete = async () => {
    if(!confirm(`Delete ${actionModal.level} "${actionModal.name}"?`)) return;
    try { setActionLoading(true);
      await api.delete(`/hierarchy/${actionModal.id}`, { data:{ level:actionModal.level, path:generatePath() } });
      await fetchHierarchy();
      closeActionModal();
    } catch(err){ console.error(err); alert(err.response?.data?.message || "Delete failed"); }
    finally { setActionLoading(false); }
  };

  // ------------------ Submit ------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!employeeData) return alert("No employee found. Please create one first.");
    try{
      setLoading(true);
      const orgUnitRes = await api.post("/org-units/resolve", { office, group, division, department, branch, cell, desk });
      const orgUnitId = orgUnitRes.data?.orgUnitId;
      if(!orgUnitId) throw new Error("OrgUnit resolution failed");

      const rolesData = { employeeId:employeeData._id, roleName:role_dropdown, orgUnit:orgUnitId, permissions:allPermissions };

      if(isEditing) dispatch(updateDraft({ draftId:editingDraft.draftId, roles:rolesData }));
      else { dispatch(assignRolesDraft(rolesData)); dispatch(addDraft()); await api.post("/employees/roles", rolesData); }

      navigate("/DraftDashboard");
    } catch(err){ console.error(err); alert("Failed to save draft."); }
    finally{ setLoading(false); }
  };
  const handleCancel = () => { if(isEditing) dispatch(cancelEdit()); navigate("/DraftDashboard"); };

  if(loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if(employeeError) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <h2 className="text-xl text-red-600 mb-4">{employeeError}</h2>
      <button onClick={()=>navigate("/admin/dashboard")} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-2">Admin Dashboard</button>
      <button onClick={()=>navigate("/register-employee")} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create New Employee</button>
    </div>
  );

  // ------------------ Render ------------------
  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-8 bg-white shadow-md rounded-xl space-y-6 border-t-4 border-blue-600">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-blue-600">Assign Roles</h2>
        <p className="text-gray-600">Employee: <span className="font-semibold">{employee?.individualName || "N/A"}</span></p>
        <p className="text-gray-600">ID: <span className="font-semibold">{employee?._id || "N/A"}</span></p>
      </div>

      {/* Role Dropdown */}
      <DropdownWithActions
        label="Role"
        value={role_dropdown}
        onChange={setRoleDropdown}
        options={[
          "Chairman","BoD Member","Company Secretary","Group Head","Division Head",
          "Department Head","Branch Manager","Officer","Manager","Senior Manager",
          "Cell Incharge","Executive (Contract)","Executive (Permanent)","Senior Group Head"
        ]}
        level="role"
        selectedValue={role_dropdown}
        onCreate={()=>openActionModal("create","role")}
        onEdit={(opts,val)=>openActionModal("edit","role",val,opts)}
        onDelete={(opts,val)=>openActionModal("delete","role",val,opts)}
      />

      {/* Permissions */}
      <div className="flex flex-col gap-2">
        <label className="font-semibold">Permissions</label>
        <select value="" onChange={e=>{const val=e.target.value;if(val&&!allPermissions.includes(val)) setAllPermissions([...allPermissions,val]);}} className="border rounded px-3 py-2 w-full">
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
      {["office","group","division","department","branch","cell","desk"].map(level=>{
        const opts = options[level];
        const value = {office,group,division,department,branch,cell,desk}[level];
        const setValue = {office:setOffice,group:setGroup,division:setDivision,department:setDepartment,branch:setBranch,cell:setCell,desk:setDesk}[level];
        return <DropdownWithActions key={level} label={level.charAt(0).toUpperCase()+level.slice(1)} value={value} onChange={val=>{setValue(val);resetDependentFields(level);}} options={opts} level={level} selectedValue={value} onCreate={()=>openActionModal("create",level)} onEdit={(o,v)=>openActionModal("edit",level,v,o)} onDelete={(o,v)=>openActionModal("delete",level,v,o)} />;
      })}

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-4">
        <button type="button" onClick={handleCancel} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Cancel</button>
        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
      </div>

      {/* Modal */}
      {actionModal.open && <ActionModal type={actionModal.type} level={actionModal.level} name={actionModal.name} onClose={closeActionModal} onSubmit={actionModal.type==="create"?submitCreate:actionModal.type==="edit"?submitEdit:submitDelete} loading={actionLoading} />}
    </form>
  );
};

// ------------------ Components ------------------
const DropdownWithActions = ({ label, value, onChange, options, level, selectedValue, onCreate, onEdit, onDelete }) => (
  <div className="flex items-center gap-3 mt-3">
    <label className="w-36 font-semibold">{label}</label>
    <select className="flex-1 border shadow-sm rounded px-3 py-2" value={value} onChange={e=>onChange(e.target.value)}>
      <option value="">Select {label}</option>
      {options.map(opt=><option key={opt._id||opt.name||opt} value={opt.name||opt}>{opt.name||opt}</option>)}
    </select>
    <button type="button" onClick={onCreate} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Create</button>
    <button type="button" onClick={()=>onEdit(options,selectedValue)} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Edit</button>
    <button type="button" onClick={()=>onDelete(options,selectedValue)} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Delete</button>
  </div>
);

const ActionModal = ({ type, level, name, onClose, onSubmit, loading }) => {
  const [input, setInput] = useState(name);
  useEffect(()=>setInput(name),[name]);
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg w-96 shadow-lg">
        <h3 className="text-lg font-bold mb-3">{type.charAt(0).toUpperCase()+type.slice(1)} {level}</h3>
        {type!=="delete" && <input type="text" value={input} onChange={e=>setInput(e.target.value)} className="w-full border rounded px-3 py-2 mb-3" placeholder={`Enter ${level} name`} />}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancel</button>
          <button type="button" onClick={()=>onSubmit(input)} disabled={loading} className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ${loading?"opacity-70 cursor-not-allowed":""}`}>{type.charAt(0).toUpperCase()+type.slice(1)}</button>
        </div>
      </div>
    </div>
  );
};

export default AssignRolesForm;
