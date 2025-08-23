import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";

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

  // Role state (selected values)
  const [office, setOffice] = useState("");
  const [group, setGroup] = useState("");
  const [division, setDivision] = useState("");
  const [department, setDepartment] = useState("");
  const [branch, setBranch] = useState("");
  const [cell, setCell] = useState("");
  const [desk, setDesk] = useState("");

  // Data + UI state
  const [loading, setLoading] = useState(false);
  const [hierarchy, setHierarchy] = useState({ offices: [] });
  const [employeeError, setEmployeeError] = useState(null);

  // Redux state
  const employeeData = useSelector((state) => state.draft.employeeData);
  const editingDraft = useSelector((state) => state.draft.editingDraft);
  const currentDraftId = useSelector((state) => state.draft.currentDraftId);
  const isEditing = !!editingDraft;

  // fetch roles and employee data..
  const [employee,setEmployee] = useState("");
  const [roles,setRoles] = useState("");

// Fetch Employee independently
useEffect(() => {
  const fetchEmployee = async () => {
    try {
      const res = await axios.get(`http://localhost:3000/api/employees/${employeeId}`);
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

// Fetch Roles separately (optional)
useEffect(() => {
  const fetchRoles = async () => {
    try {
      const res = await axios.get(`http://localhost:3000/api/roles/${employeeId}`);
      if (res.data?.roles) {
        setRoles(res.data.roles);
        dispatch(addRolesData({ rolesData: res.data.roles }));
      } else {
        setRoles([]); // No roles is OK
      }
    } catch (err) {
      console.warn("No roles found yet, continuing...");
      setRoles([]);
    }
  };
  if (employeeId) fetchRoles();
}, [employeeId, dispatch]);


  // 🔹 Fetch hierarchy (runs once)
  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          "http://localhost:3000/api/hierarchy/get-hierarchy"
        );
        if (res.data?.data?.offices) {
          setHierarchy(res.data.data); // { offices: [...] }
        } else if (Array.isArray(res.data?.data)) {
          setHierarchy({ offices: res.data.data });
        } else {
          setHierarchy({ offices: [] });
        }
      } catch (err) {
        console.error("Error fetching hierarchy:", err);
        setHierarchy({ offices: [] });
      } finally {
        setLoading(false);
      }
    };

    fetchHierarchy();
  }, []);

  // 🔹 Prefill when editing draft
  useEffect(() => {
    if (editingDraft?.roles?.role) {
      const {
        office,
        group,
        division,
        department,
        branch,
        cell,
        desk,
      } = editingDraft.roles.role;
      setOffice(office || "");
      setGroup(group || "");
      setDivision(division || "");
      setDepartment(department || "");
      setBranch(branch || "");
      setCell(cell || "");
      setDesk(desk || "");
    }
  }, [editingDraft]);

  // 🔹 Reset dependent dropdowns
  const resetDependentFields = (level) => {
    if (level === "office") {
      setGroup("");
      setDivision("");
      setDepartment("");
      setBranch("");
      setCell("");
      setDesk("");
    } else if (level === "group") {
      setDivision("");
      setDepartment("");
      setBranch("");
      setCell("");
      setDesk("");
    } else if (level === "division") {
      setDepartment("");
      setBranch("");
      setCell("");
      setDesk("");
    } else if (level === "department") {
      setBranch("");
      setCell("");
      setDesk("");
    } else if (level === "branch") {
      setCell("");
      setDesk("");
    } else if (level === "cell") {
      setDesk("");
    }
  };

  // 🔹 Options derivation (handle flexible schema)
const officesOptions = hierarchy?.offices || [];

// Groups OR Divisions OR Departments OR Branches OR Cells OR Desks can live under Office
const groupsOptions =
  officesOptions.find((o) => o.name === office)?.groups || [];

const divisionsOptions =
  (groupsOptions.find((g) => g.name === group)?.divisions || [])
    .concat(officesOptions.find((o) => o.name === office)?.divisions || []);

const departmentsOptions =
  (divisionsOptions.find((d) => d.name === division)?.departments || [])
    .concat(officesOptions.find((o) => o.name === office)?.departments || []);

const branchesOptions =
  (departmentsOptions.find((d) => d.name === department)?.branches || [])
    .concat(officesOptions.find((o) => o.name === office)?.branches || []);

const cellsOptions =
  (branchesOptions.find((b) => b.name === branch)?.cells || [])
    .concat(departmentsOptions.find((d) => d.name === department)?.cells || [])
    .concat(officesOptions.find((o) => o.name === office)?.cells || []);

const desksOptions =
  (cellsOptions.find((c) => c.name === cell)?.desks || [])
    .concat(branchesOptions.find((b) => b.name === branch)?.desks || [])
    .concat(departmentsOptions.find((d) => d.name === department)?.desks || [])
    .concat(officesOptions.find((o) => o.name === office)?.desks || []);

  // 🔹 Submit form
  const handleSubmit = async (e) => {
  e.preventDefault();

  if (!employeeData) {
    alert("No employee found. Please create one first.");
    return;
  }

  const rolesData = {
    employeeId: employeeId || employeeData?.employeeId || currentDraftId,
    autoGeneratedId: employeeData?.employeeId,
    employeeName: employeeData?.individualName,
    role: office || group || division || department || branch || cell || desk
      ? { office, group, division, department, branch, cell, desk }
      : null, // 👈 role can be null
  };

  try {
    setLoading(true);
    if (isEditing) {
      dispatch(updateDraft({ draftId: editingDraft.draftId, roles: rolesData }));
    } else {
      dispatch(assignRolesDraft(rolesData));
      dispatch(addDraft());
      // only send to backend if roles exist
      if (rolesData.role) {
        await axios.post("http://localhost:3000/api/employees/roles", rolesData);
      }
    }
    navigate("/DraftDashboard");
  } catch (err) {
    console.error(err);
    alert("Failed to save draft.");
  } finally {
    setLoading(false);
  }
};

  // 🔹 Cancel
  const handleCancel = () => {
    if (isEditing) dispatch(cancelEdit());
    navigate("/DraftDashboard");
  };

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen">
        Loading...
      </div>
    );

  if (employeeError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
        <h2 className="text-xl text-red-600 mb-4">{employeeError}</h2>
        <button
          onClick={() => navigate("/register-employee")}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Create New Employee
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-3xl mx-auto p-6 bg-white shadow rounded-lg space-y-4"
    >
      <h2 className="text-xl font-semibold text-gray-700 mb-4">Assign Role</h2>
      <div className=" flex flex-row gap-12 font-bold text-blue-600">
          <h2> Name of Employee: {employee?.individualName || "N/A" } </h2>
          <h2> Employee ID: {employee?._id || "N/A" } </h2>
          <h2> Auto Generated Id: {employee?.employeeId || "N/A"} </h2> 
          {/* this is the auto generated id for the employee.. */}
      </div>

      {/* Office */}
      <Dropdown
        label="Office"
        value={office}
        onChange={(val) => {
          setOffice(val);
          resetDependentFields("office");
        }}
        options={officesOptions}
      />

      {/* Group */}
      <Dropdown
        label="Group"
        value={group}
        onChange={(val) => {
          setGroup(val);
          resetDependentFields("group");
        }}
        options={groupsOptions}
      />

      {/* Division */}
      <Dropdown
        label="Division"
        value={division}
        onChange={(val) => {
          setDivision(val);
          resetDependentFields("division");
        }}
        options={divisionsOptions}
      />

      {/* Department */}
      <Dropdown
        label="Department"
        value={department}
        onChange={(val) => {
          setDepartment(val);
          resetDependentFields("department");
        }}
        options={departmentsOptions}
      />

      {/* Branch */}
      <Dropdown
        label="Branch"
        value={branch}
        onChange={(val) => {
          setBranch(val);
          resetDependentFields("branch");
        }}
        options={branchesOptions}
      />

      {/* Cell */}
      <Dropdown
        label="Cell"
        value={cell}
        onChange={(val) => {
          setCell(val);
          resetDependentFields("cell");
        }}
        options={cellsOptions}
      />

      {/* Desk */}
      <Dropdown
        label="Desk"
        value={desk}
        onChange={setDesk}
        options={desksOptions}
      />

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Save
        </button>
      </div>
    </form>
  );
};

// 🔹 Reusable dropdown component
const Dropdown = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-gray-600 mb-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
    >
      <option value="">Select {label}</option>
      {options.map((opt) => (
        <option key={opt._id || opt.name} value={opt.name}>
          {opt.name}
        </option>
      ))}
    </select>
  </div>
);

export default AssignRolesForm;
