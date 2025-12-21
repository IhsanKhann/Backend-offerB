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
  const [showInstructions, setShowInstructions] = useState(false);
  const [ruleType, setRuleType] = useState("all"); // "all", "orders", "taxes"

  /** 📥 Fetch data */
  const fetchData = async () => {
    setLoading(true);
    try {
      const defsRes = await api.get("/summaries/fieldlines/definitions");
      setDefinitions(defsRes.data?.data || defsRes.data || []);

      const sumsRes = await api.get("/summaries");
      const summariesData = sumsRes.data?.data || sumsRes.data || [];
      setSummaries(Array.isArray(summariesData) ? summariesData : []);

      const rulesRes = await api.get("/summaries/breakupRules");
      const rulesData = rulesRes.data?.data || rulesRes.data || [];
      setRules(Array.isArray(rulesData) ? rulesData : []);
    } catch (err) {
      setError("⚠️ Could not load breakup rules.");
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter rules based on type
  const filteredRules = rules.filter(rule => {
    if (ruleType === "all") return true;
    if (ruleType === "orders") return !rule.transactionType?.includes("Tax");
    if (ruleType === "taxes") return rule.transactionType?.includes("Tax");
    return true;
  });

  // Add safe mapping functions to prevent errors
  const safeMapSummaries = (callback) => {
    if (!Array.isArray(summaries)) return [];
    return summaries.map(callback);
  };

  const safeMapDefinitions = (callback) => {
    if (!Array.isArray(definitions)) return [];
    return definitions.map(callback);
  };

  const safeMapRules = (callback) => {
    if (!Array.isArray(filteredRules)) return [];
    return filteredRules.map(callback);
  };

  /** ✏️ Editing */
  const handleEdit = (rule) => {
    const editable = JSON.parse(JSON.stringify(rule));
    editable.splits = editable.splits || [];
    editable.splits.forEach((s) => {
      s.mirrors = s.mirrors || [];
      // Ensure tax-specific fields have defaults
      if (rule.transactionType?.includes("Tax")) {
        s.isActual = s.isActual !== undefined ? s.isActual : true;
        s.perTransaction = s.perTransaction !== undefined ? s.perTransaction : true;
        s.periodicity = s.periodicity || "none";
        s.slabStart = s.slabStart || 0;
        s.slabEnd = s.slabEnd || null;
        s.fixedTax = s.fixedTax || 0;
        s.additionalTaxPercentage = s.additionalTaxPercentage || 0;
      }
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

  /** 🔄 Input Change */
  const handleInputChange = (splitIdx, mirrorIdx, field, value) => {
    const updated = JSON.parse(JSON.stringify(formData));
    if (mirrorIdx !== undefined) {
      if (!updated.splits[splitIdx]?.mirrors) {
        updated.splits[splitIdx].mirrors = [];
      }
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
      // Set default values based on rule type
      const ruleData = { ...formData };
      if (ruleData.transactionType?.includes("Tax")) {
        ruleData.splits = ruleData.splits.map(split => ({
          ...split,
          isActual: split.isActual !== undefined ? split.isActual : true,
          perTransaction: split.perTransaction !== undefined ? split.perTransaction : true,
          periodicity: split.periodicity || "none",
          slabStart: split.slabStart || 0,
          slabEnd: split.slabEnd || null,
          fixedTax: split.fixedTax || 0,
          additionalTaxPercentage: split.additionalTaxPercentage || 0,
        }));
      }
      
      await api.post("/summaries/breakupRules", ruleData);
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
    setFormData((prev) => {
    const baseSplit = {
      componentName: "",
      type: "income",
      definitionId: "",
      summaryId: "",
      debitOrCredit: "debit",
      percentage: 0,
      fixedAmount: 0,
      mirrors: [],
      isReflectionOnly: false, // ✅ added
    };

      // Add tax-specific fields if this is a tax rule
      const isTaxRule = prev.transactionType?.includes("Tax");
        const taxFields = isTaxRule ? {
        isActual: true,
        perTransaction: true,
        periodicity: "none",
        slabStart: 0,
        slabEnd: null,
        fixedTax: 0,
        additionalTaxPercentage: 0,
        isReflectionOnly: false, // ✅ keep consistent
      } : {};

      return {
        ...prev,
        splits: [
          ...(prev.splits || []),
          { ...baseSplit, ...taxFields }
        ],
      };
    });
  };

  const addMirror = (splitIdx) => {
    const updated = JSON.parse(JSON.stringify(formData));
    if (!updated.splits[splitIdx]?.mirrors) {
      updated.splits[splitIdx].mirrors = [];
    }
    updated.splits[splitIdx].mirrors.push({
      definitionId: "",
      summaryId: "",
      debitOrCredit: "debit",
      fallback: "none",
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
    if (updated.splits[splitIdx]?.mirrors) {
      updated.splits[splitIdx].mirrors.splice(mirrorIdx, 1);
    }
    setFormData(updated);
  };

  // Check if current rule is a tax rule
  const isTaxRule = formData.transactionType?.includes("Tax");

  /** 🎨 Render */
  if (loading) return <p className="text-gray-500 text-center">Loading…</p>;
  if (error) return <p className="text-red-600 text-center">{error}</p>;

  return (
    <div className="p-6 space-y-8">
      {/* Header with Instructions Button and Filter */}
      <div className="flex justify-between items-center">
            
        <h1 className="text-2xl font-bold text-gray-800">Business Rules Management</h1>
        <div className="flex items-center space-x-4">
          {/* Rule Type Filter */}
          <div className="flex space-x-2">
            <button
              onClick={() => setRuleType("all")}
              className={`px-3 py-1 rounded ${
                ruleType === "all" ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              All Rules
            </button>
            <button
              onClick={() => setRuleType("orders")}
              className={`px-3 py-1 rounded ${
                ruleType === "orders" ? "bg-green-500 text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              Order Rules
            </button>
            <button
              onClick={() => setRuleType("taxes")}
              className={`px-3 py-1 rounded ${
                ruleType === "taxes" ? "bg-red-500 text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              Tax Rules
            </button>
          </div>
          
          <button
            onClick={() => setShowInstructions(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            📖 Check Instructions
          </button>
        </div>
      </div>

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Business Rules Guide</h2>
              <button
                onClick={() => setShowInstructions(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* Order Rules vs Tax Rules */}
              <section>
                <h3 className="text-lg font-semibold text-purple-600 mb-2">🏷️ Order Rules vs Tax Rules</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-green-50 p-3 rounded-lg">
                    <strong>📦 Order Rules</strong>
                    <p className="text-sm mt-1">Handle basic transaction splitting for:</p>
                    <ul className="text-xs mt-1 space-y-1">
                      <li>• Retail - Direct customer sales</li>
                      <li>• Wholesale - Business-to-business sales</li>
                      <li>• Service Provider - Service transactions</li>
                      <li>• Auction - Bid-based sales</li>
                    </ul>
                    <p className="text-xs mt-2"><strong>Fields:</strong> Basic percentage/fixed amount splits</p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <strong>💰 Tax Rules</strong>
                    <p className="text-sm mt-1">Handle complex tax calculations for:</p>
                    <ul className="text-xs mt-1 space-y-1">
                      <li>• RetailTax - Retail transaction taxes</li>
                      <li>• WholesaleTax - Wholesale transaction taxes</li>
                      <li>• ServiceTax - Service transaction taxes</li>
                      <li>• AuctionTax - Auction transaction taxes</li>
                    </ul>
                    <p className="text-xs mt-2"><strong>Fields:</strong> Tax slabs, periods, fixed taxes, additional percentages</p>
                  </div>
                </div>
              </section>

              {/* Tax-Specific Fields Explanation */}
              {isTaxRule && (
                <section>
                  <h3 className="text-lg font-semibold text-red-600 mb-2">🧾 Tax Rule Specific Fields</h3>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div className="bg-red-50 p-2 rounded">
                      <strong>isActual</strong> - Whether this is an actual tax amount or estimated
                    </div>
                    <div className="bg-red-50 p-2 rounded">
                      <strong>perTransaction</strong> - Tax calculated per transaction vs aggregated
                    </div>
                    <div className="bg-red-50 p-2 rounded">
                      <strong>periodicity</strong> - Tax filing frequency (yearly, quarterly, etc.)
                    </div>
                    <div className="bg-red-50 p-2 rounded">
                      <strong>slabStart/slabEnd</strong> - Income slabs for progressive taxation
                    </div>
                    <div className="bg-red-50 p-2 rounded">
                      <strong>fixedTax</strong> - Fixed tax amount regardless of income
                    </div>
                    <div className="bg-red-50 p-2 rounded">
                      <strong>additionalTaxPercentage</strong> - Extra percentage on top of base tax
                    </div>
                  </div>
                </section>
              )}

              {/* Existing instructions sections remain the same */}
              <section>
                <h3 className="text-lg font-semibold text-blue-600 mb-2">🎯 What are Business Rules?</h3>
                <p className="text-gray-700">
                  Business rules automatically split your transaction amounts into different categories 
                  and distribute them to appropriate accounts in your accounting system.
                </p>
              </section>

              {/* ... rest of the instructions sections ... */}

            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowInstructions(false)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules List */}
      {safeMapRules((rule) => (
        <div key={rule._id} className="bg-white rounded-2xl shadow p-6">
          {/* Header with Rule Type Badge */}
          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-semibold text-gray-800">
                  {rule.transactionType}
                </h3>
                <span className={`px-2 py-1 text-xs rounded ${
                  rule.transactionType?.includes("Tax") 
                    ? "bg-red-100 text-red-800" 
                    : "bg-green-100 text-green-800"
                }`}>
                  {rule.transactionType?.includes("Tax") ? "Tax Rule" : "Order Rule"}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                {rule.splits?.length || 0} splits • {rule.splits?.reduce((acc, split) => acc + (split.mirrors?.length || 0), 0)} mirrors
              </p>
            </div>
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
          {(editRuleId === rule._id ? formData.splits : rule.splits || []).map(
            (split, splitIdx) => (
              <div
                key={splitIdx}
                className="border p-3 mb-3 rounded-xl bg-gray-50 shadow-sm"
              >
                {editRuleId === rule._id ? (
                  <div className="space-y-3">
                    {/* Basic Split Fields */}
                    <div className="flex flex-wrap gap-3 items-center">

                      <input
                        type="text"
                        value={split.componentName || ''}
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
                        value={split.type || 'income'}
                        onChange={(e) =>
                          handleInputChange(splitIdx, undefined, "type", e.target.value)
                        }
                        className="border p-2 rounded w-32"
                      >
                        <option value="income">Income</option>
                        <option value="deduction">Deduction</option>
                        <option value="tax">Tax</option>
                        <option value="commission">Commission</option>
                        <option value="receivable">Receivable</option>
                        <option value="base">Base</option>
                        <option value="allowance">Allowance</option>
                        <option value="payable">Payable</option>
                      </select>
                      <input
                        type="number"
                        value={split.percentage || 0}
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
                        value={split.fixedAmount || 0}
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
                        value={split.debitOrCredit || 'debit'}
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
                    </div>

                    {/* Definition and Summary Selection */}
                    <div className="flex flex-wrap gap-3 items-center">
                      <select
                        value={split.definitionId || ''}
                        onChange={(e) =>
                          handleInputChange(splitIdx, undefined, "definitionId", e.target.value)
                        }
                        className="border p-2 rounded w-64"
                      >
                        <option value="">Select Definition</option>
                        {safeMapDefinitions((def) => (
                          <option key={def._id} value={def._id}>
                            {def.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={split.summaryId || ''}
                        onChange={(e) =>
                          handleInputChange(splitIdx, undefined, "summaryId", e.target.value)
                        }
                        className="border p-2 rounded w-64"
                      >
                        <option value="">Select Summary</option>
                        {safeMapSummaries((sum) => (
                          <option key={sum._id} value={sum._id}>
                            {sum.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Tax-Specific Fields (only for tax rules) */}
                    {isTaxRule && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-red-50 rounded">
                        <div>
                          <label className="block text-xs font-medium text-red-700">Is Actual</label>
                          <select
                            value={split.isActual ? "true" : "false"}
                            onChange={(e) =>
                              handleInputChange(splitIdx, undefined, "isActual", e.target.value === "true")
                            }
                            className="border p-2 rounded w-full"
                          >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-red-700">Per Transaction</label>
                          <select
                            value={split.perTransaction ? "true" : "false"}
                            onChange={(e) =>
                              handleInputChange(splitIdx, undefined, "perTransaction", e.target.value === "true")
                            }
                            className="border p-2 rounded w-full"
                          >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-red-700">Periodicity</label>
                          <select
                            value={split.periodicity || "none"}
                            onChange={(e) =>
                              handleInputChange(splitIdx, undefined, "periodicity", e.target.value)
                            }
                            className="border p-2 rounded w-full"
                          >
                            <option value="none">None</option>
                            <option value="yearly">Yearly</option>
                            <option value="biannual">Biannual</option>
                            <option value="quarterly">Quarterly</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-red-700">Fixed Tax</label>
                          <input
                            type="number"
                            value={split.fixedTax || 0}
                            onChange={(e) =>
                              handleInputChange(splitIdx, undefined, "fixedTax", Number(e.target.value))
                            }
                            className="border p-2 rounded w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-red-700">Slab Start</label>
                          <input
                            type="number"
                            value={split.slabStart || 0}
                            onChange={(e) =>
                              handleInputChange(splitIdx, undefined, "slabStart", Number(e.target.value))
                            }
                            className="border p-2 rounded w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-red-700">Slab End</label>
                          <input
                            type="number"
                            value={split.slabEnd || ""}
                            onChange={(e) =>
                              handleInputChange(splitIdx, undefined, "slabEnd", e.target.value ? Number(e.target.value) : null)
                            }
                            placeholder="Leave empty for no limit"
                            className="border p-2 rounded w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-red-700">Additional Tax %</label>
                          <input
                            type="number"
                            value={split.additionalTaxPercentage || 0}
                            onChange={(e) =>
                              handleInputChange(splitIdx, undefined, "additionalTaxPercentage", Number(e.target.value))
                            }
                            className="border p-2 rounded w-full"
                          />
                        </div>
                      </div>
                    )}

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

                {/* Mirrors Section (same as before) */}
                <div className="ml-6 mt-2">
                  {(split.mirrors || []).map((mirror, mIdx) => (
                    <div key={mIdx} className="mt-1 flex items-center gap-3">
                      {editRuleId === rule._id ? (
                        <>

                        <div className="flex items-center space-x-2">
  <label className="text-xs text-gray-700">Reflection Only</label>
  <select
    value={split.isReflectionOnly ? "true" : "false"}
    onChange={(e) =>
      handleInputChange(
        splitIdx,
        undefined,
        "isReflectionOnly",
        e.target.value === "true"
      )
    }
    className="border p-2 rounded w-28"
  >
    <option value="false">No</option>
    <option value="true">Yes</option>
  </select>
</div>

                          <select
                            value={mirror.definitionId || ''}
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
                            {safeMapDefinitions((def) => (
                              <option key={def._id} value={def._id}>
                                {def.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={mirror.summaryId || ''}
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
                            {safeMapSummaries((sum) => (
                              <option key={sum._id} value={sum._id}>
                                {sum.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={mirror.debitOrCredit || 'debit'}
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
                          <select
                            value={mirror.fallback || 'none'}
                            onChange={(e) =>
                              handleInputChange(
                                splitIdx,
                                mIdx,
                                "fallback",
                                e.target.value
                              )
                            }
                            className="border p-2 rounded w-32"
                          >
                            <option value="none">No Fallback</option>
                            <option value="capital">Capital Fallback</option>
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
  <div className="space-y-4">
    <button
      onClick={() => {
        setEditRuleId("new");
        setFormData({
          transactionType: "",
          category: "business", // ✅ default to schema default
          splits: [],
          incrementType: "both",
        });
      }}
      className="px-4 py-2 bg-green-500 text-white rounded"
    >
      + Create New Rule
    </button>
  </div>
)}

{editRuleId === "new" && (
  <div className="bg-white rounded-2xl shadow p-6 mt-4">
    <div className="grid md:grid-cols-2 gap-4 mb-4">
      {/* Transaction Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Transaction Type
        </label>
        <input
          type="text"
          placeholder="e.g., retail, wholesale, service"
          value={formData.transactionType || ""}
          onChange={(e) =>
            setFormData({ ...formData, transactionType: e.target.value })
          }
          className="border p-2 rounded w-full"
        />
        <p className="text-xs text-gray-500 mt-1">
          Use a unique keyword for each type (e.g., <code>retail</code>,{" "}
          <code>wholesale</code>, <code>service</code>)
        </p>
      </div>

      {/* Category Dropdown */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Category
        </label>
        <select
          value={formData.category || "business"}
          onChange={(e) =>
            setFormData({ ...formData, category: e.target.value })
          }
          className="border p-2 rounded w-full"
        >
          <option value="business">Business</option>
          <option value="order">Order</option>
          <option value="tax">Tax</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          ⚠️ If set to <strong>"order"</strong>, this rule will be used for
          transaction triggers.
        </p>
      </div>

      {/* Increment Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Increment Type
        </label>
        <select
          value={formData.incrementType || "both"}
          onChange={(e) =>
            setFormData({ ...formData, incrementType: e.target.value })
          }
          className="border p-2 rounded w-full"
        >
          <option value="fixed">Fixed Amount Only</option>
          <option value="percentage">Percentage Only</option>
          <option value="both">Both Fixed and Percentage</option>
        </select>
      </div>
    </div>

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