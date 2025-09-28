import React, { useState, useEffect } from "react";
import api from "../api/axios.js";

export default function FieldLineManager({ summaries, fetchAll }) {
  const [selectedSummary, setSelectedSummary] = useState("");
  const [fieldLineName, setFieldLineName] = useState("");
  const [fieldLineNumericId, setFieldLineNumericId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateFieldLine = async () => {
    if (!selectedSummary) return alert("Select a summary first");
    if (!fieldLineName || !fieldLineNumericId) return alert("Provide name and numeric ID");

    setLoading(true);
    try {
      const payload = {
        summaryId: selectedSummary,          // MongoDB _id of summary
        name: fieldLineName,
        fieldLineNumericId: Number(fieldLineNumericId),
      };

      const res = await api.post("/summaries/createFieldLines", payload);
      setMessage(res.data.message || "Field line created ✅");

      // Reset inputs
      setFieldLineName("");
      setFieldLineNumericId("");
      fetchAll(); // Refresh summaries to show new instance
    } catch (err) {
      console.error(err);
      setMessage("Error creating field line: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // const handleDeleteFieldLine = async () => {
  //   if (!selectedSummary) return alert("Select a summary first");
  //   if (!fieldLineNumericId) return alert("Provide numeric ID of field line to delete");

  //   if (!window.confirm("This will delete the definition AND all instances for this field line. Proceed?"))
  //     return;

  //   setLoading(true);
  //   try {
  //     const payload = {
  //       summaryId: selectedSummary,
  //       fieldLineNumericId: Number(fieldLineNumericId),
  //     };

  //     const res = await api.post("/summaries/deleteFieldLines", payload);
  //     setMessage(res.data.message || "Field line deleted ✅");

  //     setFieldLineName("");
  //     setFieldLineNumericId("");
  //     fetchAll();
  //   } catch (err) {
  //     console.error(err);
  //     setMessage("Error deleting field line: " + (err.response?.data?.error || err.message));
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
      <h2 className="text-lg font-bold mb-4">Manage Field Lines</h2>

      <div className="flex flex-col md:flex-row gap-4 mb-3">
        <select
          value={selectedSummary}
          onChange={(e) => setSelectedSummary(e.target.value)}
          className="border p-2 rounded w-full md:w-60"
        >
          <option value="">-- Select Summary --</option>
          {summaries.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Field Line Name"
          value={fieldLineName}
          onChange={(e) => setFieldLineName(e.target.value)}
          className="border p-2 rounded w-full md:w-60"
        />

        <input
          type="number"
          placeholder="Numeric ID"
          value={fieldLineNumericId}
          onChange={(e) => setFieldLineNumericId(e.target.value)}
          className="border p-2 rounded w-full md:w-40"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCreateFieldLine}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold"
          disabled={loading}
        >
          Create
        </button>
        
        {/* <button
          onClick={handleDeleteFieldLine}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold"
          disabled={loading}
        >
          Delete
        </button> */}

      </div>

      {message && <div className="text-sm text-gray-700 mt-2">{message}</div>}
    </div>
  );
}
