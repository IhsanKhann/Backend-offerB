import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios.js";

export default function SalaryModal({ isOpen, onClose, employee }) {
  const [formData, setFormData] = useState({
    baseSalary: 0,
    salaryType: "monthly",
    allowances: [],
    deductions: [],
    terminalBenefits: [],
  });

  const [originalRules, setOriginalRules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState(null);

  const [backendMessage, setBackendMessage] = useState(null);
  const [backendStatus, setBackendStatus] = useState(null); // "paid" | "processing"

  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  const navigate = useNavigate();

  // ---------------------------------------------------------
  // FETCH SALARY RULES BY ROLE
  // ---------------------------------------------------------
  useEffect(() => {
    if (!isOpen || !employee?._id) return;

    const fetchSalaryRules = async () => {
      try {
        setLoading(true);
        setError(null);

        const roleName = employee.role?.roleName || employee.role?.name;
        if (!roleName) {
          setError("Employee role not found");
          return;
        }

        const res = await api.get(
          `/summaries/salary/rules-by-role/${encodeURIComponent(roleName)}`
        );

        console.log("📊 Salary Rules Response:", res.data);
        console.log("📊 Role ID:", res.data?.data?._id);
        console.log("📊 Salary Rules:", res.data?.data?.salaryRules);

        const salaryRules = res.data?.data?.salaryRules || {};
        setSelectedRoleId(res.data?.data?._id || null);

        const normalized = {
          baseSalary: salaryRules.baseSalary || 0,
          salaryType: salaryRules.salaryType || "monthly",
          allowances: salaryRules.allowances || [],
          deductions: salaryRules.deductions || [],
          terminalBenefits: salaryRules.terminalBenefits || [],
        };

        setFormData(normalized);
        setOriginalRules(normalized);
      } catch (err) {
        console.error("Error fetching rules:", err);
        setError("Failed to fetch salary rules");
      } finally {
        setLoading(false);
      }
    };

    fetchSalaryRules();

    // set current month/year by default
    const now = new Date();
    setMonth(now.toLocaleString("en-US", { month: "long" }));
    setYear(now.getFullYear());
  }, [isOpen, employee]);

  if (!isOpen) return null;

  // ---------------------------------------------------------
  // FORM HANDLERS
  // ---------------------------------------------------------
  const handleChange = (e) => {
    if (!isEditing) return;
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "baseSalary" ? Number(value) : value,
    }));
  };

  const handleArrayChange = (section, index, field, value) => {
    if (!isEditing) return;
    const updated = [...formData[section]];
    updated[index][field] = field === "value" ? Number(value) : value;
    setFormData((prev) => ({ ...prev, [section]: updated }));
  };

  const addItem = (section) => {
    if (!isEditing) return;
    setFormData((prev) => ({
      ...prev,
      [section]: [...prev[section], { name: "", type: "fixed", value: 0 }],
    }));
  };

  const removeItem = (section, index) => {
    if (!isEditing) return;
    setFormData((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index),
    }));
  };

  // ---------------------------------------------------------
  // SAVE SALARY RULES
  // ---------------------------------------------------------
  const handleSaveRules = async () => {
    if (!selectedRoleId) return alert("Missing role ID");

    try {
      const payload = {
        salaryRules: {
          baseSalary: formData.baseSalary,
          salaryType: formData.salaryType,
          allowances: formData.allowances,
          deductions: formData.deductions,
          terminalBenefits: formData.terminalBenefits,
        },
      };

      const res = await api.put(`/summaries/salarytable/${selectedRoleId}`, payload);

      if (res.data?.success) {
        alert("Salary rules updated successfully!");
        setOriginalRules(formData);
        setIsEditing(false);
      } else {
        alert("Failed to update rules");
      }
    } catch (err) {
      console.error("Error updating rules:", err);
      alert("Error saving rules");
    }
  };

// ---------------------------------------------------------
// CREATE BREAKUP (SENDS MONTH/YEAR/PAIDFOR)
// ---------------------------------------------------------
const handleCreateBreakup = async () => {
  if (!selectedRoleId || !employee?._id) {
    return setBackendMessage("Missing employee or role information");
  }

  const paidFor = `${month} ${year}`;
  const payload = {
    employeeId: employee._id,
    roleId: selectedRoleId,
    month,
    year,
    paidFor,
  };

  try {
    const res = await api.post(`/summaries/salary/breakup/${employee._id}`, payload);
    console.log("✅ Breakup creation response:", res.data);

    if (res.data?.success) {
      setBackendMessage(null);
      setBackendStatus(null);
      alert("Breakup file created successfully!");
      onClose?.();
      navigate(`/salary/breakup/${employee._id}`);
    } else {
      // Display message returned from backend
      setBackendMessage(res.data?.message || "Failed to create breakup");
      setBackendStatus(res.data?.status || null);
    }
  } catch (err) {
    console.error("Error creating breakup:", err);
    setBackendMessage("Error creating breakup");
    setBackendStatus(null);
  }
};

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl p-8 relative max-h-[95vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-red-500 text-2xl">
          ✕
        </button>

        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800">
            {employee?.individualName
              ? `Salary Rules for ${employee.individualName}`
              : "Salary Rules"}
          </h2>
          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            className={`px-4 py-2 rounded text-white ${
              isEditing ? "bg-gray-500 hover:bg-gray-600" : "bg-yellow-500 hover:bg-yellow-600"
            }`}
          >
            {isEditing ? "Cancel Edit" : "Edit"}
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading salary rules...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <form className="space-y-6">
            {/* BASE SALARY & TYPE */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium mb-1">Base Salary</label>
                <input
                  type="number"
                  name="baseSalary"
                  value={formData.baseSalary}
                  onChange={handleChange}
                  readOnly={!isEditing}
                  className={`w-full border rounded px-3 py-2 ${!isEditing ? "bg-gray-100" : ""}`}
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Salary Type</label>
                <select
                  name="salaryType"
                  value={formData.salaryType}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="monthly">Monthly</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
            </div>

      
            {backendMessage && (
              // same month breakup creation restriction response from backend..  
              <div
                className={`p-3 mb-4 rounded ${
                  backendStatus === "paid"
                    ? "bg-red-100 text-red-700 border border-red-300"
                    : backendStatus === "processing"
                    ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                    : "bg-gray-100 text-gray-700 border border-gray-300"
                }`}
              >
                {backendMessage}
              </div>
            )}

            {/* ALLOWANCES, DEDUCTIONS, TERMINAL BENEFITS */}
            <SectionEditor
              title="Allowances"
              section="allowances"
              items={formData.allowances}
              handleArrayChange={handleArrayChange}
              addItem={addItem}
              removeItem={removeItem}
              isEditing={isEditing}
            />
            <SectionEditor
              title="Deductions"
              section="deductions"
              items={formData.deductions}
              handleArrayChange={handleArrayChange}
              addItem={addItem}
              removeItem={removeItem}
              isEditing={isEditing}
            />
            <SectionEditor
              title="Terminal Benefits"
              section="terminalBenefits"
              items={formData.terminalBenefits}
              handleArrayChange={handleArrayChange}
              addItem={addItem}
              removeItem={removeItem}
              isEditing={isEditing}
            />

            {/* MONTH + YEAR SELECTORS */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block font-medium mb-1">Month</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  {[
                    "January","February","March","April","May","June",
                    "July","August","September","October","November","December"
                  ].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium mb-1">Year</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
          </form>
        )}

        {/* FOOTER BUTTONS */}
        <div className="flex justify-end mt-8 space-x-3">
          <button onClick={onClose} className="px-5 py-2 rounded bg-gray-200 hover:bg-gray-300">
            Close
          </button>

          {isEditing ? (
            <button
              type="button"
              onClick={handleSaveRules}
              className="px-5 py-2 rounded bg-green-600 text-white hover:bg-green-700"
            >
              Save Rules
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreateBreakup}
              className="px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Create Breakup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------- SectionEditor -----------------
function SectionEditor({ title, section, items, handleArrayChange, addItem, removeItem, isEditing }) {
  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>

      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={item.name + idx} className="flex items-center space-x-3 p-2 bg-white rounded border">
              {isEditing ? (
                <>
                  <input
                    type="text"
                    placeholder="Name"
                    value={item.name}
                    onChange={(e) => handleArrayChange(section, idx, "name", e.target.value)}
                    className="flex-1 border rounded px-2 py-1"
                  />
                  <select
                    value={item.type}
                    onChange={(e) => handleArrayChange(section, idx, "type", e.target.value)}
                    className="w-32 border rounded px-2 py-1"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="percentage">Percentage</option>
                  </select>
                  <input
                    type="number"
                    value={item.value}
                    onChange={(e) => handleArrayChange(section, idx, "value", e.target.value)}
                    className="w-32 border rounded px-2 py-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(section, idx)}
                    className="text-red-600 font-bold px-2 hover:text-red-800"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">{item.name}</span>
                  <span className="capitalize text-gray-600">{item.type}</span>
                  <span className="w-32 text-right font-semibold">
                    {item.type === "percentage" ? `${item.value}%` : `PKR ${item.value}`}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 italic">No {title.toLowerCase()} defined.</p>
      )}

      {isEditing && (
        <button
          type="button"
          onClick={() => addItem(section)}
          className="mt-3 px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
        >
          + Add {title.slice(0, -1)}
        </button>
      )}
    </div>
  );
}
