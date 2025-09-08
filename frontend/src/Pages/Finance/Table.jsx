import React, { useEffect, useState } from "react";
import api from "../../api/axios.js";

export default function RulesTable() {
  const [rules, setRules] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [fieldLines, setFieldLines] = useState([]);
  const [editRuleId, setEditRuleId] = useState(null);
  const [formData, setFormData] = useState({ splits: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summRes, fieldRes, rulesRes] = await Promise.all([
        api.get("/summaries"),
        api.get("/summaries/fieldlines"),
        api.get("/summaries/rules"),
      ]);
      setSummaries(summRes.data || []);
      setFieldLines(fieldRes.data || []);
      setRules(rulesRes.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (rule) => {
    const editable = JSON.parse(JSON.stringify(rule));
    editable.splits = editable.splits || [];
    
    editable.splits.forEach(split => {
      split.mirrors = split.mirrors || [];
      // Ensure summaryId is a string for the dropdown
      if (split.summaryId) {
        split.summaryId = split.summaryId.toString();
      }
      split.mirrors.forEach(mirror => {
        if (mirror.summaryId) {
          mirror.summaryId = mirror.summaryId.toString();
        }
      });
    });
    
    setEditRuleId(rule.ruleId);
    setFormData(editable);
  };

  const handleCancel = () => {
    setEditRuleId(null);
    setFormData({ splits: [] });
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
      splits: [...(prev.splits || []), { fieldName: "", percentage: 0, fixedAmount: 0, debitOrCredit: "debit", summaryId: "", mirrors: [] }]
    }));
  };

  const deleteSplit = (splitIdx) => {
    if (!window.confirm("Delete this split?")) return;
    const newData = { ...formData };
    newData.splits.splice(splitIdx, 1);
    setFormData(newData);
  };

  const addMirror = (splitIdx) => {
    const newData = { ...formData };
    newData.splits[splitIdx].mirrors.push({ fieldLineId: "", summaryId: "", debitOrCredit: "debit" });
    setFormData(newData);
  };

  const deleteMirror = (splitIdx, mirrorIdx) => {
    if (!window.confirm("Delete this mirror?")) return;
    const newData = { ...formData };
    newData.splits[splitIdx].mirrors.splice(mirrorIdx, 1);
    setFormData(newData);
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm("Delete this rule?")) return;
    try {
      await api.delete(`/summaries/rules/${ruleId}/delete`);
      fetchData();
      alert("Deleted!");
    } catch {
      alert("Failed to delete.");
    }
  };

  const handleSave = async () => {
    try {
      await api.put(`/summaries/rules/${formData.ruleId}`, formData);
      handleCancel();
      fetchData();
      alert("Updated!");
    } catch (err) {
      console.error(err);
      alert("Failed to update.");
    }
  };

  const handleCreateRule = async () => {
    try {
      await api.post("/summaries/rules", formData);
      handleCancel();
      fetchData();
      alert("Created!");
    } catch (err) {
      console.error(err);
      alert("Failed to create.");
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Summaries Table */}
      <h2 className="text-xl font-semibold mb-2">All Summaries</h2>
      <div className="overflow-x-auto mb-6">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-200">
            <tr>
              {summaries[0] && Object.keys(summaries[0]).filter(k => k !== "_id").map(key => (
                <th key={key} className="border px-2 py-1">{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summaries.map(s => (
              <tr key={s._id} className="bg-gray-50">
                {Object.entries(s).filter(([key]) => key !== "_id").map(([key, val], i) => (
                  <td key={i} className="border px-2 py-1">
                    {Array.isArray(val) ? (
                      <ul className="list-disc pl-4">
                        {val.map(f => (
                          <li key={f.fieldLineId}>
                            {f.fieldLineId} - {f.name} - {f.accountNumber} - {f.balance}
                          </li>
                        ))}
                      </ul>
                    ) : val?.toString()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Field Lines Table */}
      <h2 className="text-xl font-semibold mb-2">All Summary Field Lines</h2>
      <div className="overflow-x-auto mb-6">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-200">
            <tr>
              <th>FieldLine ID</th>
              <th>Name</th>
              <th>Summary Name</th>
              <th>Summary Custom ID</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {fieldLines.map(fl => (
              <tr key={fl.fieldLineId} className="bg-gray-50">
                <td>{fl.fieldLineId}</td>
                <td>{fl.name}</td>
                <td>{fl.summaryId?.name || "-"}</td>
                <td>{fl.summaryId?.summaryId || "-"}</td>
                <td>{fl.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rules Table */}
      {rules.map(rule => (
        <div key={rule.ruleId} className="border rounded-lg shadow-md bg-white p-4 space-y-4">

          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">{rule.transactionType} (Rule {rule.ruleId})</h2>
            <div className="flex gap-2">
              {editRuleId === rule.ruleId ? (
                <>
                  <button onClick={handleSave} className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">Save</button>
                  <button onClick={handleCancel} className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600">Cancel</button>
                </>
              ) : (
                <button onClick={() => handleEdit(rule)} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Edit</button>
              )}
              <button onClick={() => handleDeleteRule(rule.ruleId)} className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">Delete</button>
            </div>
          </div>

          {/* Splits */}
          <div className="space-y-3">
            {(editRuleId === rule.ruleId ? formData.splits : rule.splits || []).map((split, splitIdx) => (
              <div key={splitIdx} className="border rounded-md p-3 bg-gray-50 space-y-2">

                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <div className="flex flex-wrap gap-2 items-center">
                    {editRuleId === rule.ruleId ? (
                      <>
                        <input type="text" value={split.fieldName || ""} onChange={e => handleInputChange(splitIdx, undefined, "fieldName", e.target.value)} placeholder="Field Name" className="border p-1 rounded w-40" />
                        <input type="number" value={split.percentage || 0} onChange={e => handleInputChange(splitIdx, undefined, "percentage", Number(e.target.value))} placeholder="%" className="border p-1 rounded w-20" />
                        <input type="number" value={split.fixedAmount || 0} onChange={e => handleInputChange(splitIdx, undefined, "fixedAmount", Number(e.target.value))} placeholder="Amount" className="border p-1 rounded w-24" />
                        <select value={split.debitOrCredit || "debit"} onChange={e => handleInputChange(splitIdx, undefined, "debitOrCredit", e.target.value)} className="border p-1 rounded">
                          <option value="debit">Debit</option>
                          <option value="credit">Credit</option>
                        </select>
                        <select value={split.summaryId || ""} onChange={e => handleInputChange(splitIdx, undefined, "summaryId", e.target.value)} className="border p-1 rounded">
                          <option value="">Select Summary</option>
                          {summaries.map(s => (
                            <option key={s.summaryId} value={s.summaryId}>
                              {s.name} ({s.summaryId})
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <span className="text-sm">
                        <strong>{split.fieldName}</strong> - {split.percentage}% - {split.fixedAmount || "-"} - {split.debitOrCredit} - Summary: {split.summaryId}
                      </span>
                    )}
                  </div>

                  {editRuleId === rule.ruleId && (
                    <button onClick={() => deleteSplit(splitIdx)} className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-sm">Delete Split</button>
                  )}
                </div>

                {/* Mirrors */}
                <div className="ml-6 space-y-1">
                  {(split.mirrors || []).map((mirror, mirrorIdx) => (
                    <div key={mirrorIdx} className="flex flex-wrap gap-2 items-center">
                      {editRuleId === rule.ruleId && (
                        <>
                          <input type="number" value={mirror.fieldLineId || ""} onChange={e => handleInputChange(splitIdx, mirrorIdx, "fieldLineId", Number(e.target.value))} placeholder="FieldLine ID" className="border p-1 rounded w-24" />
                          <select value={mirror.summaryId || ""} onChange={e => handleInputChange(splitIdx, mirrorIdx, "summaryId", e.target.value)} className="border p-1 rounded">
                            <option value="">Select Summary</option>
                            {summaries.map(s => (
                              <option key={s.summaryId} value={s.summaryId}>
                                {s.name} ({s.summaryId})
                              </option>
                            ))}
                          </select>
                          <select value={mirror.debitOrCredit || "debit"} onChange={e => handleInputChange(splitIdx, mirrorIdx, "debitOrCredit", e.target.value)} className="border p-1 rounded">
                            <option value="debit">Debit</option>
                            <option value="credit">Credit</option>
                          </select>
                          <button onClick={() => deleteMirror(splitIdx, mirrorIdx)} className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-xs">Delete Mirror</button>
                        </>
                      )}
                    </div>
                  ))}
                  {editRuleId === rule.ruleId && (
                    <button onClick={() => addMirror(splitIdx)} className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 text-sm mt-1">+ Add Mirror</button>
                  )}
                </div>

              </div>
            ))}
            {editRuleId === rule.ruleId && (
              <button onClick={addSplit} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm">+ Add Split</button>
            )}
          </div>

        </div>
      ))}

      {/* Create New Rule */}
      {editRuleId === null && (
        <button onClick={handleCreateRule} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">+ Create New Rule</button>
      )}
    </div>
  );
}