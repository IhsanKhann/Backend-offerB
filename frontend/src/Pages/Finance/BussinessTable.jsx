import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";

export default function BreakupRulesTable() {
  const [rules, setRules] = useState([]);
  const [definitions, setDefinitions] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [editRuleId, setEditRuleId] = useState(null);
  const [formData, setFormData] = useState({ splits: [] });
  const [originalData, setOriginalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /** 📥 Fetch data */
  const fetchData = async () => {
    setLoading(true);
    try {
      const defsRes = await api.get("/summaries/fieldlines/definitions");
      setDefinitions(defsRes.data || []);

      const sumsRes = await api.get("/summaries");
      setSummaries(sumsRes.data || []);

      const rulesRes = await api.get("/summaries/breakupRules");
      setRules(rulesRes.data || []);
    } catch (err) {
      setError("⚠️ Could not load breakup rules.");
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
    setOriginalData(rule);
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
    } else {
      updated.splits[splitIdx][field] = value;
    }
    setFormData(updated);
  };

  /** Save / Create / Delete */
  const hasChanges = () =>
    JSON.stringify(formData) !== JSON.stringify(originalData);

  const handleSave = async () => {
    if (!hasChanges()) return handleCancel();
    try {
      await api.put(`/summaries/breakupRules/${formData._id}`, formData);
      fetchData();
      handleCancel();
    } catch (err) {
      setError("❌ Failed to save changes.");
    }
  };

  const handleCreateRule = async () => {
    try {
      await api.post("/summaries/breakupRules", formData);
      fetchData();
      handleCancel();
    } catch (err) {
      setError("❌ Failed to create rule.");
    }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm("Delete this rule?")) return;
    try {
      await api.delete(`/summaries/breakupRules/${id}`);
      fetchData();
    } catch {
      setError("❌ Failed to delete rule.");
    }
  };

  /** ➕ Splits & Mirrors */
  const addSplit = () => {
    setFormData((prev) => ({
      ...prev,
      splits: [
        ...(prev.splits || []),
        {
          componentName: "",
          type: "income",
          percentage: 0,
          fixedAmount: 0,
          debitOrCredit: "debit",
          definitionId: "",
          summaryId: "",
          mirrors: [],
        },
      ],
    }));
  };

  const addMirror = (splitIdx) => {
    const updated = JSON.parse(JSON.stringify(formData));
    updated.splits[splitIdx].mirrors.push({
      definitionId: "",
      summaryId: "",
      debitOrCredit: "debit",
      fallback: "",
    });
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
  if (loading) return <p className="text-gray-500 text-center">Loading…</p>;
  if (error) return <p className="text-red-600 text-center">{error}</p>;

  return (
    <div className="p-6 space-y-8">
      {/* Rules List */}
      {rules.map((rule) => (
        <div key={rule._id} className="bg-white rounded-2xl shadow p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              {rule.transactionType}
            </h3>
            <div className="space-x-2">
              {editRuleId === rule._id ? (
                <>
                  <button
                    onClick={handleSave}
                    className="px-3 py-1 bg-green-500 text-white rounded"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-3 py-1 bg-gray-300 text-gray-800 rounded"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleEdit(rule)}
                  className="px-3 py-1 bg-blue-500 text-white rounded"
                >
                  Edit
                </button>
              )}
              <button
                onClick={() => handleDeleteRule(rule._id)}
                className="px-3 py-1 bg-red-500 text-white rounded"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Splits */}
          {(editRuleId === rule._id ? formData.splits : rule.splits).map(
            (split, splitIdx) => (
              <div
                key={splitIdx}
                className="border p-3 mb-3 rounded-xl bg-gray-50 shadow-sm"
              >
                {editRuleId === rule._id ? (
                  <div className="flex flex-wrap gap-3 items-center">
                    <input
                      type="text"
                      value={split.componentName}
                      onChange={(e) =>
                        handleInputChange(
                          splitIdx,
                          undefined,
                          "componentName",
                          e.target.value
                        )
                      }
                      placeholder="Component Name"
                      className="border p-2 rounded w-48"
                    />
                    <select
                      value={split.type}
                      onChange={(e) =>
                        handleInputChange(splitIdx, undefined, "type", e.target.value)
                      }
                      className="border p-2 rounded w-32"
                    >
                      <option value="income">Income</option>
                      <option value="deduction">Deduction</option>
                      <option value="tax">Tax</option>
                      <option value="receivable">Receivable</option>
                    </select>
                    <input
                      type="number"
                      value={split.percentage}
                      onChange={(e) =>
                        handleInputChange(
                          splitIdx,
                          undefined,
                          "percentage",
                          Number(e.target.value)
                        )
                      }
                      placeholder="%"
                      className="border p-2 rounded w-20"
                    />
                    <input
                      type="number"
                      value={split.fixedAmount}
                      onChange={(e) =>
                        handleInputChange(
                          splitIdx,
                          undefined,
                          "fixedAmount",
                          Number(e.target.value)
                        )
                      }
                      placeholder="Amount"
                      className="border p-2 rounded w-24"
                    />
                    <select
                      value={split.debitOrCredit}
                      onChange={(e) =>
                        handleInputChange(
                          splitIdx,
                          undefined,
                          "debitOrCredit",
                          e.target.value
                        )
                      }
                      className="border p-2 rounded w-28"
                    >
                      <option value="debit">Debit</option>
                      <option value="credit">Credit</option>
                    </select>
                    <select
                      value={split.definitionId}
                      onChange={(e) =>
                        handleInputChange(splitIdx, undefined, "definitionId", e.target.value)
                      }
                      className="border p-2 rounded w-64"
                    >
                      <option value="">Select Definition</option>
                      {definitions.map((def) => (
                        <option key={def._id} value={def._id}>
                          {def.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={split.summaryId}
                      onChange={(e) =>
                        handleInputChange(splitIdx, undefined, "summaryId", e.target.value)
                      }
                      className="border p-2 rounded w-64"
                    >
                      <option value="">Select Summary</option>
                      {summaries.map((sum) => (
                        <option key={sum._id} value={sum._id}>
                          {sum.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => deleteSplit(splitIdx)}
                      className="px-3 py-1 bg-red-500 text-white rounded"
                    >
                      Delete Split
                    </button>
                  </div>
                ) : (
                  <p className="text-gray-700 font-medium">{split.componentName}</p>
                )}

                {/* Mirrors */}
                <div className="ml-6 mt-2">
                  {(split.mirrors || []).map((mirror, mIdx) => (
                    <div key={mIdx} className="mt-1 flex items-center gap-3">
                      {editRuleId === rule._id ? (
                        <>
                          <select
                            value={mirror.definitionId}
                            onChange={(e) =>
                              handleInputChange(
                                splitIdx,
                                mIdx,
                                "definitionId",
                                e.target.value
                              )
                            }
                            className="border p-2 rounded w-64"
                          >
                            <option value="">Select Definition</option>
                            {definitions.map((def) => (
                              <option key={def._id} value={def._id}>
                                {def.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={mirror.summaryId}
                            onChange={(e) =>
                              handleInputChange(
                                splitIdx,
                                mIdx,
                                "summaryId",
                                e.target.value
                              )
                            }
                            className="border p-2 rounded w-64"
                          >
                            <option value="">Select Summary</option>
                            {summaries.map((sum) => (
                              <option key={sum._id} value={sum._id}>
                                {sum.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={mirror.debitOrCredit}
                            onChange={(e) =>
                              handleInputChange(
                                splitIdx,
                                mIdx,
                                "debitOrCredit",
                                e.target.value
                              )
                            }
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
                          Mirror → {mirror.definitionId || "?"}
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
            )
          )}
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
          onClick={() => setEditRuleId("new")}
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
            onChange={(e) =>
              setFormData({ ...formData, transactionType: e.target.value })
            }
            className="border p-2 rounded w-full mb-3"
          />
          <div className="space-x-2">
            <button
              onClick={handleCreateRule}
              className="px-3 py-1 bg-green-500 text-white rounded"
            >
              Save Rule
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 bg-gray-300 text-gray-800 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
