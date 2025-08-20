// src/components/AssignRolesForm.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";

import { useParams } from "react-router-dom";
import { useSelector,useDispatch } from "react-redux";

import { assignRolesDraft } from "../store/sliceRoles.jsx";
import { addDraft,addRolesData } from "../store/sliceDraft.jsx";

const AssignRolesForm = () => {

  const { employeeId } = useParams();

  // Add validation for employeeId
  if (!employeeId) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="bg-white shadow-xl rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error: Employee ID Missing</h1>
          <p className="text-gray-600">Employee ID not found in URL parameters.</p>
        </div>
      </div>
    );
  }

  const [division, setDivision] = useState("");
  const [department, setDepartment] = useState("");
  const [group, setGroup] = useState("");
  const [cell, setCell] = useState("");

  const [hierarchy, setHierarchy] = useState([]); // ✅ should be array
  const [loading, setLoading] = useState(true);

  const dispatch = useDispatch();

  useEffect(() => {
    const fetchHierarchies = async () => {
      try {
        const response = await axios.get(
          "http://localhost:3000/api/hierarchy/get-hierarchy"
        );
        console.log("Fetched hierarchy:", response.data.divisions);

        // ✅ set only the divisions array
        setHierarchy(response.data.divisions || []);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching hierarchy:", error.message);
        setLoading(false);
      }
    };
    fetchHierarchies();
  }, []);

const handleSubmit = async (e) => {
  e.preventDefault();

  const RolesData = {
    employeeId,
    role: { division, department, group, cell },
  };

  try {
    // Save to rolesDraft slice
    dispatch(assignRolesDraft(RolesData));

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

  return (
    <div className="p-6 bg-white rounded-2xl shadow-md max-w-lg mx-auto mt-6">
      <h2 className="text-xl font-semibold mb-4">Assign Roles</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Division */}
        <div>
          <label className="block text-sm font-medium">Division</label>
          <select
            value={division}
            onChange={(e) => {
              setDivision(e.target.value);
              setDepartment("");
              setGroup("");
              setCell("");
            }}
            className="w-full mt-1 p-2 border rounded-lg"
            required
          >
            <option value="">Select Division</option>
            {Array.isArray(hierarchy) && hierarchy.length > 0 ? (
              hierarchy.map((div) => (
                <option key={div._id} value={div._id}>
                  {div.name}
                </option>
              ))
            ) : (
              <option disabled>No divisions available</option>
            )}
          </select>
        </div>

        {/* Department */}
        {division && (
          <div>
            <label className="block text-sm font-medium">Department</label>
            <select
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setGroup("");
                setCell("");
              }}
              className="w-full mt-1 p-2 border rounded-lg"
              required
            >
              <option value="">Select Department</option>
              { 
                hierarchy.find((d) => d._id === division)
                ?.departments.map((dept) => (
                  <option key={dept._id} value={dept._id}>
                    {dept.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Group */}
        {department && (
          <div>
            <label className="block text-sm font-medium">Group</label>
            <select
              value={group}
              onChange={(e) => {
                setGroup(e.target.value);
                setCell("");
              }}
              className="w-full mt-1 p-2 border rounded-lg"
              required
            >
              <option value="">Select Group</option>
              {hierarchy
                .find((d) => d._id === division)
                ?.departments.find((dep) => dep._id === department)
                ?.groups.map((grp) => (
                  <option key={grp._id} value={grp._id}>
                    {grp.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Cell */}
        {group && (
          <div>
            <label className="block text-sm font-medium">Cell</label>
            <select
              value={cell}
              onChange={(e) => setCell(e.target.value)}
              className="w-full mt-1 p-2 border rounded-lg"
              required
            >
              <option value="">Select Cell</option>
              {hierarchy
                .find((d) => d._id === division)
                ?.departments.find((dep) => dep._id === department)
                ?.groups.find((g) => g._id === group)
                ?.cells.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
        >
          Save Roles
        </button>
      </form>
    </div>
  );
};

export default AssignRolesForm;