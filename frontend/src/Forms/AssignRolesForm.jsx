import { useEffect, useState, useCallback } from "react";
import { ChevronRight, ChevronDown, Building2, Users, Loader2, AlertCircle, Shield } from "lucide-react";
import { useParams } from "react-router-dom";
import api from "../api/axios.js";

const AssignRolesForm = ({ onBack }) => {
  const { employeeId } = useParams();

  /* ------------------------------ State ------------------------------ */
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

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

      // Adapt to your specific backend response structures
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
      } catch {
        // Fallback calculation UI-side if route doesn't exist yet
        const role = roles.find((r) => r._id === form.roleId);
        setEffectivePermissions({
          directCount: role?.permissions?.length || 0,
          inheritedCount: "...",
          totalEffective: "Select Position",
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

    return (
      <div className="w-full">
        <div
          className={`group flex items-center py-2 px-3 my-1 rounded-md transition-all cursor-pointer border ${
            isSelected
              ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
              : "border-transparent hover:bg-gray-50 text-gray-700"
          }`}
          style={{ marginLeft: `${level * 16}px` }}
          onClick={() => setForm((prev) => ({ ...prev, orgUnitId: node._id }))}
        >
          <div className="flex items-center flex-1 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNode(node._id);
                }}
                className="p-1 hover:bg-gray-200 rounded transition-colors mr-1"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-6" />
            )}
            <div className="mr-3 flex-shrink-0">
              {node.type === "DEPARTMENT" || hasChildren ? (
                <Building2 className={`w-4 h-4 ${isSelected ? "text-blue-500" : "text-gray-400"}`} />
              ) : (
                <Users className={`w-4 h-4 ${isSelected ? "text-blue-500" : "text-gray-400"}`} />
              )}
            </div>
            <div className="truncate flex-1">
              <p className="text-sm font-medium truncate">{node.name}</p>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? "text-blue-500" : "text-gray-400"}`}>
                {node.type} • {node.departmentCode}
              </p>
            </div>
            {node.employeeCount > 0 && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 ${
                isSelected ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'
              }`}>
                {node.employeeCount}
              </span>
            )}
          </div>
          {isSelected && (
            <div className="ml-2 w-2 h-2 bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
          )}
        </div>
        {isExpanded && hasChildren && (
          <div className="border-l border-gray-100 ml-3">
            {node.children.map((child) => (
              <TreeNode key={child._id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ------------------------------ Submit ------------------------------ */
 const handleSubmit = async (e) => {
  e.preventDefault();

  // 1. Validate required fields
  if (!form.roleId || !form.orgUnitId || !form.departmentCode) {
    alert("Please ensure Role, Department, and Position are all selected.");
    return;
  }

  try {
    setSubmitting(true);

    // 2. Map frontend state to backend expected keys
    const payload = {
      employeeId: employeeId,   // from useParams
      roleId: form.roleId,      // from select
      orgUnit: form.orgUnitId,  // ✅ CHANGED: Backend expects 'orgUnit'
      branchId: form.branchId || null,
      departmentCode: form.departmentCode,
    };

    console.log("📤 Sending Assignment:", payload);

    const response = await api.post("/roles/assign", payload);

    if (response.data.success) {
      alert("Role assigned successfully!");
      onBack?.();
    }
  } catch (err) {
    console.error("❌ Assignment Error:", err.response?.data);
    alert(err.response?.data?.message || "Assignment failed. Check console.");
  } finally {
    setSubmitting(false);
  }
};

  /* ------------------------------ Loading & Error States ------------------------------ */
  if (initialLoading) {
    return (
      <div className="h-96 w-full flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-gray-500 font-medium italic">Synchronizing organizational data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-20 p-8 bg-red-50 rounded-2xl border border-red-100 flex flex-col items-center text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-red-800">Sync Error</h3>
        <p className="text-red-600 mb-6">{error}</p>
        <button onClick={fetchData} className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors">
          Retry Connection
        </button>
      </div>
    );
  }

  /* ------------------------------ Main Render ------------------------------ */
  return (
    <div className="max-w-6xl mx-auto p-8 bg-white shadow-xl rounded-2xl my-8 border border-gray-100">
      {/* Header */}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left Column: Form Controls */}
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

          {/* Permissions Preview Card */}
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
                    <span className="text-gray-600 font-medium">Subordinate Inherited:</span>
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

        {/* Right Column: Organization Tree */}
        <div className="flex flex-col">
          <label className="block text-sm font-bold text-gray-700 mb-2">Hierarchy Placement *</label>
          <div className="border-2 rounded-2xl p-4 h-[440px] overflow-y-auto bg-gray-50/50 shadow-inner border-gray-100">
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

        {/* Action Footer */}
        <div className="lg:col-span-2 flex justify-end gap-4 mt-8 pt-8 border-t">
          <button
            type="button"
            onClick={onBack}
            className="px-8 py-3 bg-white text-gray-500 font-bold rounded-xl border-2 hover:bg-gray-50 transition-colors"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-10 py-3 bg-blue-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Confirm Assignment"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignRolesForm;