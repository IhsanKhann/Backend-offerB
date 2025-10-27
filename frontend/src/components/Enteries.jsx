import React, { useState, useEffect } from "react";
import api from "../api/axios.js";

export default function FieldLineManager({ summaries, fetchAll }) {
  const [definitions, setDefinitions] = useState([]);
  const [selectedDefinition, setSelectedDefinition] = useState("");
  const [selectedSummary, setSelectedSummary] = useState("");
  const [fieldLineName, setFieldLineName] = useState("");
  const [fieldLineNumericId, setFieldLineNumericId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // ✅ Fetch all definitions for dropdown
  const fetchDefinitions = async () => {
    try {
      const res = await api.get("/summaries/fieldlines/definitions");
      setDefinitions(res.data || []);
    } catch (err) {
      console.error("Error fetching definitions:", err);
    }
  };

  useEffect(() => {
    fetchDefinitions();
  }, []);

  // ✅ Auto-fill name and numeric ID when definition is selected
  useEffect(() => {
    if (selectedDefinition) {
      const def = definitions.find((d) => d._id === selectedDefinition);
      if (def) {
        setFieldLineName(def.name);
        setFieldLineNumericId(def.fieldLineNumericId);
      }
    } else {
      setFieldLineName("");
      setFieldLineNumericId("");
    }
  }, [selectedDefinition]);

  // ✅ Handle create
  const handleCreateFieldLine = async () => {
    if (!selectedSummary) return alert("Select a summary first");
    if (!fieldLineName || !fieldLineNumericId) return alert("Provide name and numeric ID");

    setLoading(true);
    try {
      const payload = {
        summaryId: selectedSummary,
        name: fieldLineName,
        fieldLineNumericId: Number(fieldLineNumericId),
        definitionId: selectedDefinition || undefined,
      };

      const res = await api.post("/summaries/createFieldLines", payload);
      setMessage(res.data.message || "Field line created ✅");

      setSelectedDefinition("");
      setFieldLineName("");
      setFieldLineNumericId("");
      fetchDefinitions(); // refresh dropdown
      fetchAll(); // refresh summaries
    } catch (err) {
      console.error(err);
      setMessage("Error creating field line: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 relative">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Manage Field Lines</h2>
        <button
          onClick={() => setShowInfoModal(true)}
          className="text-blue-600 underline text-sm"
        >
          How it works?
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-3">
        {/* Select Summary */}
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

        {/* Select Definition */}
        <select
          value={selectedDefinition}
          onChange={(e) => setSelectedDefinition(e.target.value)}
          className="border p-2 rounded w-full md:w-60"
        >
          <option value="">-- Select Existing Definition (optional) --</option>
          {definitions.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name} (#{d.fieldLineNumericId})
            </option>
          ))}
        </select>

        {/* Field Line Name */}
        <input
          type="text"
          placeholder="Field Line Name"
          value={fieldLineName}
          onChange={(e) => setFieldLineName(e.target.value)}
          disabled={!!selectedDefinition}
          className="border p-2 rounded w-full md:w-60"
        />

        {/* Numeric ID */}
        <input
          type="number"
          placeholder="Numeric ID"
          value={fieldLineNumericId}
          onChange={(e) => setFieldLineNumericId(e.target.value)}
          disabled={!!selectedDefinition}
          className="border p-2 rounded w-full md:w-40"
        />
      </div>

      <button
        onClick={handleCreateFieldLine}
        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold"
        disabled={loading}
      >
        {loading ? "Creating..." : "Create Field Line"}
      </button>

      {message && <div className="text-sm text-gray-700 mt-2">{message}</div>}

      {/* ℹ️ Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-96">
            <h3 className="text-lg font-bold mb-2">How Field Lines Work</h3>
            <p className="text-gray-700 text-sm mb-3">
              A <strong>Field Line Definition</strong> acts as a template shared across multiple summaries.
              <br /><br />
              To create an instance:
              <ul className="list-disc ml-5 mt-2">
                <li>
                  Select a <strong>Definition</strong> from the dropdown to make an instance of it.
                </li>
                <li>
                  If you leave the definition unselected, a <strong>new Definition</strong> will be created
                  first, and then an instance will be added for it.
                </li>
                <li>
                  Instances belong to a <strong>Summary</strong> and inherit the Definition’s name & numeric ID.
                </li>
                <li>
                  Duplicates (same summary + definition) are automatically prevented.
                </li>
              </ul>
            </p>
            <div className="text-right">
              <button
                onClick={() => setShowInfoModal(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
