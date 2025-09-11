import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios.js";

export default function SalaryModal({ isOpen, onClose, employee }) {
  const [formData, setFormData] = useState({
    baseSalary: 0,
    salaryType: "monthly",
    allowances: [],
  });
  const [originalRules, setOriginalRules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen || !employee?._id) return;

    const fetchSalaryRules = async () => {
      try {
        setLoading(true);
        setError(null);

        const roleName = employee.role?.roleName || employee.role?.name;

        if (!roleName) {
          setError("Employee role not found");
          console.log("Debug: Employee role missing for", employee);
          return;
        }

        console.log("Debug: Fetching salary rules for role:", roleName);

        const res = await api.get(
          `/summaries/salary/rules-by-role/${encodeURIComponent(roleName)}`
        );

        console.log("Debug: Salary rules response:", res.data);

       const salaryRules = res.data?.data?.salaryRules || {};
        setSelectedRoleId(res.data?.data?._id || null);

        setFormData({
        baseSalary: salaryRules.baseSalary || 0,
        salaryType: salaryRules.salaryType || "monthly",
        allowances: Array.isArray(salaryRules.allowances) ? salaryRules.allowances : [],
        });

        setOriginalRules({
          baseSalary: salaryRules.baseSalary || 0,
          salaryType: salaryRules.salaryType || "monthly",
          allowances: Array.isArray(salaryRules.allowances) ? salaryRules.allowances : [],
        });

        console.log("Debug: Form data initialized:", salaryRules);
      } catch (err) {
        console.error("Error fetching rules:", err);
        setError("Failed to fetch salary rules");
      } finally {
        setLoading(false);
      }
    };

    fetchSalaryRules();
  }, [isOpen, employee]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    if (!isEditing) return;
    const { name, value } = e.target;
    console.log(`Debug: handleChange - ${name}:`, value);

    setFormData((prev) => ({
      ...prev,
      [name]: name === "baseSalary" ? Number(value) : value,
    }));
  };

  const handleArrayChange = (section, index, field, value) => {
    if (!isEditing) return;
    console.log(`Debug: handleArrayChange - ${section}[${index}].${field}:`, value);

    const updated = [...formData[section]];
    updated[index][field] = field === "value" ? Number(value) : value;
    setFormData((prev) => ({ ...prev, [section]: updated }));
  };

  const addItem = (section) => {
    if (!isEditing) return;
    console.log(`Debug: Adding item to ${section}`);
    setFormData((prev) => ({
      ...prev,
      [section]: [...prev[section], { name: "", type: "fixed", value: 0 }],
    }));
  };

  const removeItem = (section, index) => {
    if (!isEditing) return;
    console.log(`Debug: Removing item from ${section} at index`, index);
    setFormData((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index),
    }));
  };

 const handleCreateBreakup = async () => {
  if (!employee?._id) return alert("Missing employee info");
  if (!selectedRoleId) return alert("Missing role info");

  try {
    // Prepare salaryRules
    const salaryRulesPayload = {
      baseSalary: isEditing ? Number(formData.baseSalary) : originalRules.baseSalary,
      salaryType: isEditing ? formData.salaryType : originalRules.salaryType,
      allowances: (isEditing ? formData.allowances : originalRules.allowances)
        .filter((a) => a.name)
        .map((a) => ({
          name: String(a.name),
          type: String(a.type),
          value: Number(a.value) || 0,
        })),
    };

    // Prepare breakup array: base + allowances
    const breakupPayload = [
      {
        name: "Base Salary",
        type: "base",
        value: salaryRulesPayload.baseSalary,
        calculation: "manual",
      },
      ...salaryRulesPayload.allowances.map((a) => ({
        name: a.name,
        type: "allowance",
        value: a.value,
        calculation: a.type === "percentage"
          ? `${a.value}% of base`
          : "manual",
      })),
    ];

    const payload = {
      employeeId: employee._id,
      roleId: selectedRoleId,
      salaryRules: salaryRulesPayload,
      breakup: breakupPayload,
    };

    console.log("Debug: Breakup payload:", payload);

    const res = await api.post(`/summaries/salary/breakup/${employee._id}`, payload);

    console.log("Debug: Breakup response:", res.data);

    if (res?.status === 200) {
      alert("Breakup file created/updated successfully!");
      onClose?.();
      navigate(`/salary/breakup/${employee._id}`);
    } else {
      alert(res?.data?.message || "Failed to create breakup");
    }
  } catch (err) {
    console.error("Error creating breakup:", err);
    alert("Error creating breakup. Check console for details.");
  }
};


  const renderValue = (item) =>
    item.type === "percentage" ? `${item.value}%` : `PKR ${item.value?.toLocaleString()}`;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl p-8 relative max-h-[95vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-600 hover:text-red-500 text-2xl font-bold"
        >
          ✕
        </button>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">
            {employee?.individualName
              ? `Salary Rules: ${employee.individualName}`
              : "Salary Rules"}
          </h2>
          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            className="px-4 py-2 rounded bg-yellow-500 text-white hover:bg-yellow-600"
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

            <SectionEditor
              title="Allowances"
              section="allowances"
              items={formData.allowances}
              handleArrayChange={handleArrayChange}
              addItem={addItem}
              removeItem={removeItem}
              isEditing={isEditing}
              renderValue={renderValue}
            />
          </form>
        )}

        <div className="flex justify-end mt-8 space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded bg-gray-200 hover:bg-gray-300"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleCreateBreakup}
            className="px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Create Breakup
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionEditor({ title, section, items, handleArrayChange, addItem, removeItem, isEditing, renderValue }) {
  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
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
                    placeholder="Value"
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
                  <span className="w-32 text-right font-semibold">{renderValue(item)}</span>
                  <span className="w-8"></span>
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
