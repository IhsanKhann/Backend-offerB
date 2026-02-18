// ============================================
// FIXED FRONTEND - AssignRolesForm.jsx
// ============================================

import { useEffect, useState, useCallback } from "react";
import { ChevronRight, ChevronDown, Building2, Users, Loader2, AlertCircle, Shield, CheckCircle2 } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios.js";

const AssignRolesForm = ({ onBack }) => {
  const { employeeId } = useParams();
  const navigate = useNavigate();

  /* ------------------------------ State ------------------------------ */
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);

  const [employee, setEmployee] = useState(null);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [orgTree, setOrgTree] = useState([]);

  const [effectivePermissions, setEffectivePermissions] = useState(null);
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  const [form, setForm] = useState({
    roleId: "",
    orgUnitId: "",
    branchId: "",
    departmentCode: "",
    effectiveFrom: new Date().toISOString().split('T')[0],
    notes: ""
  });

  const [expandedNodes, setExpandedNodes] = useState(new Set());

  /* ------------------------------ Helpers ------------------------------ */
  const safeArray = (v) => (Array.isArray(v) ? v : []);

  /* ------------------------------ Data Load ------------------------------ */
  const fetchData = useCallback(async () => {
    if (!employeeId) {
      setError("No employee ID provided");
      setInitialLoading(false);
      return;
    }

    try {
      setInitialLoading(true);
      setError(null);

      const [empRes, rolesRes, branchRes, treeRes] = await Promise.all([
        api.get(`/employees/${employeeId}`),
        api.get("/roles/getAllRolesList"),
        api.get("/branches"),
        api.get("/org-units"),
      ]);

      const employeeData = empRes.data?.data || empRes.data?.employee || empRes.data;
      const rolesData = rolesRes.data?.Roles || rolesRes.data?.data || rolesRes.data;
      const branchesData = branchRes.data?.branches || branchRes.data?.data || branchRes.data;
      const treeData = treeRes.data?.data || treeRes.data;

      setEmployee(employeeData);
      setRoles(safeArray(rolesData));
      setBranches(safeArray(branchesData));
      setOrgTree(safeArray(treeData));
    } catch (err) {
      console.error("❌ Fetch error:", err);
      setError(err.response?.data?.message || "Failed to load organizational data");
    } finally {
      setInitialLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ------------------------------ Client-Side Validation ------------------------------ */
  const validateForm = () => {
    const errors = [];

    if (!form.roleId) errors.push("Role must be selected");
    if (!form.orgUnitId) errors.push("Organizational position must be selected");
    if (!form.departmentCode) errors.push("Department must be selected");
    
    const selectedOrgUnit = findOrgUnitById(orgTree, form.orgUnitId);
    if (selectedOrgUnit && form.departmentCode !== "All") {
      if (selectedOrgUnit.departmentCode !== form.departmentCode) {
        errors.push(`Selected position belongs to ${selectedOrgUnit.departmentCode} department, not ${form.departmentCode}`);
      }
    }

    // ✅ FIXED: Branch validation - handle both populated objects and string IDs
    if (form.branchId && selectedOrgUnit && selectedOrgUnit.branchId) {
      // Extract ID from branchId (handle both object and string)
      const orgUnitBranchId = typeof selectedOrgUnit.branchId === 'object' 
        ? selectedOrgUnit.branchId._id 
        : selectedOrgUnit.branchId;
      
      if (orgUnitBranchId !== form.branchId) {
        errors.push("Selected position does not belong to the selected branch");
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const findOrgUnitById = (nodes, id) => {
    for (const node of nodes) {
      if (node._id === id) return node;
      if (node.children) {
        const found = findOrgUnitById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  /* ------------------------------ CRITICAL FIX: handleSubmit Function ------------------------------ */
  const handleSubmit = async () => {
    // Validate form
    if (!validateForm()) {
      alert("Please fix validation errors before submitting");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setValidationErrors([]);

      // ✅ CRITICAL: Backend expects 'orgUnit' not 'orgUnitId'
      const payload = {
        employeeId,
        roleId: form.roleId,
        orgUnit: form.orgUnitId,  // ✅ Backend parameter is 'orgUnit'
        departmentCode: form.departmentCode,
        branchId: form.branchId || null,
        effectiveFrom: form.effectiveFrom,
        notes: form.notes || ""
      };

      console.log("📤 Submitting role assignment:", payload);

      // Try primary endpoint first (from employeeRoutes.js)
      const response = await api.post("/employees/roles/assign", payload);

      console.log("✅ Role assigned successfully:", response.data);
      alert("Role assigned successfully!");
      
      // Navigate to appropriate page
      if (onBack) {
        onBack();
      } else {
        navigate("/DraftDashboard");
      }
    } catch (err) {
      console.error("❌ Role assignment failed:", err);
      const errorMsg = err.response?.data?.message || err.message || "Failed to assign role";
      setError(errorMsg);
      alert(errorMsg);
      
      // Show detailed validation errors if available
      if (err.response?.data?.errors) {
        setValidationErrors(err.response.data.errors);
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------ Permissions Preview ------------------------------ */
  useEffect(() => {
    const loadPreview = async () => {
      if (!form.roleId || !form.orgUnitId) {
        setEffectivePermissions(null);
        return;
      }

      try {
        setLoadingPermissions(true);
        const res = await api.get("/permissions/preview-inheritance", {
          params: { roleId: form.roleId, orgUnitId: form.orgUnitId },
        });
        setEffectivePermissions(res.data?.summary || res.data);
      } catch (err) {
        console.warn("⚠️ Permission preview unavailable:", err.message);
        const role = roles.find((r) => r._id === form.roleId);
        setEffectivePermissions({
          directCount: role?.permissions?.length || 0,
          inheritedCount: "N/A",
          totalEffective: role?.permissions?.length || 0,
        });
      } finally {
        setLoadingPermissions(false);
      }
    };

    loadPreview();
  }, [form.roleId, form.orgUnitId, roles]);

  /* ------------------------------ Tree Logic ------------------------------ */
  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
      return next;
    });
  };

  const TreeNode = ({ node, level = 0 }) => {
    const hasChildren = node.children?.length > 0;
    const isExpanded = expandedNodes.has(node._id);
    const isSelected = form.orgUnitId === node._id;

    const departmentMismatch = form.departmentCode && 
                                form.departmentCode !== "All" && 
                                node.departmentCode !== form.departmentCode;

    return (
      <div className="w-full">
        <div
          className={`group flex items-center py-2 px-3 my-1 rounded-md transition-all cursor-pointer border ${
            isSelected
              ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
              : departmentMismatch
              ? "border-red-200 opacity-50 hover:bg-red-50"
              : "border-transparent hover:bg-gray-50 text-gray-700"
          }`}
          style={{ marginLeft: `${level * 16}px` }}
          onClick={() => {
            if (!departmentMismatch) {
              setForm((prev) => ({ ...prev, orgUnitId: node._id }));
            }
          }}
        >
          <div className="flex items-center flex-1 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNode(node._id);
                }}
                className="p-0.5 mr-1 hover:bg-blue-100 rounded transition-colors flex-shrink-0"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : (
              <span className="w-5 mr-1 flex-shrink-0" />
            )}

            <span className="mr-2 flex-shrink-0">
              {hasChildren ? <Building2 size={16} /> : <Users size={16} />}
            </span>

            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{node.name}</span>
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <span className="uppercase tracking-wider font-bold">{node.departmentCode}</span>
                {node.branchId && (
                  <span>
                    • Branch: {typeof node.branchId === 'object' ? node.branchId.name : node.branchId}
                  </span>
                )}
              </div>
            </div>
          </div>

          {isSelected && <CheckCircle2 size={16} className="text-blue-600 flex-shrink-0 ml-2" />}
        </div>

        {isExpanded && hasChildren && (
          <div className="mt-1">
            {node.children.map((child) => (
              <TreeNode key={child._id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ------------------------------ Loading State ------------------------------ */
  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className="text-gray-500 text-sm font-medium">Loading organizational data...</p>
      </div>
    );
  }

  /* ------------------------------ Error State ------------------------------ */
  if (error && !employee) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-red-50 rounded-xl border border-red-200 my-8">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-bold text-red-800 mb-2">Failed to Load Data</h3>
            <p className="text-red-700 text-sm mb-4">{error}</p>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------ Main Render ------------------------------ */
  return (
    <div className="max-w-6xl mx-auto p-8 bg-white shadow-xl rounded-2xl my-8 border border-gray-100">
      <div className="border-b pb-6 mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Assign Role & Position</h2>
          <p className="text-gray-500 text-sm mt-1">
            Configuring system access for <span className="text-blue-600 font-semibold">{employee?.individualName || "Employee"}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Employee UID</p>
          <p className="font-mono text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded border">{employee?._id}</p>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-bold text-red-800 text-sm mb-1">Validation Errors:</h4>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Designation Role *</label>
            <select
              className="w-full border-2 rounded-xl px-4 py-3 bg-gray-50 focus:border-blue-500 outline-none transition-all text-sm"
              value={form.roleId}
              onChange={(e) => setForm(prev => ({ ...prev, roleId: e.target.value }))}
            >
              <option value="">Select a defined role...</option>
              {roles.map((role) => (
                <option key={role._id} value={role._id}>
                  {role.roleName} — {role.category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Department Category *</label>
            <select
              className="w-full border-2 rounded-xl px-4 py-3 bg-gray-50 focus:border-blue-500 outline-none transition-all text-sm"
              value={form.departmentCode}
              onChange={(e) => setForm(prev => ({ ...prev, departmentCode: e.target.value }))}
            >
              <option value="">Select Department...</option>
              {["HR", "Finance", "BusinessOperation", "IT", "Compliance", "All"].map(code => (
                <option key={code} value={code}>{code === "All" ? "All (Executive)" : code}</option>
              ))}
            </select>
            {form.departmentCode && (
              <p className="text-xs text-gray-500 mt-1 italic">
                Only positions from this department will be selectable
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Work Branch / Location</label>
            <select
              className="w-full border-2 rounded-xl px-4 py-3 bg-gray-50 focus:border-blue-500 outline-none transition-all text-sm"
              value={form.branchId}
              onChange={(e) => setForm(prev => ({ ...prev, branchId: e.target.value }))}
            >
              <option value="">No specific branch (HQ/Remote)</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>{branch.name} ({branch.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Effective From</label>
            <input
              type="date"
              className="w-full border-2 rounded-xl px-4 py-3 bg-gray-50 focus:border-blue-500 outline-none transition-all text-sm"
              value={form.effectiveFrom}
              onChange={(e) => setForm(prev => ({ ...prev, effectiveFrom: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Assignment Notes (Optional)</label>
            <textarea
              className="w-full border-2 rounded-xl px-4 py-3 bg-gray-50 focus:border-blue-500 outline-none transition-all text-sm resize-none"
              rows={3}
              placeholder="Any special notes about this assignment..."
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          {effectivePermissions && (
            <div className="mt-6 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-inner">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-gray-800 tracking-tight">Access Preview</h3>
              </div>
              
              {loadingPermissions ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-xs font-medium text-blue-600">Calculating inheritance...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">Direct Permissions:</span>
                    <span className="font-bold text-blue-700">{effectivePermissions.directCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">Subordinate Units:</span>
                    <span className="font-bold text-green-700">{effectivePermissions.inheritedCount}</span>
                  </div>
                  <div className="pt-3 mt-3 border-t border-blue-200 flex justify-between items-center">
                    <span className="font-bold text-gray-800">Total Effective:</span>
                    <span className="text-xl font-black text-indigo-700">{effectivePermissions.totalEffective}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <label className="block text-sm font-bold text-gray-700 mb-2">Hierarchy Placement *</label>
          <div className="border-2 rounded-2xl p-4 h-[500px] overflow-y-auto bg-gray-50/50 shadow-inner border-gray-100">
            {orgTree.length > 0 ? (
              orgTree.map((node) => <TreeNode key={node._id} node={node} />)
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                No organization units found
              </div>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-2 italic px-1">
            * Selected node determines the reporting line and inherited data visibility.
          </p>
        </div>

        <div className="lg:col-span-2 flex justify-end gap-4 mt-8 pt-8 border-t">
          <button
            type="button"
            onClick={onBack || (() => navigate("/DraftDashboard"))}
            className="px-8 py-3 bg-white text-gray-500 font-bold rounded-xl border-2 hover:bg-gray-50 transition-colors"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-10 py-3 bg-blue-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirm Assignment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignRolesForm;