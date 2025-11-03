import React, { useState, useEffect } from "react";
import api from "../api/axios.js";

export default function FieldLineManager({ summaries, fetchAll }) {
  const [definitions, setDefinitions] = useState([]);
  const [selectedDefinition, setSelectedDefinition] = useState("");
  const [selectedSummary, setSelectedSummary] = useState("");
  const [defName, setDefName] = useState("");
  const [defNumericId, setDefNumericId] = useState("");
  const [defAccountNumber, setDefAccountNumber] = useState("");
  const [message, setMessage] = useState("");
  const [loadingDef, setLoadingDef] = useState(false);
  const [loadingInst, setLoadingInst] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // ✅ Fetch all definitions
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

  // ✅ Create new Definition only
  const handleCreateDefinition = async () => {
    if (!defName || !defNumericId)
      return alert("Provide a name and numeric ID for the definition");

    setLoadingDef(true);
    setMessage("");

    try {
      const payload = {
        name: defName.trim(),
        fieldLineNumericId: Number(defNumericId),
        accountNumber: defAccountNumber.trim(),
      };

      // 🟢 Use the correct controller for definition creation
      const res = await api.post("/summaries/create-definitions", payload);

      setMessage(res.data.message || "✅ Definition created successfully");
      setDefName("");
      setDefNumericId("");
      setDefAccountNumber("");
      await fetchDefinitions();
      await fetchAll();
    } catch (err) {
      console.error(err);
      setMessage(
        "❌ Error creating definition: " +
          (err.response?.data?.message || err.message)
      );
    } finally {
      setLoadingDef(false);
    }
  };

  // ✅ Create Instance for selected Definition
  const handleCreateInstance = async () => {
    if (!selectedSummary) return alert("Select a summary first");
    if (!selectedDefinition) return alert("Select a definition first");

    setLoadingInst(true);
    setMessage("");

    try {
      const definition = definitions.find((d) => d._id === selectedDefinition);
      if (!definition) return alert("Invalid definition selected");

      const payload = {
        summaryId: selectedSummary,
        name: definition.name,
        fieldLineNumericId: definition.fieldLineNumericId,
        definitionId: definition._id,
      };

      // 🟣 Use the correct controller for instance creation
      const res = await api.post("/summaries/createFieldLines", payload);

      setMessage(res.data.message || "✅ Instance created successfully");
      setSelectedDefinition("");
      setSelectedSummary("");
      await fetchAll();
    } catch (err) {
      console.error(err);
      setMessage(
        "❌ Error creating instance: " +
          (err.response?.data?.message || err.message)
      );
    } finally {
      setLoadingInst(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Manage Field Lines</h2>
        <button
          onClick={() => setShowInfoModal(true)}
          className="text-blue-600 underline text-sm"
        >
          How it works?
        </button>
      </div>

      {/* 🟢 Create Definition Section */}
      <div className="border p-4 rounded-lg mb-4 bg-gray-50">
        <h3 className="font-semibold text-gray-800 mb-2">
          ➕ Create New Definition
        </h3>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            placeholder="Definition Name"
            value={defName}
            onChange={(e) => setDefName(e.target.value)}
            className="border p-2 rounded w-full md:w-60"
          />
          <input
            type="number"
            placeholder="Numeric ID"
            value={defNumericId}
            onChange={(e) => setDefNumericId(e.target.value)}
            className="border p-2 rounded w-full md:w-40"
          />
          <input
            type="text"
            placeholder="Account Number (optional)"
            value={defAccountNumber}
            onChange={(e) => setDefAccountNumber(e.target.value)}
            className="border p-2 rounded w-full md:w-40"
          />
          <button
            onClick={handleCreateDefinition}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold"
            disabled={loadingDef}
          >
            {loadingDef ? "Creating..." : "Create Definition"}
          </button>
        </div>
      </div>

      {/* 🟣 Create Instance Section */}
      <div className="border p-4 rounded-lg bg-gray-50">
        <h3 className="font-semibold text-gray-800 mb-2">
          📄 Create Instance for Definition
        </h3>
        <div className="flex flex-col md:flex-row gap-3">
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

          <select
            value={selectedDefinition}
            onChange={(e) => setSelectedDefinition(e.target.value)}
            className="border p-2 rounded w-full md:w-60"
          >
            <option value="">-- Select Definition --</option>
            {definitions.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} (#{d.fieldLineNumericId})
              </option>
            ))}
          </select>

          <button
            onClick={handleCreateInstance}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold"
            disabled={loadingInst}
          >
            {loadingInst ? "Creating..." : "Create Instance"}
          </button>
        </div>
      </div>

      {/* 🗨️ Message Output */}
      {message && (
        <div className="text-sm text-gray-700 mt-4 border-t pt-2">{message}</div>
      )}

      {/* ℹ️ Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-96">
            <h3 className="text-lg font-bold mb-2">How Field Lines Work</h3>
            <p className="text-gray-700 text-sm mb-3">
              <strong>Definitions</strong> act as reusable templates shared
              across multiple summaries.
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>
                  Use the <strong>first section</strong> to create new
                  definitions (no summary required).
                </li>
                <li>
                  Use the <strong>second section</strong> to create instances for
                  existing definitions (requires summary).
                </li>
                <li>
                  Instances automatically link to their selected definition and
                  summary.
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
