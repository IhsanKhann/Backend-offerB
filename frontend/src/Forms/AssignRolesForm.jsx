
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";

// Redux actions
import { assignRolesDraft } from "../store/sliceRoles.jsx";
import { addRolesData, addDraft, startEditDraft, updateDraft, cancelEdit } from "../store/sliceDraft.jsx";

const AssignRolesForm = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // State for form inputs
  const [division, setDivision] = useState("");
  const [department, setDepartment] = useState("");
  const [group, setGroup] = useState("");
  const [cell, setCell] = useState("");
  const [loading, setLoading] = useState(false);
  const [hierarchy, setHierarchy] = useState({});

  // Redux state
  const employeeData = useSelector((state) => state.draft.employeeData);
  const editingDraft = useSelector((state) => state.draft.editingDraft);
  const currentDraftId = useSelector((state) => state.draft.currentDraftId);

  // Check if we're editing a draft
  const isEditing = !!editingDraft;

  useEffect(() => {
    // Load hierarchy data
    const fetchHierarchy = async () => {
      try {
        setLoading(true);
        const res = await axios.get("http://localhost:3000/api/hierarchy");
        setHierarchy(res.data.data || {});
      } catch (err) {
        console.error("Error fetching hierarchy:", err);
        setHierarchy({
          divisions: ["IT", "HR", "Finance", "Operations"],
          departments: ["Engineering", "Marketing", "Sales"],
          groups: ["Development", "Testing", "Design"],
          cells: ["Frontend", "Backend", "Mobile"]
        });
      } finally {
        setLoading(false);
      }
    };

    fetchHierarchy();

    // If editing, populate form with existing data
    if (editingDraft?.roles) {
      const roles = editingDraft.roles;
      setDivision(roles.role?.division || "");
      setDepartment(roles.role?.department || "");
      setGroup(roles.role?.group || "");
      setCell(roles.role?.cell || "");
    }
  }, [editingDraft]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const currentEmployeeId = employeeId || employeeData?.employeeId || currentDraftId;
    if (!currentEmployeeId) {
      alert("No employee ID found. Please register employee first.");
      return;
    }

    const rolesData = {
      employeeId: currentEmployeeId,
      role: { division, department, group, cell },
    };

    try {
      setLoading(true);

      if (isEditing) {
        // Update existing draft
        dispatch(updateDraft({
          draftId: editingDraft.draftId,
          roles: rolesData,
        }));
        alert("Draft updated successfully!");
        navigate("/DraftDashboard");
      } else {
        // Save to rolesDraft slice
        dispatch(assignRolesDraft(rolesData));

        // Save to draft slice
        dispatch(addRolesData(rolesData));

        // Create draft
        dispatch(addDraft());

        alert("Draft created successfully!");

        // Try to submit to backend (optional)
        try {
          const res = await axios.post("http://localhost:3000/api/employees/roles", rolesData);
          console.log("✅ Roles submitted to backend:", res.data);
        } catch (backendError) {
          console.warn("⚠️ Backend submission failed, but draft saved:", backendError);
        }

        // Navigate to dashboard
        navigate("/DraftDashboard");
      }

      // Reset form
      setDivision("");
      setDepartment("");
      setGroup("");
      setCell("");

    } catch (err) {
      console.error("Error handling roles:", err);
      alert("Failed to save roles.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (isEditing) {
      dispatch(cancelEdit());
    }
    navigate("/DraftDashboard");
  };

<<<<<<< HEAD
  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-xl">Loading...</div>
    </div>
  );
=======
    // Save to draft slice
    dispatch(addRolesData(RolesData));

    // create Draft...
    dispatch(addDraft());

    alert("Draft created successfully. Added to redux store.");

    // Reset
    setDivision("");
    setDepartment("");
    setGroup("");
    setCell("");

     const res = await axios.post(
        "http://localhost:3000/api/employees/roles", RolesData
    );

  } catch (err) {
    console.error("Error saving draft:", err);
    alert("Failed to create draft.");
  }
};

    // try{
    //   const res = await axios.post(
    //     "http://localhost:3000/api/employee/roles",
    //     roleAssignment
    //   );

    //   alert("Roles submitted successfully!");
    //   console.log("Roles Assigned:", res.data);
    // } catch (err) {
    //   console.error("Error submitting roles:", err);
    //   alert("Failed to submit roles.");
    // }

  if (loading) return <p>Loading hierarchy...</p>;
>>>>>>> 5e14bb7868226ff4daffbb1b2b4cd37ebfa7e437

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="bg-white shadow-xl rounded-2xl w-full max-w-2xl p-8">
        <h1 className="text-3xl font-bold text-gray-800 text-center mb-6">
          {isEditing ? "Edit Employee Roles" : "Assign Employee Roles"}
        </h1>

        {employeeData && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Employee Info:</h3>
            <p className="text-blue-600">
              <strong>Name:</strong> {employeeData.individualName} | 
              <strong> ID:</strong> {currentEmployeeId}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Division</label>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Division</option>
                {(hierarchy.divisions || []).map((div) => (
                  <option key={div} value={div}>{div}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Department</option>
                {(hierarchy.departments || []).map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Group</label>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Group</option>
                {(hierarchy.groups || []).map((grp) => (
                  <option key={grp} value={grp}>{grp}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cell</label>
              <select
                value={cell}
                onChange={(e) => setCell(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Cell</option>
                {(hierarchy.cells || []).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-between pt-6">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-3 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : isEditing ? "Update Draft" : "Save as Draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignRolesForm;
