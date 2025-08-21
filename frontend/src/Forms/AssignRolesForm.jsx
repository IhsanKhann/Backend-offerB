import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";

// Redux actions
import { assignRolesDraft } from "../store/sliceRoles.jsx";
import { addRolesData, addDraft, updateDraft, cancelEdit, addEmployeeData } from "../store/sliceDraft.jsx";

const AssignRolesForm = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [division, setDivision] = useState("");
  const [department, setDepartment] = useState("");
  const [group, setGroup] = useState("");
  const [cell, setCell] = useState("");
  const [loading, setLoading] = useState(false);
  const [hierarchy, setHierarchy] = useState([]);

  const employeeData = useSelector((state) => state.draft.employeeData);
  const editingDraft = useSelector((state) => state.draft.editingDraft);
  const currentDraftId = useSelector((state) => state.draft.currentDraftId);

  const isEditing = !!editingDraft;

  // Fetch hierarchy safely
  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        setLoading(true);
        const res = await axios.get("http://localhost:3000/api/hierarchy/get-hierarchy");
        console.log("API Response:", res.data);
        setHierarchy(res.data?.divisions || []);
      } catch (err) {
        console.error("Error fetching hierarchy:", err);
        setHierarchy([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHierarchy();
  }, []);

  // populate the store 
  useEffect(()=>{
    const fetchSingleEmployee = async() => {
      if (!employeeId) return;
      try {
        const res = await axios.get(`http://localhost:3000/api/employees/${employeeId}`);
        dispatch(addEmployeeData({ 
          employeeData: res.data.employee, 
         })); 

        dispatch(addRolesData({
          rolesData: res.data.roles,
        }))

        console.log("Employee data upon single fetch: ", res.data.employee)
        console.log("roles data upon single fetch ", res.data.roles)

      } catch (err) {
        console.error(err);
      }
    }
      fetchSingleEmployee();
  },[employeeId,dispatch]);


  // Populate form if editing
  useEffect(() => {
    if (editingDraft?.roles?.role) {
      const roles = editingDraft.roles.role;
      setDivision(roles.division || "");
      setDepartment(roles.department || "");
      setGroup(roles.group || "");
      setCell(roles.cell || "");
    }
  }, [editingDraft]);

  // Derived dropdowns safely
  const departmentsOptions = hierarchy.find(d => d.name === division)?.departments || [];
  const groupsOptions = departmentsOptions.find(dep => dep.name === department)?.groups || [];
  const cellsOptions = groupsOptions.find(g => g.name === group)?.cells || [];

  const handleSubmit = async (e) => {
    e.preventDefault();

    // as ids are stored in the store/draft as well we can get it from there as well if employee id is undefined.

    const currentEmployeeId = employeeId || employeeData?.employeeId || currentDraftId;
    if (!currentEmployeeId) return alert("No employee ID found.");

    const rolesData = { employeeId: currentEmployeeId, role: { division, department, group, cell } };

    try {
      setLoading(true);
      if (isEditing) {

        dispatch(updateDraft(
          { draftId: editingDraft.draftId, roles: rolesData }
        ));
        alert("Draft updated successfully!");
      } else {

        dispatch(assignRolesDraft(rolesData));
        dispatch(addRolesData(rolesData));
        dispatch(addDraft());
        alert("Draft created successfully!");

        try {
          await axios.post("http://localhost:3000/api/employees/roles", rolesData);
        } catch (backendError) {
          console.warn("Backend submission failed, draft saved locally:", backendError);
        }
      }
      navigate("/DraftDashboard");
      setDivision(""); setDepartment(""); setGroup(""); setCell("");
    } catch (err) {
      console.error(err);
      alert("Failed to save roles.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (isEditing) dispatch(cancelEdit());
    navigate("/DraftDashboard");
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-xl">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="bg-white shadow-xl rounded-2xl w-full max-w-2xl p-8">
        <h1 className="text-3xl font-bold text-gray-800 text-center mb-6">
          {isEditing ? "Edit Employee Roles" : "Assign Employee Roles"}
        </h1>

        {employeeData && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Employee Info:</h3>
            <p className="text-blue-600 flex flex-row gap-12">
              <strong>Name:</strong>{employeeData?.individualName || "N/A"} | 
              <strong>ID:</strong> {employeeId || currentDraftId || ""}
              {/* upon reload the employee id will show because it is coming from the url */}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <select value={division} 
            onChange={e => { 
              setDivision(e.target.value); 
              setDepartment(""); 
              setGroup(""); 
              setCell(""); 
            }}>
              <option value="">Select Division</option>
              {hierarchy.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
            </select>

            <select value={department} onChange={e => { 
              setDepartment(e.target.value); 
              setGroup(""); 
              setCell(""); 
            }}>
              <option value="">Select Department</option>
              {departmentsOptions.map(dep => <option key={dep._id} value={dep.name}>{dep.name}</option>)}
            </select>

            <select value={group} onChange={e => { setGroup(e.target.value); setCell(""); }}>
              <option value="">Select Group</option>
              {groupsOptions.map(g => <option key={g._id} value={g.name}>{g.name}</option>)}
            </select>

            <select value={cell} onChange={e => setCell(e.target.value)}>
              <option value="">Select Cell</option>
              {cellsOptions.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div className="flex justify-between pt-6">
            <button type="button" onClick={handleCancel} className="px-6 py-3 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {loading ? "Saving..." : isEditing ? "Update Draft" : "Save as Draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignRolesForm;
