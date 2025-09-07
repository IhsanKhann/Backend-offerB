import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";

export default function RulesTable() {
  const [rules, setRules] = useState([]);
  const [editRuleId, setEditRuleId] = useState(null); 
  const [formData, setFormData] = useState({ splits: [] }); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summaries, setSummaries] = useState([]);
  const [fieldLines, setFieldLines] = useState([]);

  // Fetch rules, summaries, and field lines
  const getRules = async () => {
    setLoading(true);
    try {
      const [rulesRes, summRes, fieldRes] = await Promise.all([
        api.get("/summaries/rules"),                 
        api.get("/summaries/summaries"),   
        api.get("/summaries/fieldlines")
      ]);

      setRules(rulesRes.data || []);
      setSummaries(summRes.data || []);
      setFieldLines(fieldRes.data || []);
    } catch (err) {
      console.error("Error fetching rules:", err);
      setError("Failed to load rules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getRules();
  }, []);

  const handleEdit = (rule) => {
    const editableRule = JSON.parse(JSON.stringify(rule));
    editableRule.splits = editableRule.splits || [];
    editableRule.splits.forEach(split => {
      split.mirrors = split.mirrors || [];
    });
    setEditRuleId(rule.ruleId);
    setFormData(editableRule);
  };

  const handleInputChange = (splitIdx, mirrorIdx, field, value) => {
    const newData = { ...formData };
    if (mirrorIdx !== undefined) {
      newData.splits[splitIdx].mirrors[mirrorIdx][field] = value;
    } else {
      newData.splits[splitIdx][field] = value;
    }
    setFormData(newData);
  };

  const addSplit = () => {
    setFormData(prev => ({
      ...prev,
      splits: [...prev.splits, { fieldName: "", percentage: 0, fixedAmount: 0, debitOrCredit: "debit", summaryId: "", mirrors: [] }]
    }));
  };

  const addMirror = (splitIdx) => {
    const newData = { ...formData };
    newData.splits[splitIdx].mirrors.push({ fieldLineId: "", summaryId: "", debitOrCredit: "debit" });
    setFormData(newData);
  };

  const handleSave = async () => {
    try {
      await api.put(`/summaries/rules/${formData.ruleId}`, formData);
      setEditRuleId(null);
      setFormData({ splits: [] });
      getRules();
      alert("Rule updated successfully!");
    } catch (err) {
      console.error("Error updating rule:", err);
      alert("Failed to update rule.");
    }
  };

  const handleCreateEntry = async () => {
    try {
      await api.post("/summaries/rules", formData);
      setEditRuleId(null);
      setFormData({ splits: [] });
      getRules();
      alert("Rule created successfully!");
    } catch (err) {
      console.error("Error creating rule:", err);
      alert("Failed to create rule.");
    }
  };

  if (loading) return <div className="p-6 text-center">Loading rules...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-2">Rules Manager</h1>

      {/* Summaries Table */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Summaries</h2>
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-200">
            <tr>
              <th className="border px-2 py-1">Summary ID</th>
              <th className="border px-2 py-1">Summary Name</th>
              <th className="border px-2 py-1">Account Type</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => (
              <tr key={s.summaryId} className="bg-gray-50">
                <td className="border px-2 py-1">{s.summaryId}</td>
                <td className="border px-2 py-1">{s.name}</td>
                <td className="border px-2 py-1">{s.accountType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Field Lines Table */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Field Lines</h2>
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-200">
            <tr>
              <th className="border px-2 py-1">FieldLine ID</th>
              <th className="border px-2 py-1">FieldLine Name</th>
              <th className="border px-2 py-1">Summary ID</th>
              <th className="border px-2 py-1">Balance</th>
            </tr>
          </thead>
          <tbody>
            {fieldLines.map((f) => (
              <tr key={f.fieldLineId} className="bg-gray-50">
                <td className="border px-2 py-1">{f.fieldLineId}</td>
                <td className="border px-2 py-1">{f.name}</td>
                <td className="border px-2 py-1">{f.fieldLineId}</td>
                <td className="border px-2 py-1">{f.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rules */}
      {rules.map((rule) => (
        <div key={rule.ruleId} className="border rounded p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-lg">{rule.transactionType} (Rule {rule.ruleId})</h2>
            {editRuleId === rule.ruleId ? (
              <button
                onClick={handleSave}
                className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
              >
                Save
              </button>
            ) : (
              <button
                onClick={() => handleEdit(rule)}
                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
              >
                Edit
              </button>
            )}
          </div>

          {/* Splits Table */}
          <table className="w-full table-auto border-collapse mb-2">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Field Name</th>
                <th className="border p-2">Percentage</th>
                <th className="border p-2">Fixed Amount</th>
                <th className="border p-2">Debit/Credit</th>
                <th className="border p-2">Summary ID</th>
                <th className="border p-2">Mirrors</th>
              </tr>
            </thead>
            <tbody>
              {(editRuleId === rule.ruleId ? formData.splits : rule.splits).map((split, splitIdx) => (
                <tr key={splitIdx} className="bg-white">
                  <td className="border p-2">
                    {editRuleId === rule.ruleId ? (
                      <input
                        type="text"
                        value={split.fieldName}
                        onChange={(e) => handleInputChange(splitIdx, undefined, "fieldName", e.target.value)}
                        className="border p-1 rounded w-full"
                      />
                    ) : split.fieldName}
                  </td>
                  <td className="border p-2">{editRuleId === rule.ruleId ? (
                    <input
                      type="number"
                      value={split.percentage}
                      onChange={(e) => handleInputChange(splitIdx, undefined, "percentage", Number(e.target.value))}
                      className="border p-1 rounded w-16"
                    />
                  ) : split.percentage}</td>
                  <td className="border p-2">{editRuleId === rule.ruleId ? (
                    <input
                      type="number"
                      value={split.fixedAmount || ""}
                      onChange={(e) => handleInputChange(splitIdx, undefined, "fixedAmount", Number(e.target.value))}
                      className="border p-1 rounded w-20"
                    />
                  ) : split.fixedAmount || "-"}</td>
                  <td className="border p-2">{editRuleId === rule.ruleId ? (
                    <select
                      value={split.debitOrCredit}
                      onChange={(e) => handleInputChange(splitIdx, undefined, "debitOrCredit", e.target.value)}
                      className="border p-1 rounded"
                    >
                      <option value="debit">Debit</option>
                      <option value="credit">Credit</option>
                    </select>
                  ) : split.debitOrCredit}</td>
                  <td className="border p-2">{editRuleId === rule.ruleId ? (
                    <select
                      value={split.summaryId}
                      onChange={(e) => handleInputChange(splitIdx, undefined, "summaryId", Number(e.target.value))}
                      className="border p-1 rounded"
                    >
                      <option value="">Select Summary</option>
                      {summaries.map((s) => (
                        <option key={s.summaryId} value={s.summaryId}>
                          {s.name} ({s.summaryId})
                        </option>
                      ))}
                    </select>
                  ) : split.summaryId}</td>
                  <td className="border p-2">
                    <table className="w-full border-collapse">
                      <tbody>
                        {split.mirrors.map((mirror, mirrorIdx) => (
                          <tr key={mirrorIdx}>
                            <td className="border p-1">{editRuleId === rule.ruleId ? (
                              <input
                                type="number"
                                value={mirror.fieldLineId}
                                onChange={(e) => handleInputChange(splitIdx, mirrorIdx, "fieldLineId", Number(e.target.value))}
                                className="border p-1 rounded w-20"
                              />
                            ) : mirror.fieldLineId}</td>
                            <td className="border p-1">{editRuleId === rule.ruleId ? (
                              <select
                                value={mirror.summaryId}
                                onChange={(e) => handleInputChange(splitIdx, mirrorIdx, "summaryId", Number(e.target.value))}
                                className="border p-1 rounded"
                              >
                                <option value="">Select Summary</option>
                                {summaries.map((s) => (
                                  <option key={s.summaryId} value={s.summaryId}>
                                    {s.name} ({s.summaryId})
                                  </option>
                                ))}
                              </select>
                            ) : mirror.summaryId}</td>
                            <td className="border p-1">{editRuleId === rule.ruleId ? (
                              <select
                                value={mirror.debitOrCredit}
                                onChange={(e) => handleInputChange(splitIdx, mirrorIdx, "debitOrCredit", e.target.value)}
                                className="border p-1 rounded"
                              >
                                <option value="debit">Debit</option>
                                <option value="credit">Credit</option>
                              </select>
                            ) : mirror.debitOrCredit}</td>
                          </tr>
                        ))}
                        {editRuleId === rule.ruleId && (
                          <tr>
                            <td colSpan={3} className="text-center p-1">
                              <button
                                onClick={() => addMirror(splitIdx)}
                                className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
                              >
                                + Add Mirror
                              </button>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {editRuleId === rule.ruleId && (
            <button
              onClick={addSplit}
              className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
            >
              + Add Split
            </button>
          )}
        </div>
      ))}

      {/* Create New Rule */}
      {editRuleId === null && (
        <div className="mt-4">
          <button
            onClick={handleCreateEntry}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
          >
            Create New Rule
          </button>
        </div>
      )}
    </div>
  );
}
