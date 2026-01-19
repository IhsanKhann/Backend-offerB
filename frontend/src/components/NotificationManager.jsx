import { useState, useEffect } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiToggleLeft, FiToggleRight, FiSave, FiX } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import api from "../api/axios.js";

const NotificationManager = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [stats, setStats] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    eventType: "",
    department: "",
    roles: [],
    userIds: [],
    priority: "medium",
    template: {
      title: "",
      message: "",
    },
    enabled: true,
  });

  // Event types grouped by department
  const eventTypesByDepartment = {
    HR: [
      "HR_EMPLOYEE_ONBOARDED",
      "HR_EMPLOYEE_OFFBOARDED",
      "HR_ROLE_ASSIGNED",
      "HR_ROLE_CHANGED",
      "HR_LEAVE_REQUESTED",
      "HR_LEAVE_APPROVED",
      "HR_LEAVE_REJECTED",
      "HR_PERFORMANCE_REVIEW_DUE",
      "HR_DOCUMENT_EXPIRING",
      "HR_BIRTHDAY_REMINDER",
      "HR_PROBATION_ENDING",
      "HR_CONTRACT_EXPIRING",
    ],
    Finance: [
      "FINANCE_SALARY_PROCESSED",
      "FINANCE_SALARY_PAID",
      "FINANCE_SALARY_PENDING",
      "FINANCE_INVOICE_CREATED",
      "FINANCE_INVOICE_OVERDUE",
      "FINANCE_PAYMENT_RECEIVED",
      "FINANCE_EXPENSE_SUBMITTED",
      "FINANCE_EXPENSE_APPROVED",
      "FINANCE_BUDGET_EXCEEDED",
      "FINANCE_TRANSACTION_FLAGGED",
      "FINANCE_MONTH_END_CLOSING",
      "FINANCE_TAX_DEADLINE",
      "FINANCE_AUDIT_SCHEDULED",
    ],
    BusinessOperation: [
      "BIZ_ORDER_CREATED",
      "BIZ_ORDER_CONFIRMED",
      "BIZ_ORDER_SHIPPED",
      "BIZ_ORDER_DELIVERED",
      "BIZ_ORDER_CANCELLED",
      "BIZ_ORDER_RETURN_REQUESTED",
      "BIZ_ORDER_RETURN_EXPIRED",
      "BIZ_INVENTORY_LOW",
      "BIZ_INVENTORY_OUT",
      "BIZ_SUPPLIER_PAYMENT_DUE",
      "BIZ_CUSTOMER_COMPLAINT",
      "BIZ_QUALITY_ISSUE",
      "BIZ_SHIPMENT_DELAYED",
    ],
    ALL: [
      "SYSTEM_MAINTENANCE",
      "SYSTEM_UPDATE",
      "SYSTEM_ALERT",
      "MEETING_SCHEDULED",
      "TASK_ASSIGNED",
      "TASK_COMPLETED",
      "DEADLINE_APPROACHING",
      "APPROVAL_REQUIRED",
    ],
  };

  // Fetch rules and stats
  const fetchData = async () => {
    try {
      setLoading(true);
      const [rulesRes, statsRes] = await Promise.all([
        api.get("/notifications/rules"),
        api.get("/notifications/stats"),
      ]);

      if (rulesRes.data.success) {
        setRules(rulesRes.data.rules);
      }

      if (statsRes.data.success) {
        setStats(statsRes.data.stats);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Open modal for create/edit
  const openModal = (rule = null) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        eventType: rule.eventType,
        department: rule.department,
        roles: rule.roles || [],
        userIds: rule.userIds || [],
        priority: rule.priority,
        template: rule.template,
        enabled: rule.enabled,
      });
    } else {
      setEditingRule(null);
      setFormData({
        eventType: "",
        department: "",
        roles: [],
        userIds: [],
        priority: "medium",
        template: { title: "", message: "" },
        enabled: true,
      });
    }
    setShowModal(true);
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setEditingRule(null);
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingRule) {
        // Update
        const res = await api.put(`/notifications/rules/${editingRule._id}`, formData);
        if (res.data.success) {
          setRules((prev) =>
            prev.map((r) => (r._id === editingRule._id ? res.data.rule : r))
          );
          alert("Rule updated successfully!");
        }
      } else {
        // Create
        const res = await api.post("/notifications/rules", formData);
        if (res.data.success) {
          setRules((prev) => [...prev, res.data.rule]);
          alert("Rule created successfully!");
        }
      }
      closeModal();
    } catch (err) {
      console.error("Error saving rule:", err);
      alert("Failed to save rule");
    }
  };

  // Toggle rule enabled/disabled
  const toggleRule = async (ruleId) => {
    try {
      const res = await api.patch(`/notifications/rules/${ruleId}/toggle`);
      if (res.data.success) {
        setRules((prev) =>
          prev.map((r) => (r._id === ruleId ? res.data.rule : r))
        );
      }
    } catch (err) {
      console.error("Error toggling rule:", err);
    }
  };

  // Delete rule
  const deleteRule = async (ruleId) => {
    if (!window.confirm("Are you sure you want to delete this rule?")) return;

    try {
      const res = await api.delete(`/notifications/rules/${ruleId}`);
      if (res.data.success) {
        setRules((prev) => prev.filter((r) => r._id !== ruleId));
        alert("Rule deleted successfully!");
      }
    } catch (err) {
      console.error("Error deleting rule:", err);
      alert("Failed to delete rule");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notification Manager</h1>
            <p className="text-gray-600 mt-1">
              Manage notification rules and view statistics
            </p>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FiPlus size={20} />
            Create Rule
          </button>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">Total Notifications</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            
            {stats.byDepartment.map((dept) => (
              <div key={dept._id} className="bg-white p-4 rounded-lg shadow">
                <p className="text-sm text-gray-600 capitalize">{dept._id}</p>
                <p className="text-2xl font-bold text-gray-900">{dept.count}</p>
              </div>
            ))}
          </div>
        )}

        {/* Rules Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Event Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Roles
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rules.map((rule) => (
                <tr key={rule._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {rule.eventType.replace(/_/g, " ")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {rule.department}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {rule.roles.length > 0 ? rule.roles.join(", ") : "All"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        rule.priority === "critical"
                          ? "bg-red-100 text-red-800"
                          : rule.priority === "high"
                          ? "bg-orange-100 text-orange-800"
                          : rule.priority === "medium"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {rule.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleRule(rule._id)}
                      className="flex items-center gap-1"
                    >
                      {rule.enabled ? (
                        <FiToggleRight size={24} className="text-green-600" />
                      ) : (
                        <FiToggleLeft size={24} className="text-gray-400" />
                      )}
                      <span className="text-sm">
                        {rule.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openModal(rule)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <FiEdit2 size={18} />
                      </button>
                      <button
                        onClick={() => deleteRule(rule._id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <FiTrash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal */}
        <AnimatePresence>
          {showModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <form onSubmit={handleSubmit}>
                  {/* Modal Header */}
                  <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-2xl font-bold">
                      {editingRule ? "Edit Rule" : "Create New Rule"}
                    </h2>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <FiX size={24} />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 space-y-4">
                    {/* Department */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Department *
                      </label>
                      <select
                        required
                        value={formData.department}
                        onChange={(e) =>
                          setFormData({ ...formData, department: e.target.value, eventType: "" })
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      >
                        <option value="">Select Department</option>
                        <option value="HR">HR</option>
                        <option value="Finance">Finance</option>
                        <option value="BusinessOperation">Business Operation</option>
                        <option value="ALL">All Departments</option>
                      </select>
                    </div>

                    {/* Event Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Event Type *
                      </label>
                      <select
                        required
                        value={formData.eventType}
                        onChange={(e) =>
                          setFormData({ ...formData, eventType: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        disabled={!formData.department}
                      >
                        <option value="">Select Event Type</option>
                        {formData.department &&
                          eventTypesByDepartment[formData.department]?.map((event) => (
                            <option key={event} value={event}>
                              {event.replace(/_/g, " ")}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Roles (comma-separated) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Target Roles (comma-separated, leave empty for all)
                      </label>
                      <input
                        type="text"
                        value={formData.roles.join(", ")}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            roles: e.target.value.split(",").map((r) => r.trim()).filter(Boolean),
                          })
                        }
                        placeholder="e.g. HR Manager, Finance Manager"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>

                    {/* Priority */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Priority *
                      </label>
                      <select
                        required
                        value={formData.priority}
                        onChange={(e) =>
                          setFormData({ ...formData, priority: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>

                    {/* Template Title */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notification Title * (Use &#123;&#123;variable&#125;&#125; for dynamic values)
                    </label>
                    <input
                        type="text"
                        required
                        value={formData.template.title}
                        onChange={(e) =>
                            setFormData({
                            ...formData,
                            template: { ...formData.template, title: e.target.value },
                            })
                        }
                        placeholder="e.g. Salary Processed for {{employeeName}}"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                    </div>

                    {/* Template Message */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notification Message *
                      </label>
                     <textarea
                        required
                        value={formData.template.message}
                        onChange={(e) =>
                            setFormData({
                            ...formData,
                            template: { ...formData.template, message: e.target.value },
                            })
                        }
                        placeholder="e.g. Your salary for {{month}} {{year}} has been processed."
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                    </div>

                    {/* Enabled Toggle */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="enabled"
                        checked={formData.enabled}
                        onChange={(e) =>
                          setFormData({ ...formData, enabled: e.target.checked })
                        }
                        className="w-4 h-4"
                      />
                      <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
                        Enable this rule
                      </label>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <FiSave size={18} />
                      {editingRule ? "Update Rule" : "Create Rule"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default NotificationManager;