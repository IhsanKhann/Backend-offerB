import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";
import SidebarNav from "../../components/Sidebar.jsx"; 
import { Table, SplitSquareVertical } from "lucide-react";

export default function RulesTable() {
  const [rules, setRules] = useState([]);
  const [definitions, setDefinitions] = useState([]);
  const [editRuleId, setEditRuleId] = useState(null);
  const [formData, setFormData] = useState({ splits: [] });
  const [originalData, setOriginalData] = useState(null); // Track changes
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

  /** 🔍 Find instance by ID */
  const findInstanceById = (id) => {
    if (!id) return null;
    const idStr = id.toString();
    for (let def of definitions) {
      for (let inst of def.instances || []) {
        if (inst._id.toString() === idStr) return inst;
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
    editable.splits.forEach((s) => (s.mirrors = s.mirrors || []));
    setEditRuleId(rule._id);
    setFormData(editable);
    setOriginalData(rule); // save copy for change detection
  };

  const handleCancel = () => {
    setEditRuleId(null);
    setFormData({ splits: [] });
    setOriginalData(null);
  };

  /** 🔄 Input Change */
  const handleInputChange = (splitIdx, mirrorIdx, field, value) => {
    const updated = JSON.parse(JSON.stringify(formData));
    if (mirrorIdx !== undefined) {
      updated.splits[splitIdx].mirrors[mirrorIdx][field] = value;
      if (field === "instanceId") {
        const inst = findInstanceById(value);
        if (inst) updated.splits[splitIdx].mirrors[mirrorIdx].summaryId = inst.summaryId;
      }
    } else {
      updated.splits[splitIdx][field] = value;
      if (field === "instanceId") {
        const inst = findInstanceById(value);
        if (inst) updated.splits[splitIdx].summaryId = inst.summaryId;
      }
    }
    setFormData(updated);
  };

  /** 📝 Save */
  const hasChanges = () => JSON.stringify(formData) !== JSON.stringify(originalData);

  const handleSave = async () => {
    if (!hasChanges()) {
      handleCancel(); // nothing changed → just cancel
      return;
    }
    try {
      await api.put(`/summaries/rules/${formData._id}`, formData);
      fetchData();
      handleCancel();
    } catch (err) {
      setError("❌ Failed to save changes. Please check the inputs and try again.");
    }
  };

  const handleCreateRule = async () => {
    try {
      await api.post("/summaries/rules", formData);
      fetchData();
      handleCancel();
    } catch (err) {
      setError("❌ Failed to create rule. Please try again.");
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

  /** ➕ Splits & Mirrors */
  const addSplit = () => {
    const split = {
      fieldName: "",
      percentage: 0,
      fixedAmount: 0,
      debitOrCredit: "debit",
      instanceId: "",
      summaryId: "",
      mirrors: [],
    };
    setFormData((prev) => ({ ...prev, splits: [...(prev.splits || []), split] }));
  };

  const addMirror = (splitIdx) => {
    const mirror = { instanceId: "", summaryId: "", debitOrCredit: "debit" };
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
      {/* ✅ Sidebar placed inside RulesTable */}
      <SidebarNav title="Rules Navigation" navItems={navItems} />

      {/* ✅ Keep all your original content unchanged */}
      <main className="flex-1 p-6 space-y-8 bg-gray-50 min-h-screen">
        {/* Info Note */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <h2 className="font-semibold text-blue-800">ℹ️ How Rules Work</h2>
          <p className="text-sm text-gray-700 mt-1">
            Each rule defines how a transaction (like Salary or Expense) is split into components.
            <br />
            <strong>Splits</strong> define main allocations, while <strong>Mirrors</strong> let you
            mirror entries across other accounts for balance. Click <em>Edit</em> to see details.
          </p>
        </div>

        {rules.map((rule) => (
          <div key={rule._id} className="bg-white rounded-2xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">{rule.transactionType}</h3>
              <div className="space-x-2">
                {editRuleId === rule._id ? (
                  <>
                    <button
                      onClick={handleSave}
                      className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancel}
                      className="px-3 py-1 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleEdit(rule)}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => handleDeleteRule(rule._id)}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>

            {(editRuleId === rule._id ? formData.splits : rule.splits || []).map(
              (split, splitIdx) => (
                <div key={splitIdx} className="border p-3 mb-3 rounded-xl bg-gray-50 shadow-sm">
                  {editRuleId === rule._id ? (
                    <div className="flex flex-wrap gap-3 items-center">
                      <input
                        type="text"
                        value={split.fieldName}
                        onChange={(e) =>
                          handleInputChange(splitIdx, undefined, "fieldName", e.target.value)
                        }
                        placeholder="Field Name"
                        className="border p-2 rounded w-48"
                      />
                      <input
                        type="number"
                        value={split.percentage}
                        onChange={(e) =>
                          handleInputChange(splitIdx, undefined, "percentage", Number(e.target.value))
                        }
                        placeholder="%"
                        className="border p-2 rounded w-24"
                      />
                      <input
                        type="number"
                        value={split.fixedAmount}
                        onChange={(e) =>
                          handleInputChange(splitIdx, undefined, "fixedAmount", Number(e.target.value))
                        }
                        placeholder="Amount"
                        className="border p-2 rounded w-28"
                      />
                      <select
                        value={split.debitOrCredit}
                        onChange={(e) =>
                          handleInputChange(splitIdx, undefined, "debitOrCredit", e.target.value)
                        }
                        className="border p-2 rounded w-28"
                      >
                        <option value="debit">Debit</option>
                        <option value="credit">Credit</option>
                      </select>
                      <select
                        value={split.instanceId}
                        onChange={(e) =>
                          handleInputChange(splitIdx, undefined, "instanceId", e.target.value)
                        }
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
                      <button
                        onClick={() => deleteSplit(splitIdx)}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Delete Split
                      </button>
                    </div>
                  ) : (
                    <p className="text-gray-700 font-medium">
                      {findInstanceById(split.instanceId)?.name || split.fieldName}
                    </p>
                  )}

                  {/* Mirrors */}
                  <div className="ml-6 mt-2">
                    {(split.mirrors || []).map((mirror, mIdx) => (
                      <div key={mIdx} className="mt-1 flex items-center gap-3">
                        {editRuleId === rule._id ? (
                          <>
                            <select
                              value={mirror.instanceId}
                              onChange={(e) =>
                                handleInputChange(splitIdx, mIdx, "instanceId", e.target.value)
                              }
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
                            <select
                              value={mirror.debitOrCredit}
                              onChange={(e) =>
                                handleInputChange(splitIdx, mIdx, "debitOrCredit", e.target.value)
                              }
                              className="border p-2 rounded w-28"
                            >
                              <option value="debit">Debit</option>
                              <option value="credit">Credit</option>
                            </select>
                            <button
                              onClick={() => deleteMirror(splitIdx, mIdx)}
                              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                            >
                              Delete Mirror
                            </button>
                          </>
                        ) : (
                          <span className="text-sm text-gray-600">
                            Mirror → {findInstanceById(mirror.instanceId)?.name || "Unknown"}
                          </span>
                        )}
                      </div>
                    ))}
                    {editRuleId === rule._id && (
                      <button
                        onClick={() => addMirror(splitIdx)}
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mt-2"
                      >
                        + Add Mirror
                      </button>
                    )}
                  </div>
                </div>
              )
            )}

            {editRuleId === rule._id && (
              <button
                onClick={addSplit}
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 mt-2"
              >
                + Add Split
              </button>
            )}
          </div>
        ))}

        {/* Create New Rule */}
        {editRuleId === null && (
          <button
            onClick={() => setEditRuleId("new")}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
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
              <button
                onClick={handleCreateRule}
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Save Rule
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
