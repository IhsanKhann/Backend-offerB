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

  const [officeId, setOfficeId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [cellId, setCellId] = useState("");
  const [deskId, setDeskId] = useState("");

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
    
    if (level === "office") {
      setGroupId(""); setDivisionId(""); setDepartmentId(""); setBranchId(""); setCellId(""); setDeskId("");
    } else if (level === "group") {
      setDivisionId(""); setDepartmentId(""); setBranchId(""); setCellId(""); setDeskId("");
    } else if (level === "division") {
      setDepartmentId(""); setBranchId(""); setCellId(""); setDeskId("");
    } else if (level === "department") {
      setBranchId(""); setCellId(""); setDeskId("");
    } else if (level === "branch") {
      setCellId(""); setDeskId("");
    } else if (level === "cell") {
      setDeskId("");
    }
  };

  // ---------------- Find Node by ID ----------------
  const findNodeById = (nodes, id) => {
    if (!nodes || !Array.isArray(nodes)) return null;
    
    for (const node of nodes) {
      if (node._id === id) return node;
      
      // Check all possible child arrays
      const childKeys = ["offices", "groups", "divisions", "departments", "branches", "cells", "desks"];
      for (const key of childKeys) {
        if (node[key] && Array.isArray(node[key])) {
          const found = findNodeById(node[key], id);
          if (found) return found;
        }
      }
    }
    
    return null;
  };

  // ---------------- Get Options for Each Level ----------------
  const getOfficeOptions = () => hierarchy?.offices || [];
  
  const getGroupOptions = () => {
    if (!officeId) return [];
    const office = findNodeById(hierarchy.offices, officeId);
    return office ? office.groups || [] : [];
  };
  
  const getDivisionOptions = () => {
    let divisions = [];
    
    // Divisions can be under office or group
    if (officeId) {
      const office = findNodeById(hierarchy.offices, officeId);
      if (office && office.divisions) divisions = divisions.concat(office.divisions);
    }
    
    if (groupId) {
      const group = findNodeById(hierarchy.offices, groupId);
      if (group && group.divisions) divisions = divisions.concat(group.divisions);
    }
    
    return divisions;
  };
  
  const getDepartmentOptions = () => {
    let departments = [];
    
    // Departments can be under office, group, or division
    if (officeId) {
      const office = findNodeById(hierarchy.offices, officeId);
      if (office && office.departments) departments = departments.concat(office.departments);
    }
    
    if (groupId) {
      const group = findNodeById(hierarchy.offices, groupId);
      if (group && group.departments) departments = departments.concat(group.departments);
    }
    
    if (divisionId) {
      const division = findNodeById(hierarchy.offices, divisionId);
      if (division && division.departments) departments = departments.concat(division.departments);
    }
    
    return departments;
  };
  
  const getBranchOptions = () => {
    let branches = [];
    
    // Branches can be under office or department
    if (officeId) {
      const office = findNodeById(hierarchy.offices, officeId);
      if (office && office.branches) branches = branches.concat(office.branches);
    }
    
    if (departmentId) {
      const department = findNodeById(hierarchy.offices, departmentId);
      if (department && department.branches) branches = branches.concat(department.branches);
    }
    
    return branches;
  };
  
  const getCellOptions = () => {
    let cells = [];
    
    // Cells can be under office, group, division, department, or branch
    if (officeId) {
      const office = findNodeById(hierarchy.offices, officeId);
      if (office && office.cells) cells = cells.concat(office.cells);
    }
    
    if (groupId) {
      const group = findNodeById(hierarchy.offices, groupId);
      if (group && group.cells) cells = cells.concat(group.cells);
    }
    
    if (divisionId) {
      const division = findNodeById(hierarchy.offices, divisionId);
      if (division && division.cells) cells = cells.concat(division.cells);
    }
    
    if (departmentId) {
      const department = findNodeById(hierarchy.offices, departmentId);
      if (department && department.cells) cells = cells.concat(department.cells);
    }
    
    if (branchId) {
      const branch = findNodeById(hierarchy.offices, branchId);
      if (branch && branch.cells) cells = cells.concat(branch.cells);
    }
    
    return cells;
  };
  
  const getDeskOptions = () => {
    let desks = [];
    
    // Desks can be under office, group, division, department, branch, or cell
    if (officeId) {
      const office = findNodeById(hierarchy.offices, officeId);
      if (office && office.desks) desks = desks.concat(office.desks);
    }
    
    if (groupId) {
      const group = findNodeById(hierarchy.offices, groupId);
      if (group && group.desks) desks = desks.concat(group.desks);
    }
    
    if (divisionId) {
      const division = findNodeById(hierarchy.offices, divisionId);
      if (division && division.desks) desks = desks.concat(division.desks);
    }
    
    if (departmentId) {
      const department = findNodeById(hierarchy.offices, departmentId);
      if (department && department.desks) desks = desks.concat(department.desks);
    }
    
    if (branchId) {
      const branch = findNodeById(hierarchy.offices, branchId);
      if (branch && branch.desks) desks = desks.concat(branch.desks);
    }
    
    if (cellId) {
      const cell = findNodeById(hierarchy.offices, cellId);
      if (cell && cell.desks) desks = desks.concat(cell.desks);
    }
    
    return desks;
  };

  // ---------------- Get Parent Options for Create Modal ----------------
  const getParentOptions = (level) => {
    if (level === "office") return [];
    
    // For groups, parents can only be offices
    if (level === "group") {
      return getOfficeOptions();
    }
    
    // For divisions, parents can be offices or groups
    if (level === "division") {
      return [...getOfficeOptions(), ...getGroupOptions()];
    }
    
    // For departments, parents can be offices, groups, or divisions
    if (level === "department") {
      return [...getOfficeOptions(), ...getGroupOptions(), ...getDivisionOptions()];
    }
    
    // For branches, parents can be offices or departments
    if (level === "branch") {
      return [...getOfficeOptions(), ...getDepartmentOptions()];
    }
    
    // For cells, parents can be offices, groups, divisions, departments, or branches
    if (level === "cell") {
      return [
        ...getOfficeOptions(), 
        ...getGroupOptions(), 
        ...getDivisionOptions(), 
        ...getDepartmentOptions(), 
        ...getBranchOptions()
      ];
    }
    
    // For desks, parents can be offices, groups, divisions, departments, branches, or cells
    if (level === "desk") {
      return [
        ...getOfficeOptions(), 
        ...getGroupOptions(), 
        ...getDivisionOptions(), 
        ...getDepartmentOptions(), 
        ...getBranchOptions(),
        ...getCellOptions()
      ];
    }
    
    return [];
  };

  // ---------------- Centralized Create Node ----------------
  const submitCreate = async (name, level, parentId) => {
    if (!name || !level) return alert("Enter name and select level");
    setActionLoading(true);
    try {
      const res = await api.post("/hierarchy/createNode", { 
        level: backendLevels[level], 
        name, 
        parentId: parentId || null 
      });
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
      
      // Get names for all selected levels
      const officeName = findNodeById(hierarchy.offices, officeId)?.name || "";
      const groupName = findNodeById(hierarchy.offices, groupId)?.name || "";
      const divisionName = findNodeById(hierarchy.offices, divisionId)?.name || "";
      const departmentName = findNodeById(hierarchy.offices, departmentId)?.name || "";
      const branchName = findNodeById(hierarchy.offices, branchId)?.name || "";
      const cellName = findNodeById(hierarchy.offices, cellId)?.name || "";
      const deskName = findNodeById(hierarchy.offices, deskId)?.name || "";
      
      const orgUnitRes = await api.post("/org-units/resolve", { 
        office: officeName, 
        group: groupName, 
        division: divisionName, 
        department: departmentName, 
        branch: branchName, 
        cell: cellName, 
        desk: deskName 
      });
      
      const orgUnitId = orgUnitRes.data?.orgUnitId;
      if (!orgUnitId) throw new Error("OrgUnit resolution failed");
      
      const rolesData = { 
        employeeId: employeeData._id, 
        roleName: roleDropdown, 
        orgUnit: orgUnitId, 
        permissions: allPermissions 
      };
      
      dispatch(assignRolesDraft(rolesData));
      dispatch(addDraft());
      await api.post("/employees/roles", rolesData);
      navigate("/DraftDashboard");
    } catch (err) {
      console.error(err);
      alert("Failed to save draft.");
    } finally { 
      setLoading(false); 
    }
  };

  const handleCancel = () => navigate("/DraftDashboard");

  if (loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if (employeeError) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <h2 className="text-xl text-red-600 mb-4">{employeeError}</h2>
      <button onClick={() => navigate("/admin/dashboard")} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-2">Admin Dashboard</button>
      <button onClick={() => navigate("/register-employee")} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create New Employee</button>
      <button onClick={() => navigate("/Permission-handler")} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"> Manage Permissions </button>
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
            {["Chairman","BoD Member","Company Secretary","Group Head","Division Head","Department Head","Branch Manager","Officer","Manager","Senior Manager","Cell Incharge","Executive (Contract)","Executive (Permanent)","Senior Group Head"].map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
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
          {["view_all_employees","view_single_employee","register_employee","approve_employee","reject_employee","delete_employee","assign_employee_role","view_all_roles","resolve_org_unit","create_org_unit","view_org_units","view_employees_by_org_unit","view_all_finalized_employees"].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
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
      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2">
          <label className="w-36 font-semibold">Office</label>
          <select className="flex-1 border shadow-sm rounded px-3 py-2" value={officeId} onChange={e => { 
            setOfficeId(e.target.value); 
            resetDependentFields("office"); 
          }}>
            <option value="">Select Office</option>
            {getOfficeOptions().map(opt => (
              <option key={opt._id} value={opt._id}>{opt.name}</option>
            ))}
          </select>
          {officeId && (
            <button type="button" className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" onClick={async () => {
              if (!window.confirm(`Delete office?`)) return;
              try {
                await api.delete(`/hierarchy/deleteNode/${officeId}`);
                alert("Office deleted");
                setOfficeId("");
                fetchHierarchy();
              } catch(err) { 
                console.error(err); 
                alert("Failed to delete"); 
              }
            }}>Delete</button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2">
          <label className="w-36 font-semibold">Group</label>
          <select className="flex-1 border shadow-sm rounded px-3 py-2" value={groupId} onChange={e => { 
            setGroupId(e.target.value); 
            resetDependentFields("group"); 
          }}>
            <option value="">Select Group</option>
            {getGroupOptions().map(opt => (
              <option key={opt._id} value={opt._id}>{opt.name}</option>
            ))}
          </select>
          {groupId && (
            <button type="button" className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" onClick={async () => {
              if (!window.confirm(`Delete group?`)) return;
              try {
                await api.delete(`/hierarchy/deleteNode/${groupId}`);
                alert("Group deleted");
                setGroupId("");
                fetchHierarchy();
              } catch(err) { 
                console.error(err); 
                alert("Failed to delete"); 
              }
            }}>Delete</button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2">
          <label className="w-36 font-semibold">Division</label>
          <select className="flex-1 border shadow-sm rounded px-3 py-2" value={divisionId} onChange={e => { 
            setDivisionId(e.target.value); 
            resetDependentFields("division"); 
          }}>
            <option value="">Select Division</option>
            {getDivisionOptions().map(opt => (
              <option key={opt._id} value={opt._id}>{opt.name}</option>
            ))}
          </select>
          {divisionId && (
            <button type="button" className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" onClick={async () => {
              if (!window.confirm(`Delete division?`)) return;
              try {
                await api.delete(`/hierarchy/deleteNode/${divisionId}`);
                alert("Division deleted");
                setDivisionId("");
                fetchHierarchy();
              } catch(err) { 
                console.error(err); 
                alert("Failed to delete"); 
              }
            }}>Delete</button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2">
          <label className="w-36 font-semibold">Department</label>
          <select className="flex-1 border shadow-sm rounded px-3 py-2" value={departmentId} onChange={e => { 
            setDepartmentId(e.target.value); 
            resetDependentFields("department"); 
          }}>
            <option value="">Select Department</option>
            {getDepartmentOptions().map(opt => (
              <option key={opt._id} value={opt._id}>{opt.name}</option>
            ))}
          </select>
          {departmentId && (
            <button type="button" className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" onClick={async () => {
              if (!window.confirm(`Delete department?`)) return;
              try {
                await api.delete(`/hierarchy/deleteNode/${departmentId}`);
                alert("Department deleted");
                setDepartmentId("");
                fetchHierarchy();
              } catch(err) { 
                console.error(err); 
                alert("Failed to delete"); 
              }
            }}>Delete</button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2">
          <label className="w-36 font-semibold">Branch</label>
          <select className="flex-1 border shadow-sm rounded px-3 py-2" value={branchId} onChange={e => { 
            setBranchId(e.target.value); 
            resetDependentFields("branch"); 
          }}>
            <option value="">Select Branch</option>
            {getBranchOptions().map(opt => (
              <option key={opt._id} value={opt._id}>{opt.name}</option>
            ))}
          </select>
          {branchId && (
            <button type="button" className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" onClick={async () => {
              if (!window.confirm(`Delete branch?`)) return;
              try {
                await api.delete(`/hierarchy/deleteNode/${branchId}`);
                alert("Branch deleted");
                setBranchId("");
                fetchHierarchy();
              } catch(err) { 
                console.error(err); 
                alert("Failed to delete"); 
              }
            }}>Delete</button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2">
          <label className="w-36 font-semibold">Cell</label>
          <select className="flex-1 border shadow-sm rounded px-3 py-2" value={cellId} onChange={e => { 
            setCellId(e.target.value); 
            resetDependentFields("cell"); 
          }}>
            <option value="">Select Cell</option>
            {getCellOptions().map(opt => (
              <option key={opt._id} value={opt._id}>{opt.name}</option>
            ))}
          </select>
          {cellId && (
            <button type="button" className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" onClick={async () => {
              if (!window.confirm(`Delete cell?`)) return;
              try {
                await api.delete(`/hierarchy/deleteNode/${cellId}`);
                alert("Cell deleted");
                setCellId("");
                fetchHierarchy();
              } catch(err) { 
                console.error(err); 
                alert("Failed to delete"); 
              }
            }}>Delete</button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2">
          <label className="w-36 font-semibold">Desk</label>
          <select className="flex-1 border shadow-sm rounded px-3 py-2" value={deskId} onChange={e => { 
            setDeskId(e.target.value); 
            resetDependentFields("desk"); 
          }}>
            <option value="">Select Desk</option>
            {getDeskOptions().map(opt => (
              <option key={opt._id} value={opt._id}>{opt.name}</option>
            ))}
          </select>
          {deskId && (
            <button type="button" className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" onClick={async () => {
              if (!window.confirm(`Delete desk?`)) return;
              try {
                await api.delete(`/hierarchy/deleteNode/${deskId}`);
                alert("Desk deleted");
                setDeskId("");
                fetchHierarchy();
              } catch(err) { 
                console.error(err); 
                alert("Failed to delete"); 
              }
            }}>Delete</button>
          )}
        </div>
      </div>

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
                {getParentOptions(actionModal.level).map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            )}
            <input type="text" className="w-full border rounded px-3 py-2 mb-3" value={actionModal.name} onChange={e => setActionModal({ ...actionModal, name: e.target.value })} placeholder="Enter name"/>
            <div className="flex justify-end gap-3">
              <button onClick={() => setActionModal({ type: null, open: false })} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancel</button>
              <button onClick={() => submitCreate(actionModal.name, actionModal.level, actionModal.parentId)} disabled={actionLoading} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                {actionLoading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

export default AssignRolesForm;