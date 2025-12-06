import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";
import SidebarNav from "../../components/Sidebar.jsx";

export default function RulesTable() {
  const [rules, setRules] = useState([]);
  const [definitions, setDefinitions] = useState([]);
  const [editRuleId, setEditRuleId] = useState(null);
  const [formData, setFormData] = useState({ splits: [] });
  const [originalData, setOriginalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /** Sidebar nav items */
  const navItems = [
    { name: "SalaryDashboard", path: "/salary-dashboard" },
    { name: "All Summaries", path: "/summary-table"},
    { name: "Non-Business Tables", path: "/tables" },
    { name: "Business Breakup Tables", path: "/BussinessBreakupTables" },
    { name: "Salary Rules", path: "/salary/rulesTable" },
    { name: "Testing", path: "/paymentDashboard"},
  ];

  /** 🔍 Find instance by ID (plus definitionId) */
  const findInstanceById = (id) => {
    if (!id) return null;
    const idStr = id.toString();
    for (let def of definitions) {
      for (let inst of def.instances || []) {
        if (inst._id.toString() === idStr)
          return { ...inst, definitionId: def._id }; // ⭐ NEW
      }
    }
    return null;
  };

  /** 📥 Fetch all data */
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const defsRes = await api.get("/summaries/fieldlines/definitions");
      setDefinitions(defsRes.data || []);

      const rulesRes = await api.get("/summaries/rulesInstances");
      setRules(rulesRes.data || []);
    } catch (err) {
      setError("⚠️ Could not load rules and definitions. Please refresh or try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  /** ✏️ Editing */
  const handleEdit = (rule) => {
    const editable = JSON.parse(JSON.stringify(rule));
    editable.splits = editable.splits || [];

    editable.splits.forEach(s => {
      if (s.isReflection === undefined) s.isReflection = false;
      s.mirrors = s.mirrors || [];
      s.mirrors.forEach(m => {
        if (m.isReflection === undefined) m.isReflection = false;
      });
    });

    setEditRuleId(rule._id);
    setFormData(editable);
    setOriginalData(rule);
  };

  const handleCancel = () => {
    setEditRuleId(null);
    setFormData({ splits: [] });
    setOriginalData(null);
  };

  /** 🔄 Input Change — now sets definitionId */
  const handleInputChange = (splitIdx, mirrorIdx, field, value) => {
    const updated = JSON.parse(JSON.stringify(formData));

    if (mirrorIdx !== undefined) {
      updated.splits[splitIdx].mirrors[mirrorIdx][field] = value;

      if (field === "instanceId") {
        const inst = findInstanceById(value);
        if (inst) {
          updated.splits[splitIdx].mirrors[mirrorIdx].summaryId = inst.summaryId;
          updated.splits[splitIdx].mirrors[mirrorIdx].definitionId = inst.definitionId; // ⭐ NEW
        }
      }
    } else {
      updated.splits[splitIdx][field] = value;

      if (field === "instanceId") {
        const inst = findInstanceById(value);
        if (inst) {
          updated.splits[splitIdx].summaryId = inst.summaryId;
          updated.splits[splitIdx].definitionId = inst.definitionId; // ⭐ NEW
        }
      }
    }

    setFormData(updated);
  };

  /** 📝 Save */
  const hasChanges = () => JSON.stringify(formData) !== JSON.stringify(originalData);

  const handleSave = async () => {
    if (!hasChanges()) return handleCancel();

    try {
      console.log("🚀 Sending to backend:", formData);
      await api.put(`/summaries/rules/${formData._id}/update`, formData);
      fetchData();
      handleCancel();
    } catch (err) {
      console.error(err);
      setError("❌ Failed to save changes. Please check the inputs and try again.");
    }
  };

  const handleCreateRule = async () => {
    try {
      await api.post("/summaries/rules", formData);
      fetchData();
      handleCancel();
    } catch (err) {
      setError("❌ Failed to create rule.");
    }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm("Delete this rule?")) return;
    try {
      await api.delete(`/summaries/rules/${id}`);
      fetchData();
    } catch (err) {
      setError("❌ Failed to delete rule.");
    }
  };

  /** ➕ Add Split */
  const addSplit = () => {
    const split = {
      fieldName: "",
      percentage: 0,
      fixedAmount: 0,
      debitOrCredit: "debit",
      instanceId: "",
      summaryId: "",
      definitionId: "", // ⭐ NEW
      isReflection: false,
      mirrors: [],
    };

    setFormData((prev) => ({ ...prev, splits: [...(prev.splits || []), split] }));
  };

  /** ➕ Add Mirror */
  const addMirror = (splitIdx) => {
    const mirror = {
      instanceId: "",
      summaryId: "",
      definitionId: "", // ⭐ NEW
      debitOrCredit: "debit",
      isReflection: false,
    };

    const updated = JSON.parse(JSON.stringify(formData));
    updated.splits[splitIdx].mirrors.push(mirror);
    setFormData(updated);
  };

  const deleteSplit = (splitIdx) => {
    const updated = JSON.parse(JSON.stringify(formData));
    updated.splits.splice(splitIdx, 1);
    setFormData(updated);
  };

  const deleteMirror = (splitIdx, mirrorIdx) => {
    const updated = JSON.parse(JSON.stringify(formData));
    updated.splits[splitIdx].mirrors.splice(mirrorIdx, 1);
    setFormData(updated);
  };

  /** 🎨 Render */
  if (loading) return <p className="text-gray-500 text-center">Loading rules…</p>;
  if (error) return <p className="text-red-600 text-center">{error}</p>;

  return (
    <div className="flex">
      <SidebarNav title="Rules Navigation" navItems={navItems} />

      <main className="flex-1 p-6 space-y-8 bg-gray-50 min-h-screen">
        {/* Info Block */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <h2 className="font-semibold text-blue-800">ℹ️ How Rules Work</h2>
          <p className="text-sm text-gray-700 mt-1">
            Each rule determines how a transaction is split across Summary Field Line Instances.
            Splits create primary allocations; mirrors create balancing entries.
          </p>
        </div>

        {/* Each Rule */}
        {rules.map((rule) => (
          <div key={rule._id} className="bg-white rounded-2xl shadow p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">{rule.transactionType}</h3>

              <div className="space-x-2">
                {editRuleId === rule._id ? (
                  <>
                    <button onClick={handleSave} className="px-3 py-1 bg-green-500 text-white rounded">Save</button>
                    <button onClick={handleCancel} className="px-3 py-1 bg-gray-300 rounded">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => handleEdit(rule)} className="px-3 py-1 bg-blue-500 text-white rounded">Edit</button>
                )}
                <button onClick={() => handleDeleteRule(rule._id)} className="px-3 py-1 bg-red-500 text-white rounded">Delete</button>
              </div>
            </div>

            {/* Splits */}
            {(editRuleId === rule._id ? formData.splits : rule.splits || []).map((split, splitIdx) => (
              <div key={splitIdx} className="border p-3 mb-3 rounded-xl bg-gray-50 shadow-sm">
                {editRuleId === rule._id ? (
                  <div className="flex flex-wrap gap-3 items-center">
                    {/* fieldName */}
                    <input
                      type="text"
                      value={split.fieldName}
                      onChange={(e) => handleInputChange(splitIdx, undefined, "fieldName", e.target.value)}
                      placeholder="Field Name"
                      className="border p-2 rounded w-48"
                    />

                    {/* percentage */}
                    <input
                      type="number"
                      value={split.percentage}
                      onChange={(e) => handleInputChange(splitIdx, undefined, "percentage", Number(e.target.value))}
                      placeholder="%"
                      className="border p-2 rounded w-24"
                    />

                    {/* amount */}
                    <input
                      type="number"
                      value={split.fixedAmount}
                      onChange={(e) => handleInputChange(splitIdx, undefined, "fixedAmount", Number(e.target.value))}
                      placeholder="Amount"
                      className="border p-2 rounded w-28"
                    />

                    {/* D/C */}
                    <select
                      value={split.debitOrCredit}
                      onChange={(e) => handleInputChange(splitIdx, undefined, "debitOrCredit", e.target.value)}
                      className="border p-2 rounded w-28"
                    >
                      <option value="debit">Debit</option>
                      <option value="credit">Credit</option>
                    </select>

                    {/* Instance selector */}
                    <select
                      value={split.instanceId}
                      onChange={(e) => handleInputChange(splitIdx, undefined, "instanceId", e.target.value)}
                      className="border p-2 rounded w-72"
                    >
                      <option value="">Select Instance</option>
                      {definitions.map((def) => (
                        <optgroup key={def._id} label={def.name}>
                          {(def.instances || []).map((inst) => (
                            <option key={inst._id} value={inst._id}>
                              {def.name} → {inst.name} ({inst.summaryName})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    {/* isReflection */}
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={split.isReflection || false}
                        onChange={(e) => handleInputChange(splitIdx, undefined, "isReflection", e.target.checked)}
                      />
                      <span className="text-sm">Reflection?</span>
                    </label>

                    <button onClick={() => deleteSplit(splitIdx)} className="px-3 py-1 bg-red-500 text-white rounded">
                      Delete Split
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-gray-700 font-medium">
                      {findInstanceById(split.instanceId)?.name}
                    </p>
                    <div className="text-sm text-gray-500">
                      {split.isReflection ? "Reflection" : "Primary"}
                    </div>
                  </div>
                )}

                {/* Mirrors */}
                <div className="ml-6 mt-2">
                  {(split.mirrors || []).map((mirror, mIdx) => (
                    <div key={mIdx} className="mt-1 flex items-center gap-3">
                      {editRuleId === rule._id ? (
                        <>
                          <select
                            value={mirror.instanceId}
                            onChange={(e) => handleInputChange(splitIdx, mIdx, "instanceId", e.target.value)}
                            className="border p-2 rounded w-72"
                          >
                            <option value="">Select Instance</option>
                            {definitions.map((def) => (
                              <optgroup key={def._id} label={def.name}>
                                {(def.instances || []).map((inst) => (
                                  <option key={inst._id} value={inst._id}>
                                    {def.name} → {inst.name} ({inst.summaryName})
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>

                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={mirror.isReflection || false}
                              onChange={(e) => handleInputChange(splitIdx, mIdx, "isReflection", e.target.checked)}
                            />
                            <span className="text-sm">Reflection?</span>
                          </label>

                          <select
                            value={mirror.debitOrCredit}
                            onChange={(e) => handleInputChange(splitIdx, mIdx, "debitOrCredit", e.target.value)}
                            className="border p-2 rounded w-28"
                          >
                            <option value="debit">Debit</option>
                            <option value="credit">Credit</option>
                          </select>

                          <button
                            onClick={() => deleteMirror(splitIdx, mIdx)}
                            className="px-3 py-1 bg-red-500 text-white rounded"
                          >
                            Delete Mirror
                          </button>
                        </>
                      ) : (
                        <span className="text-sm text-gray-600">
                          Mirror → {findInstanceById(mirror.instanceId)?.name}{" "}
                          {mirror.isReflection ? "(Reflection)" : ""}
                        </span>
                      )}
                    </div>
                  ))}

                  {editRuleId === rule._id && (
                    <button
                      onClick={() => addMirror(splitIdx)}
                      className="px-3 py-1 bg-blue-500 text-white rounded mt-2"
                    >
                      + Add Mirror
                    </button>
                  )}
                </div>
              </div>
            ))}

            {editRuleId === rule._id && (
              <button
                onClick={addSplit}
                className="px-3 py-1 bg-green-500 text-white rounded mt-2"
              >
                + Add Split
              </button>
            )}
          </div>
        ))}

        {/* Create New Rule */}
        {editRuleId === null && (
          <button
            onClick={() => {
              setEditRuleId("new");
              setFormData({ splits: [] });
              setOriginalData(null);
            }}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            + Create Rule
          </button>
        )}

        {editRuleId === "new" && (
          <div className="bg-white rounded-2xl shadow p-6 mt-4">
            <input
              type="text"
              placeholder="Transaction Type"
              value={formData.transactionType || ""}
              onChange={(e) => setFormData({ ...formData, transactionType: e.target.value })}
              className="border p-2 rounded w-full mb-3"
            />

            <div className="space-x-2">
              <button onClick={handleCreateRule} className="px-3 py-1 bg-green-500 text-white rounded">
                Save Rule
              </button>

              <button onClick={handleCancel} className="px-3 py-1 bg-gray-300 rounded">
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
