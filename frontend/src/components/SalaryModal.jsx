import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios.js";

export default function SalaryModal({ isOpen, onClose, employee }) {
  const [formData, setFormData] = useState({
    baseSalary: "",
    salaryType: "monthly",
    allowances: [],
    deductions: [],
    terminalBenefits: [],
  });
  const [originalRules, setOriginalRules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && employee?.role?.roleName) {
      setLoading(true);
      api
        .get(`/summaries/salary/rules-by-role/${encodeURIComponent(employee.role.roleName)}`)
        .then((res) => {
          const salaryRules = res.data?.data || {};
          const rules = {
            baseSalary: salaryRules.baseSalary || "",
            salaryType: salaryRules.salaryType || "monthly",
            allowances: salaryRules.allowances || [],
            deductions: salaryRules.deductions || [],
            terminalBenefits: salaryRules.terminalBenefits || [],
          };
          setFormData(rules);
          setOriginalRules(rules);
        })
        .catch((err) => {
          console.error("Error fetching rules:", err);
          alert("Failed to fetch salary rules");
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, employee]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    if (!isEditing) return;
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleArrayChange = (section, index, field, value) => {
    if (!isEditing) return;
    const updated = [...formData[section]];
    updated[index][field] = value;
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

  // Create breakup using role-based salary
  const handleCreateBreakup = async () => {
    try {
      const roleIdentifier = employee?.role?._id || employee?.role?.roleName;
      if (!roleIdentifier) {
        alert("Missing role information. Cannot create breakup.");
        return;
      }

      const payload = { roleId: roleIdentifier, salaryRules: originalRules };

      const res = await api.post(
        `/summaries/salary/breakup/${employee._id}`,
        payload
      );

      if (res?.data?.success) {
        alert("Breakup file created using role salary!");
        onClose?.();
        navigate(`/salary/breakup/${employee._id}`);
      } else {
        alert(res?.data?.message || "Failed to create breakup file.");
      }
    } catch (err) {
      console.error(err);
      alert("Error creating breakup file.");
    }
  };

  // Create breakup using edited salary
  const handleCreateBreakupEdited = async () => {
    try {
      const roleIdentifier = employee?.role?._id || employee?.role?.roleName;
      if (!roleIdentifier) {
        alert("Missing role information. Cannot create breakup.");
        return;
      }

      const payload = { roleId: roleIdentifier, salaryRules: formData };

      const res = await api.post(
        `/summaries/salary/breakup/${employee._id}`,
        payload
      );

      if (res?.data?.success) {
        alert("Breakup file created using edited salary!");
        onClose?.();
        navigate(`/salary/breakup/${employee._id}`);
      } else {
        alert(res?.data?.message || "Failed to create breakup file.");
      }
    } catch (err) {
      console.error(err);
      alert("Error creating breakup file.");
    }
  };

  const renderValue = (item) =>
    item.type === "percentage"
      ? `${item.value}%`
      : `PKR ${item.value?.toLocaleString()}`;

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
          <h2 className="text-3xl font-bold">Salary Rules</h2>
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
        ) : (
          <form className="space-y-6">
            <div className="border-b pb-3">
              <p className="text-lg font-semibold">
                Employee: {employee?.individualName || "N/A"}
              </p>
              <p className="text-md text-gray-600">
                Role: {employee?.role?.roleName || "N/A"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium mb-1">Base Salary</label>
                <input
                  type="number"
                  name="baseSalary"
                  value={formData.baseSalary}
                  onChange={handleChange}
                  readOnly={!isEditing}
                  className={`w-full border rounded px-3 py-2 ${
                    !isEditing ? "bg-gray-100" : ""
                  }`}
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

            <SectionEditor
              title="Deductions"
              section="deductions"
              items={formData.deductions}
              handleArrayChange={handleArrayChange}
              addItem={addItem}
              removeItem={removeItem}
              isEditing={isEditing}
              renderValue={renderValue}
            />

            <SectionEditor
              title="Terminal Benefits"
              section="terminalBenefits"
              items={formData.terminalBenefits}
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

          {/* If editing, disable normal create */}
          {!isEditing && (
            <button
              type="button"
              onClick={handleCreateBreakup}
              className="px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Create Breakup
            </button>
          )}

          {/* If editing, enable create with edited data */}
          {isEditing && (
            <button
              type="button"
              onClick={handleCreateBreakupEdited}
              className="px-5 py-2 rounded bg-green-600 text-white hover:bg-green-700"
            >
              Create Breakup with Edited Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionEditor({
  title,
  section,
  items,
  handleArrayChange,
  addItem,
  removeItem,
  isEditing,
  renderValue,
}) {
  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center space-x-3 p-2 bg-white rounded border">
              {isEditing ? (
                <>
                  <input
                    type="text"
                    placeholder="Name"
                    value={item.name}
                    onChange={(e) =>
                      handleArrayChange(section, idx, "name", e.target.value)
                    }
                    className="flex-1 border rounded px-2 py-1"
                  />
                  <select
                    value={item.type}
                    onChange={(e) =>
                      handleArrayChange(section, idx, "type", e.target.value)
                    }
                    className="w-32 border rounded px-2 py-1"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="percentage">Percentage</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Value"
                    value={item.value}
                    onChange={(e) =>
                      handleArrayChange(section, idx, "value", e.target.value)
                    }
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
