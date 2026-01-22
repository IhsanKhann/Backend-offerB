import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import api from "../api/axios.js";
import { assignRolesDraft } from "../store/sliceRoles.jsx";
import { addDraft, addEmployeeData, updateDraft } from "../store/sliceDraft.jsx";

const AssignRolesForm = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isEditing, editingDraft } = useSelector((state) => state.draft);

  const [fetchedPermissions, setFetchedPermissions] = useState([]);
  const [hierarchy, setHierarchy] = useState({ offices: [] });

  const [loading, setLoading] = useState(false);
  const [employeeError, setEmployeeError] = useState(null);

  const [actionModal, setActionModal] = useState({ 
    type: null, 
    level: "", 
    name: "", 
    parentId: null, 
    open: false 
  });
  const [actionLoading, setActionLoading] = useState(false);

  const employeeData = useSelector((state) => state.draft.employeeData);
  const [employee, setEmployee] = useState(null);

  const [departmentCode, setDepartmentCode] = useState("");  
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [RolesList, setRolesList] = useState([]);
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

  // ============================================
  // FETCH HIERARCHY
  // ============================================
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

  // ============================================
  // FETCH EMPLOYEE
  // ============================================
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
    if (employeeId) fetchEmployee();
  }, [employeeId, dispatch]);

  useEffect(() => {
    fetchHierarchy();
  }, []);

  // ============================================
  // FETCH PERMISSIONS
  // ============================================
  useEffect(() => {
    const fetchEmployeePermissions = async () => {
      try {
        setLoading(true);
        const response = await api.get("/permissions/AllPermissions");
        setFetchedPermissions(response.data.Permissions);
      } catch (error) {
        console.log(error);
        setFetchedPermissions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployeePermissions();
  }, []);

  // ============================================
  // FETCH GLOBAL ROLES
  // ============================================
  const fetchRolesList = async () => {
    try {
      setLoading(true);
      const response = await api.get("/roles/getAllRolesList");
      
      if (response.data && response.data.Roles) {
        setRolesList(response.data.Roles);
        console.log("✅ Global roles fetched:", response.data.Roles.length);
      } else {
        setRolesList([]);
        console.log("No roles found");
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
      setRolesList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRolesList();
  }, []);

  // ============================================
  // RESET DEPENDENT FIELDS
  // ============================================
  const resetDependentFields = (level) => {
    const index = levelOrder.indexOf(level);
    if (index === -1) return;
    
    if (level === "office") {
      setGroupId(""); setDivisionId(""); setDepartmentId(""); 
      setBranchId(""); setCellId(""); setDeskId("");
    } else if (level === "group") {
      setDivisionId(""); setDepartmentId(""); setBranchId(""); 
      setCellId(""); setDeskId("");
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

  // ============================================
  // FIND NODE BY ID
  // ============================================
  const findNodeById = (nodes, id) => {
    if (!nodes || !Array.isArray(nodes)) return null;
    
    for (const node of nodes) {
      if (node._id === id) return node;
      
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

  // ============================================
  // GET OPTIONS FOR EACH LEVEL
  // ============================================
  const getOfficeOptions = () => hierarchy?.offices || [];
  
  const getGroupOptions = () => {
    if (!officeId) return [];
    const office = findNodeById(hierarchy.offices, officeId);
    return office ? office.groups || [] : [];
  };
  
  const getDivisionOptions = () => {
    let divisions = [];
    
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

  // ============================================
  // GET PARENT OPTIONS FOR CREATE MODAL
  // ============================================
  const getParentOptions = (level) => {
    if (level === "office") return [];
    
    if (level === "group") {
      return getOfficeOptions();
    }
    
    if (level === "division") {
      return [...getOfficeOptions(), ...getGroupOptions()];
    }
    
    if (level === "department") {
      return [...getOfficeOptions(), ...getGroupOptions(), ...getDivisionOptions()];
    }
    
    if (level === "branch") {
      return [...getOfficeOptions(), ...getDepartmentOptions()];
    }
    
    if (level === "cell") {
      return [
        ...getOfficeOptions(), 
        ...getGroupOptions(), 
        ...getDivisionOptions(), 
        ...getDepartmentOptions(), 
        ...getBranchOptions()
      ];
    }
    
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

  // ============================================
  // CREATE HIERARCHY NODE
  // ============================================
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

  // ============================================
  // DELETE HIERARCHY NODE
  // ============================================
  const handleDeleteNode = async (nodeId, nodeName) => {
    if (!window.confirm(`Delete ${nodeName}?`)) return;
    try {
      setActionLoading(true);
      await api.delete(`/hierarchy/deleteNode/${nodeId}`);
      alert("Node deleted successfully");
      
      if (nodeId === officeId) setOfficeId("");
      if (nodeId === groupId) setGroupId("");
      if (nodeId === divisionId) setDivisionId("");
      if (nodeId === departmentId) setDepartmentId("");
      if (nodeId === branchId) setBranchId("");
      if (nodeId === cellId) setCellId("");
      if (nodeId === deskId) setDeskId("");
      
      await fetchHierarchy();
    } catch (err) {
      console.error(err);
      alert("Failed to delete node");
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================
  // SUBMIT - ASSIGN ROLE (NO STATUS FIELD)
  // ============================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!employeeData) {
      alert("No employee found. Please create one first.");
      return;
    }

    if (!selectedRoleId) {
      alert("Please select a role.");
      return;
    }

    try {
      setLoading(true);

      const office = officeId ? findNodeById(hierarchy.offices, officeId)?.name : null;
      const group = groupId ? findNodeById(hierarchy.offices, groupId)?.name : null;
      const division = divisionId ? findNodeById(hierarchy.offices, divisionId)?.name : null;
      const department = departmentId ? findNodeById(hierarchy.offices, departmentId)?.name : null;
      const branch = branchId ? findNodeById(hierarchy.offices, branchId)?.name : null;
      const cell = cellId ? findNodeById(hierarchy.offices, cellId)?.name : null;
      const desk = deskId ? findNodeById(hierarchy.offices, deskId)?.name : null;

      const orgUnitRes = await api.post("/org-units/resolve", {
        office, group, division, department, branch, cell, desk,
      });

      const orgUnitId = orgUnitRes.data?.orgUnitId;
      if (!orgUnitId) throw new Error("OrgUnit resolution failed");

      // NO STATUS FIELD - ONLY departmentCode
      const rolesData = {
        employeeId: employeeData._id,
        roleId: selectedRoleId,
        orgUnit: orgUnitId,
        permissions: allPermissions.map(p => p._id),
        departmentCode: departmentCode,
      };

      if (isEditing) {
        dispatch(updateDraft({ draftId: editingDraft.draftId, roles: rolesData }));
      } else {
        dispatch(assignRolesDraft(rolesData));
        dispatch(addDraft());
        await api.post("/roles/assign", rolesData);
      }
      
      navigate("/DraftDashboard");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to save draft.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => navigate("/DraftDashboard");

  // ============================================
  // RENDER
  // ============================================
  if (loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  
  if (employeeError) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <h2 className="text-xl text-red-600 mb-4">{employeeError}</h2>
      <button 
        onClick={() => navigate("/admin/dashboard")} 
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-2"
      >
        Admin Dashboard
      </button>
      <button 
        onClick={() => navigate("/register-employee")} 
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Create New Employee
      </button>
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
        <label className="font-semibold">Employee Role *</label>
        <select
          className="border shadow-sm rounded px-3 py-2"
          value={selectedRoleId}
          onChange={(e) => setSelectedRoleId(e.target.value)}
          required
        >
          <option value="">Select Role</option>
          {RolesList.length > 0 ? (
            RolesList.map((role) => (
              <option key={role._id} value={role._id}>
                {role.roleName} ({role.category})
              </option>
            ))
          ) : (
            <option disabled>No roles available</option>
          )}
        </select>
        <p className="text-xs text-gray-500">
          {RolesList.length} global role(s) available
        </p>
      </div>

      {/* Department Code */}
      <div className="flex flex-col gap-2 mt-4">
        <label className="font-semibold">Department Code *</label>
        <select
          className="border rounded px-3 py-2"
          value={departmentCode}
          onChange={(e) => setDepartmentCode(e.target.value)}
          required
        >
          <option value="">Select Department</option>
          <option value="HR">HR</option>
          <option value="Finance">Finance</option>
          <option value="BusinessOperation">Business Operation</option>
          <option value="All">All</option>
        </select>
      </div>

      {/* Hierarchy Section */}
      <h3 className="font-bold text-lg mt-6">Assign Organizational Position</h3>
      
      {/* Office */}
      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2">
          <label className="w-36 font-semibold">Office</label>
          <select 
            className="flex-1 border shadow-sm rounded px-3 py-2" 
            value={officeId} 
            onChange={e => { 
              setOfficeId(e.target.value); 
              resetDependentFields("office"); 
            }}
          >
            <option value="">Select Office</option>
            {getOfficeOptions().map(opt => (
              <option key={opt._id} value={opt._id}>{opt.name}</option>
            ))}
          </select>
          {officeId && (
            <button 
              type="button" 
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" 
              onClick={() => handleDeleteNode(officeId, "office")}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Group */}
      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2">
          <label className="w-36 font-semibold">Group</label>
          <select 
            className="flex-1 border shadow-sm rounded px-3 py-2" 
            value={groupId} 
            onChange={e => { 
              setGroupId(e.target.value); 
              resetDependentFields("group"); 
            }}
          >
            <option value="">Select Group</option>
            {getGroupOptions().map(opt => (
              <option key={opt._id} value={opt._id}>{opt.name}</option>
            ))}
          </select>
          {groupId && (
            <button 
              type="button" 
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" 
              onClick={() => handleDeleteNode(groupId, "group")}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Division */}
      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2">
          <label className="w-36 font-semibold">Division</label>
          <select 
            className="flex-1 border shadow-sm rounded px-3 py-2" 
            value={divisionId} 
            onChange={e => { 
              setDivisionId(e.target.value); 
              resetDependentFields("division"); 
            }}
          >
            <option value="">Select Division</option>
            {getDivisionOptions().map(opt => (
              <option key={opt._id} value={opt._id}>{opt.name}</option>
            ))}
          </select>
          {divisionId && (
            <button 
              type="button" 
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" 
              onClick={() => handleDeleteNode(divisionId, "division")}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Department */}
      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2">
          <label className="w-36 font-semibold">Department</label>
          <select 
            className="flex-1 border shadow-sm rounded px-3 py-2" 
            value={departmentId} 
            onChange={e => { 
              setDepartmentId(e.target.value); 
              resetDependentFields("department"); 
            }}
          >
            <option value="">Select Department</option>
            {getDepartmentOptions().map(opt => (
              <option key={opt._id} value={opt._id}>{opt.name}</option>
            ))}
          </select>
          {departmentId && (
            <button 
              type="button" 
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" 
              onClick={() => handleDeleteNode(departmentId, "department")}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Branch */}
      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2">
          <label className="w-36 font-semibold">Branch</label>
          <select 
            className="flex-1 border shadow-sm rounded px-3 py-2" 
            value={branchId} 
            onChange={e => { 
              setBranchId(e.target.value); 
              resetDependentFields("branch"); 
            }}
          >
            <option value="">Select Branch</option>
            {getBranchOptions().map(opt => (
              <option key={opt._id} value={opt._id}>{opt.name}</option>
            ))}
          </select>
          {branchId && (
            <button 
              type="button" 
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" 
              onClick={() => handleDeleteNode(branchId, "branch")}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Cell */}
      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2">
          <label className="w-36 font-semibold">Cell</label>
          <select 
            className="flex-1 border shadow-sm rounded px-3 py-2" 
            value={cellId} 
            onChange={e => { 
              setCellId(e.target.value); 
              resetDependentFields("cell"); 
            }}
          >
            <option value="">Select Cell</option>
            {getCellOptions().map(opt => (
              <option key={opt._id} value={opt._id}>{opt.name}</option>
            ))}
          </select>
          {cellId && (
            <button 
              type="button" 
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" 
              onClick={() => handleDeleteNode(cellId, "cell")}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Desk */}
      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2">
          <label className="w-36 font-semibold">Desk</label>
          <select 
            className="flex-1 border shadow-sm rounded px-3 py-2" 
            value={deskId} 
            onChange={e => setDeskId(e.target.value)}
          >
            <option value="">Select Desk</option>
            {getDeskOptions().map(opt => (
              <option key={opt._id} value={opt._id}>{opt.name}</option>
            ))}
          </select>
          {deskId && (
            <button 
              type="button" 
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" 
              onClick={() => handleDeleteNode(deskId, "desk")}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Permissions Selector */}
      <div className="flex flex-col gap-2 mt-6">
        <label className="font-semibold">Permission Overrides (Optional)</label>
        <select
          value=""
          onChange={e => { 
            const selectedPermission = fetchedPermissions.find(p => p._id === e.target.value);
            if (selectedPermission && !allPermissions.some(p => p._id === selectedPermission._id)) {
              setAllPermissions([...allPermissions, selectedPermission]);
            }
          }}
          className="border rounded px-3 py-2 w-full"
        >
          <option value="">Select Permission Override</option>
          {fetchedPermissions.map(p => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2 mt-2">
          {allPermissions.map(p => (
            <span key={p._id} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
              {p.name} 
              <span 
                onClick={() => setAllPermissions(allPermissions.filter(x => x._id !== p._id))} 
                className="cursor-pointer font-bold"
              >
                ×
              </span>
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          These permissions will override the default role permissions for this specific assignment.
        </p>
      </div>

      {/* Create Hierarchy Node Button */}
      <div className="mt-6">
        <button 
          type="button" 
          onClick={() => setActionModal({ 
            type: "create", 
            name: "", 
            level: "", 
            parentId: null, 
            open: true 
          })} 
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Create Hierarchy Node
        </button>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-4 border-t">
        <button 
          type="button" 
          onClick={handleCancel} 
          className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
        >
          Cancel
        </button>
        <button 
          type="submit"
          disabled={!selectedRoleId || loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : "Save Assignment"}
        </button>
      </div>

      {/* Create Node Modal */}
      {actionModal.open && actionModal.type === "create" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 shadow-lg">
            <h3 className="text-lg font-bold mb-3">Create Hierarchy Node</h3>
            
           <select 
              className="w-full border rounded px-3 py-2 mb-3" 
              value={actionModal.level} 
              onChange={e => setActionModal({ 
                ...actionModal, 
                level: e.target.value, 
                parentId: null 
              })}
            >
              <option value="">Select Level</option>
              <option value="office">Office</option>
              <option value="group">Group</option>
              <option value="division">Division</option>
              <option value="department">Department</option>
              <option value="branch">Branch</option>
              <option value="cell">Cell</option>
              <option value="desk">Desk</option>
            </select>

            <input
              type="text"
              placeholder="Enter name"
              className="w-full border rounded px-3 py-2 mb-3"
              value={actionModal.name}
              onChange={e =>
                setActionModal({ ...actionModal, name: e.target.value })
              }
            />

            {actionModal.level && getParentOptions(actionModal.level).length > 0 && (
              <select
                className="w-full border rounded px-3 py-2 mb-4"
                value={actionModal.parentId || ""}
                onChange={e =>
                  setActionModal({
                    ...actionModal,
                    parentId: e.target.value || null
                  })
                }
              >
                <option value="">Select Parent</option>
                {getParentOptions(actionModal.level).map(parent => (
                  <option key={parent._id} value={parent._id}>
                    {parent.name}
                  </option>
                ))}
              </select>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setActionModal({ type: null, open: false })
                }
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  submitCreate(
                    actionModal.name,
                    actionModal.level,
                    actionModal.parentId
                  )
                }
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
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