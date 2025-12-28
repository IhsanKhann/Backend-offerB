import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";

const CycleModal = ({ onClose, onSuccess, onGenerate }) => {
  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState("");

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("custom");

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("select"); // modes: select | create | edit

  /* ============================
     FETCH ALL CYCLES
  ============================ */
  const fetchCycles = async () => {
    try {
      const res = await api.get("/cycles/all");
      setCycles(res.data.cycles || []);
    } catch (err) {
      console.error("Failed to fetch cycles:", err);
    }
  };

  useEffect(() => {
    fetchCycles();
  }, []);

  /* ============================
     HANDLE SELECT
  ============================ */
  const handleSelectCycle = (cycleId) => {
    setSelectedCycleId(cycleId);

    const cycle = cycles.find(c => c._id === cycleId);
    if (!cycle) return;

    setName(cycle.name);
    setStartDate(cycle.startDate?.slice(0, 10));
    setEndDate(cycle.endDate?.slice(0, 10));
    setDescription(cycle.description || "");
    setType(cycle.type || "custom");

    setMode("edit");
  };

  /* ============================
     CREATE
  ============================ */
  const handleCreate = async () => {
    if (!name || !startDate || !endDate) {
      return alert("Name, start date and end date are required");
    }

    setLoading(true);
    try {
      await api.post("/cycles/create", { name, startDate, endDate, description, type });
      await fetchCycles();
      setMode("select");
      resetForm();
      onSuccess?.();
    } catch (err) {
      console.error("Create cycle failed:", err);
      alert("Failed to create cycle");
    } finally {
      setLoading(false);
    }
  };

  /* ============================
     UPDATE
  ============================ */
  const handleUpdate = async () => {
    if (!selectedCycleId) return;

    setLoading(true);
    try {
      await api.put(`/cycles/update/${selectedCycleId}`, { name, startDate, endDate, description, type });
      await fetchCycles();
      onSuccess?.();
    } catch (err) {
      console.error("Update cycle failed:", err);
      alert("Failed to update cycle");
    } finally {
      setLoading(false);
    }
  };

  /* ============================
     DELETE
  ============================ */
  const handleDelete = async () => {
    if (!selectedCycleId) return;

    if (!window.confirm("Delete this cycle?")) return;

    setLoading(true);
    try {
      await api.delete(`/cycles/delete/${selectedCycleId}`);
      resetForm();
      setMode("select");
      await fetchCycles();
      onSuccess?.();
    } catch (err) {
      console.error("Delete cycle failed:", err);
      alert("Failed to delete cycle");
    } finally {
      setLoading(false);
    }
  };

  /* ============================
     RESET FORM
  ============================ */
  const resetForm = () => {
    setSelectedCycleId("");
    setName("");
    setStartDate("");
    setEndDate("");
    setDescription("");
    setType("custom");
  };

  /* ============================
     GENERATE
  ============================ */
  const handleGenerate = () => {
    if (!selectedCycleId) return alert("Please select a cycle first!");
    const cycleData = { _id: selectedCycleId, name, startDate, endDate, description, type };
    console.log("📤 Generating with cycle:", cycleData);
    onGenerate?.(cycleData); // Send to parent/controller
    onClose?.();
  };

  /* ============================
     RENDER
  ============================ */
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white rounded-xl p-6 w-[460px]">

        <h3 className="text-xl font-bold mb-4">Manage Expense Cycles</h3>

        {/* SELECT CYCLE */}
        <div className="mb-4">
          <label className="text-sm text-gray-600">Select Existing Cycle</label>
          <select
            value={selectedCycleId}
            onChange={e => handleSelectCycle(e.target.value)}
            className="w-full border rounded-lg p-2"
          >
            <option value="">-- Select Cycle --</option>
            {cycles.map(cycle => (
              <option key={cycle._id} value={cycle._id}>
                {cycle.name}
              </option>
            ))}
          </select>
        </div>

        {/* SHOW SELECTED CYCLE */}
        {selectedCycleId && (
          <div className="mb-4 p-2 bg-gray-100 border rounded text-gray-700">
            <p><strong>Selected Cycle:</strong> {name}</p>
            <p><strong>Start:</strong> {startDate}</p>
            <p><strong>End:</strong> {endDate}</p>
          </div>
        )}

        {/* FORM */}
        {(mode === "create" || mode === "edit") && (
          <div className="space-y-6">
            <input
              placeholder="Cycle Name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border rounded-lg p-2"
            />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full border rounded-lg p-2"
            />
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full border rounded-lg p-2"
            />
            <textarea
              placeholder="Description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full border rounded-lg p-2"
              rows={2}
            />
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full border rounded-lg p-2"
            >
              <option value="custom">Custom</option>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => { resetForm(); setMode("create"); }}
            className="border px-3 py-2 rounded-lg"
          >
            + New Cycle
          </button>

          <div className="flex gap-2">
            {mode === "edit" && (
              <>
                <button
                  onClick={handleUpdate}
                  disabled={loading}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg"
                >
                  Update
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg"
                >
                  Delete
                </button>
              </>
            )}

            {mode === "create" && (
              <button
                onClick={handleCreate}
                disabled={loading}
                className="bg-green-500 text-white px-4 py-2 rounded-lg"
              >
                Create
              </button>
            )}

            {/* NEW GENERATE BUTTON */}
            <button
              onClick={handleGenerate}
              className="bg-purple-500 text-white px-4 py-2 rounded-lg"
            >
              Generate
            </button>

            <button
              onClick={onClose}
              className="border px-4 py-2 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CycleModal;
