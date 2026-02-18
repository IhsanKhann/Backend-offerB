import { useEffect, useState, useMemo } from "react";
import api from "../api/axios";
import Sidebar from "./Sidebar";
import {
  Shield,
  Users,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Eye,
  UserCheck,
  Award,
  Building2,
  Briefcase,
  TrendingUp,
  Lock,
  Unlock,
  Info,
  Grid,
  List,
  GitBranch,
} from "lucide-react";

export default function PermissionsManager() {
  // ==================== STATE MANAGEMENT ====================
  const [viewMode, setViewMode] = useState("employees"); // employees, roles, permissions, statistics
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [employeePermissions, setEmployeePermissions] = useState({
    direct: [],
    inherited: [],
    total: [],
  });
  const [statistics, setStatistics] = useState(null);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [permissionCategoryFilter, setPermissionCategoryFilter] = useState("All");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [expandedRoles, setExpandedRoles] = useState(new Set());
  const [successMessage, setSuccessMessage] = useState("");

  // New Permission Form
  const [newPermission, setNewPermission] = useState({
    name: "",
    action: "",
    description: "",
    statusScope: ["ALL"],
    hierarchyScope: "SELF",
    resourceType: "ALL",
    category: "System",
  });

  // ==================== SIDEBAR CONFIG ====================
  const navItems = [
    {
      name: "Employees",
      icon: <Users size={18} />,
      action: () => setViewMode("employees"),
    },
    {
      name: "Roles",
      icon: <Award size={18} />,
      action: () => setViewMode("roles"),
    },
    {
      name: "Permissions",
      icon: <Shield size={18} />,
      action: () => setViewMode("permissions"),
    },
    {
      name: "Statistics",
      icon: <TrendingUp size={18} />,
      action: () => setViewMode("statistics"),
    },
  ];

  // ==================== DATA FETCHING ====================
  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (viewMode === "statistics") {
      fetchStatistics();
    }
  }, [viewMode]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchEmployees(), fetchRoles(), fetchAllPermissions()]);
    } catch (err) {
      setError("Failed to load initial data");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/permissions/employees-with-permissions", {
        params: { category: categoryFilter, departmentCode: departmentFilter },
      });
      setEmployees(res.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
      setEmployees([]);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get("/roles/getAllRolesList");
      setRoles(res.data?.Roles || []);
    } catch (err) {
      console.error("Failed to fetch roles:", err);
      setRoles([]);
    }
  };

  const fetchAllPermissions = async () => {
    try {
      const res = await api.get("/permissions/AllPermissions");
      const permissions = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      setAllPermissions(permissions);
    } catch (err) {
      console.error("Failed to fetch permissions:", err);
      setAllPermissions([]);
    }
  };

  const fetchEmployeePermissions = async (employeeId) => {
    try {
      const res = await api.get(`/permissions/getPermissionsDetailed/${employeeId}`);
      if (res.data?.success) {
        setEmployeePermissions(res.data.permissions || { direct: [], inherited: [], total: [] });
        setSelectedEmployee(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch employee permissions:", err);
      showError("Failed to load employee permissions");
    }
  };

  const fetchStatistics = async () => {
    try {
      const res = await api.get("/permissions/statistics");
      setStatistics(res.data?.statistics || null);
    } catch (err) {
      console.error("Failed to fetch statistics:", err);
    }
  };

  // ==================== PERMISSION OPERATIONS ====================
  const addPermissionToEmployee = async (permissionId) => {
    if (!selectedEmployee) return;

    try {
      await api.post("/permissions/addEmployeePermission", {
        employeeId: selectedEmployee.employeeId,
        permissionId,
      });
      
      await fetchEmployeePermissions(selectedEmployee.employeeId);
      showSuccess("Permission added successfully");
    } catch (err) {
      showError(err.response?.data?.message || "Failed to add permission");
    }
  };

  const removePermissionFromEmployee = async (permissionId) => {
    if (!selectedEmployee) return;

    try {
      await api.post("/permissions/removeEmployeePermission", {
        employeeId: selectedEmployee.employeeId,
        permissionId,
      });
      
      await fetchEmployeePermissions(selectedEmployee.employeeId);
      showSuccess("Permission removed successfully");
    } catch (err) {
      showError(err.response?.data?.message || "Failed to remove permission");
    }
  };

  const addPermissionToRole = async (roleId, permissionId) => {
    try {
      const role = roles.find((r) => r._id === roleId);
      if (!role) return;

      const updatedPermissions = [...role.permissions.map(p => p._id || p), permissionId];
      
      await api.put(`/roles/${roleId}`, {
        permissions: updatedPermissions,
      });

      await fetchRoles();
      showSuccess("Permission added to role");
    } catch (err) {
      showError(err.response?.data?.message || "Failed to add permission to role");
    }
  };

  const removePermissionFromRole = async (roleId, permissionId) => {
    try {
      const role = roles.find((r) => r._id === roleId);
      if (!role) return;

      const updatedPermissions = role.permissions
        .map(p => p._id || p)
        .filter((id) => id.toString() !== permissionId.toString());

      await api.put(`/roles/${roleId}`, {
        permissions: updatedPermissions,
      });

      await fetchRoles();
      showSuccess("Permission removed from role");
    } catch (err) {
      showError(err.response?.data?.message || "Failed to remove permission from role");
    }
  };

  const createNewPermission = async () => {
    try {
      await api.post("/permissions/createPermission", newPermission);
      await fetchAllPermissions();
      setShowPermissionModal(false);
      resetPermissionForm();
      showSuccess("Permission created successfully");
    } catch (err) {
      showError(err.response?.data?.message || "Failed to create permission");
    }
  };

  const deletePermission = async (permissionId) => {
    if (!window.confirm("Are you sure you want to delete this permission?")) return;

    try {
      await api.delete(`/permissions/removePermission/${permissionId}`);
      await fetchAllPermissions();
      showSuccess("Permission deleted successfully");
    } catch (err) {
      showError(err.response?.data?.message || "Failed to delete permission");
    }
  };

  // ==================== HELPER FUNCTIONS ====================
  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const showError = (message) => {
    setError(message);
    setTimeout(() => setError(null), 3000);
  };

  const resetPermissionForm = () => {
    setNewPermission({
      name: "",
      action: "",
      description: "",
      statusScope: ["ALL"],
      hierarchyScope: "SELF",
      resourceType: "ALL",
      category: "System",
    });
  };

  const toggleRoleExpansion = (roleId) => {
    const newExpanded = new Set(expandedRoles);
    if (newExpanded.has(roleId)) {
      newExpanded.delete(roleId);
    } else {
      newExpanded.add(roleId);
    }
    setExpandedRoles(newExpanded);
  };

  // ==================== FILTERED DATA ====================
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch = emp.individualName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
        emp.personalEmail?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDepartment =
        departmentFilter === "All" || emp.departmentCode === departmentFilter;
      const matchesCategory =
        categoryFilter === "All" || emp.role?.category === categoryFilter;
      return matchesSearch && matchesDepartment && matchesCategory;
    });
  }, [employees, searchTerm, departmentFilter, categoryFilter]);

  const filteredPermissions = useMemo(() => {
    return allPermissions.filter((perm) => {
      const matchesCategory =
        permissionCategoryFilter === "All" || perm.category === permissionCategoryFilter;
      const matchesSearch =
        perm.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        perm.description?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [allPermissions, permissionCategoryFilter, searchTerm]);

  const getAvailablePermissionsForEmployee = () => {
    if (!selectedEmployee) return [];
    
    const assignedIds = new Set(
      employeePermissions.total.map((p) => p._id || p.id)
    );
    
    return allPermissions.filter((p) => {
      // Check if permission applies to employee's department
      const appliesToDepartment =
        p.statusScope?.includes("ALL") ||
        p.statusScope?.includes(selectedEmployee.departmentCode) ||
        !p.statusScope ||
        p.statusScope.length === 0;
      
      return !assignedIds.has(p._id) && appliesToDepartment;
    });
  };

  const getAvailablePermissionsForRole = (role) => {
    const assignedIds = new Set(
      (role.permissions || []).map((p) => (p._id || p).toString())
    );
    
    return allPermissions.filter((p) => !assignedIds.has(p._id.toString()));
  };

  // ==================== PERMISSION SCOPE BADGE ====================
  const getScopeBadge = (permission) => {
    const departmentColors = {
      HR: "bg-green-100 text-green-800",
      Finance: "bg-blue-100 text-blue-800",
      BusinessOperation: "bg-purple-100 text-purple-800",
      ALL: "bg-gray-100 text-gray-800",
    };

    const hierarchyColors = {
      SELF: "bg-yellow-100 text-yellow-800",
      DESCENDANT: "bg-orange-100 text-orange-800",
      DEPARTMENT: "bg-indigo-100 text-indigo-800",
      ORGANIZATION: "bg-red-100 text-red-800",
    };

    return (
      <div className="flex flex-wrap gap-1">
        {permission.statusScope?.map((scope) => (
          <span
            key={scope}
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              departmentColors[scope] || departmentColors.ALL
            }`}
          >
            {scope}
          </span>
        ))}
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            hierarchyColors[permission.hierarchyScope] || hierarchyColors.SELF
          }`}
        >
          {permission.hierarchyScope}
        </span>
      </div>
    );
  };

  // ==================== VIEW: EMPLOYEES ====================
  const renderEmployeesView = () => (
    <div className="grid grid-cols-12 gap-6">
      {/* Employee List */}
      <div className="col-span-4 bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="text-blue-600" size={24} />
            Employees ({filteredEmployees.length})
          </h2>
        </div>

        {/* Filters */}
        <div className="space-y-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search employees..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="All">All Departments</option>
            <option value="HR">HR</option>
            <option value="Finance">Finance</option>
            <option value="BusinessOperation">Business Operation</option>
            <option value="IT">IT</option>
            <option value="Compliance">Compliance</option>
          </select>

          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="All">All Categories</option>
            <option value="Executive">Executive</option>
            <option value="Management">Management</option>
            <option value="Staff">Staff</option>
            <option value="Support">Support</option>
            <option value="Technical">Technical</option>
          </select>
        </div>

        {/* Employee List */}
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filteredEmployees.map((emp) => (
            <div
              key={emp._id}
              onClick={() => fetchEmployeePermissions(emp._id)}
              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                selectedEmployee?.employeeId === emp._id
                  ? "bg-blue-50 border-blue-500 shadow-md"
                  : "hover:bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center gap-3">
                {emp.avatar?.url ? (
                  <img
                    src={emp.avatar.url}
                    alt={emp.individualName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <Users size={20} className="text-gray-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{emp.individualName}</h3>
                  <p className="text-xs text-gray-500 truncate">{emp.personalEmail}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                      {emp.role?.roleName || "No Role"}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {emp.effectivePermissionsCount} perms
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Permissions Panel */}
      <div className="col-span-8 bg-white rounded-lg shadow-md p-6">
        {!selectedEmployee ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Shield size={64} className="mb-4 text-gray-300" />
            <p className="text-lg">Select an employee to manage permissions</p>
          </div>
        ) : (
          <div>
            {/* Employee Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users size={32} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{selectedEmployee.employeeName}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm bg-purple-100 text-purple-800 px-3 py-1 rounded-full">
                      {selectedEmployee.role?.roleName}
                    </span>
                    <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                      {selectedEmployee.departmentCode}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Permission Tabs */}
            <div className="grid grid-cols-2 gap-6">
              {/* Assigned Permissions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Check className="text-green-600" size={20} />
                    Assigned ({employeePermissions.total?.length || 0})
                  </h3>
                </div>
                
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {employeePermissions.total?.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No permissions assigned
                    </p>
                  ) : (
                    employeePermissions.total?.map((perm) => (
                      <div
                        key={perm._id || perm.id}
                        className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{perm.name}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {perm.description}
                            </div>
                          </div>
                          <button
                            onClick={() => removePermissionFromEmployee(perm._id || perm.id)}
                            className="text-red-500 hover:text-red-700 ml-2"
                            title="Remove permission"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {getScopeBadge(perm)}
                          {perm.source === "direct" && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                              Direct
                            </span>
                          )}
                          {perm.source === "inherited" && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded flex items-center gap-1">
                              <GitBranch size={12} />
                              Inherited
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Available Permissions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Plus className="text-blue-600" size={20} />
                    Available ({getAvailablePermissionsForEmployee().length})
                  </h3>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {getAvailablePermissionsForEmployee().length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No available permissions
                    </p>
                  ) : (
                    getAvailablePermissionsForEmployee().map((perm) => (
                      <div
                        key={perm._id}
                        className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{perm.name}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {perm.description}
                            </div>
                          </div>
                          <button
                            onClick={() => addPermissionToEmployee(perm._id)}
                            className="text-blue-500 hover:text-blue-700 ml-2"
                            title="Add permission"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                        {getScopeBadge(perm)}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ==================== VIEW: ROLES ====================
  const renderRolesView = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Award className="text-purple-600" size={28} />
          Role Permissions Management
        </h2>
        <p className="text-gray-600 mb-6">
          Manage permissions for each role. Permissions assigned here apply to all employees with this role.
        </p>

        <div className="space-y-4">
          {roles.map((role) => {
            const isExpanded = expandedRoles.has(role._id);
            const rolePermissions = role.permissions || [];
            const availablePerms = getAvailablePermissionsForRole(role);

            // Group permissions by statusScope
            const hrPermissions = rolePermissions.filter(p => 
              p.statusScope?.includes("HR") || p.statusScope?.includes("ALL")
            );
            const financePermissions = rolePermissions.filter(p => 
              p.statusScope?.includes("Finance") || p.statusScope?.includes("ALL")
            );
            const businessPermissions = rolePermissions.filter(p => 
              p.statusScope?.includes("BusinessOperation") || p.statusScope?.includes("ALL")
            );

            return (
              <div key={role._id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Role Header */}
                <div
                  onClick={() => toggleRoleExpansion(role._id)}
                  className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown size={20} className="text-gray-600" />
                    ) : (
                      <ChevronRight size={20} className="text-gray-600" />
                    )}
                    <Award size={20} className="text-purple-600" />
                    <div>
                      <h3 className="font-semibold text-lg">{role.roleName}</h3>
                      <p className="text-sm text-gray-500">
                        {rolePermissions.length} permissions assigned
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                      {role.category}
                    </span>
                  </div>
                </div>

                {/* Role Permissions */}
                {isExpanded && (
                  <div className="p-4 bg-white">
                    {/* Department-Scoped Permissions */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      {/* HR Permissions */}
                      <div className="border border-green-200 rounded-lg p-3 bg-green-50">
                        <h4 className="font-semibold text-sm text-green-800 mb-2 flex items-center gap-2">
                          <Building2 size={16} />
                          HR Permissions ({hrPermissions.length})
                        </h4>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {hrPermissions.map(p => (
                            <div key={p._id} className="text-xs bg-white p-2 rounded flex justify-between items-center">
                              <span className="truncate">{p.name}</span>
                              <button
                                onClick={() => removePermissionFromRole(role._id, p._id)}
                                className="text-red-500 hover:text-red-700 ml-1"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Finance Permissions */}
                      <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
                        <h4 className="font-semibold text-sm text-blue-800 mb-2 flex items-center gap-2">
                          <Briefcase size={16} />
                          Finance Permissions ({financePermissions.length})
                        </h4>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {financePermissions.map(p => (
                            <div key={p._id} className="text-xs bg-white p-2 rounded flex justify-between items-center">
                              <span className="truncate">{p.name}</span>
                              <button
                                onClick={() => removePermissionFromRole(role._id, p._id)}
                                className="text-red-500 hover:text-red-700 ml-1"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Business Permissions */}
                      <div className="border border-purple-200 rounded-lg p-3 bg-purple-50">
                        <h4 className="font-semibold text-sm text-purple-800 mb-2 flex items-center gap-2">
                          <TrendingUp size={16} />
                          Business Permissions ({businessPermissions.length})
                        </h4>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {businessPermissions.map(p => (
                            <div key={p._id} className="text-xs bg-white p-2 rounded flex justify-between items-center">
                              <span className="truncate">{p.name}</span>
                              <button
                                onClick={() => removePermissionFromRole(role._id, p._id)}
                                className="text-red-500 hover:text-red-700 ml-1"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Add Permissions */}
                    <div className="border-t pt-4">
                      <h4 className="font-semibold text-sm mb-3">Add Permissions:</h4>
                      <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                        {availablePerms.length === 0 ? (
                          <p className="text-sm text-gray-500 col-span-2 text-center py-4">
                            All permissions assigned
                          </p>
                        ) : (
                          availablePerms.map((perm) => (
                            <div
                              key={perm._id}
                              className="p-2 border border-gray-200 rounded hover:bg-gray-50 flex justify-between items-center"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{perm.name}</div>
                                <div className="flex gap-1 mt-1">
                                  {getScopeBadge(perm)}
                                </div>
                              </div>
                              <button
                                onClick={() => addPermissionToRole(role._id, perm._id)}
                                className="ml-2 text-blue-500 hover:text-blue-700"
                                title="Add to role"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ==================== VIEW: PERMISSIONS ====================
  const renderPermissionsView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="text-blue-600" size={28} />
              System Permissions
            </h2>
            <p className="text-gray-600 mt-1">
              Manage all system permissions. Create, edit, or delete permissions.
            </p>
          </div>
          <button
            onClick={() => setShowPermissionModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={20} />
            Create Permission
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search permissions..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            value={permissionCategoryFilter}
            onChange={(e) => setPermissionCategoryFilter(e.target.value)}
          >
            <option value="All">All Categories</option>
            <option value="HR">HR</option>
            <option value="Finance">Finance</option>
            <option value="Business">Business</option>
            <option value="System">System</option>
            <option value="Reports">Reports</option>
          </select>
        </div>
      </div>

      {/* Permissions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPermissions.map((perm) => (
          <div
            key={perm._id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{perm.name}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {perm.description || "No description"}
                </p>
              </div>
              {!perm.isSystem && (
                <button
                  onClick={() => deletePermission(perm._id)}
                  className="text-red-500 hover:text-red-700 ml-2"
                  title="Delete permission"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="space-y-2">
              {getScopeBadge(perm)}
              
              <div className="flex items-center gap-2 text-xs">
                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                  {perm.resourceType}
                </span>
                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                  {perm.category}
                </span>
              </div>

              {perm.isSystem && (
                <div className="flex items-center gap-1 text-xs text-orange-600">
                  <Lock size={12} />
                  System Permission
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ==================== VIEW: STATISTICS ====================
  const renderStatisticsView = () => {
    if (!statistics) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Permissions</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">
                  {statistics.totalPermissions}
                </p>
              </div>
              <Shield className="text-blue-600" size={48} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Employees</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {statistics.totalEmployees}
                </p>
              </div>
              <Users className="text-green-600" size={48} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Roles</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">
                  {statistics.totalRoles}
                </p>
              </div>
              <Award className="text-purple-600" size={48} />
            </div>
          </div>
        </div>

        {/* Permissions by Category */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold mb-4">Permissions by Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {statistics.permissionsByCategory?.map((cat) => (
              <div key={cat._id} className="border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{cat.count}</p>
                <p className="text-sm text-gray-600 mt-1">{cat._id}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Most Used Permissions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold mb-4">Most Used Permissions</h3>
          <div className="space-y-3">
            {statistics.mostUsedPermissions?.map((perm, index) => (
              <div key={perm._id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{perm.name}</p>
                    <p className="text-sm text-gray-500">{perm.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">{perm.usageCount}</p>
                  <p className="text-xs text-gray-500">roles</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ==================== MODAL: CREATE PERMISSION ====================
  const renderPermissionModal = () => {
    if (!showPermissionModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Create New Permission</h2>
            <button
              onClick={() => {
                setShowPermissionModal(false);
                resetPermissionForm();
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Permission Name *</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., VIEW_EMPLOYEES"
                value={newPermission.name}
                onChange={(e) => setNewPermission({ ...newPermission, name: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Action *</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., VIEW_EMPLOYEES"
                value={newPermission.action}
                onChange={(e) => setNewPermission({ ...newPermission, action: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Describe what this permission allows..."
                value={newPermission.description}
                onChange={(e) => setNewPermission({ ...newPermission, description: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Department Scope *</label>
              <div className="space-y-2">
                {["ALL", "HR", "Finance", "BusinessOperation"].map((dept) => (
                  <label key={dept} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newPermission.statusScope.includes(dept)}
                      onChange={(e) => {
                        if (dept === "ALL" && e.target.checked) {
                          setNewPermission({ ...newPermission, statusScope: ["ALL"] });
                        } else if (dept === "ALL" && !e.target.checked) {
                          setNewPermission({ ...newPermission, statusScope: [] });
                        } else {
                          const filtered = newPermission.statusScope.filter(s => s !== "ALL");
                          if (e.target.checked) {
                            setNewPermission({ ...newPermission, statusScope: [...filtered, dept] });
                          } else {
                            setNewPermission({ ...newPermission, statusScope: filtered.filter(s => s !== dept) });
                          }
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{dept}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Hierarchy Scope *</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={newPermission.hierarchyScope}
                onChange={(e) => setNewPermission({ ...newPermission, hierarchyScope: e.target.value })}
              >
                <option value="SELF">SELF - Can only act on own data</option>
                <option value="DESCENDANT">DESCENDANT - Can act on subordinates</option>
                <option value="DEPARTMENT">DEPARTMENT - Can act on same department</option>
                <option value="ORGANIZATION">ORGANIZATION - Can act on anyone</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Resource Type *</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={newPermission.resourceType}
                onChange={(e) => setNewPermission({ ...newPermission, resourceType: e.target.value })}
              >
                <option value="ALL">ALL</option>
                <option value="EMPLOYEE">EMPLOYEE</option>
                <option value="SALARY">SALARY</option>
                <option value="LEDGER">LEDGER</option>
                <option value="EXPENSE">EXPENSE</option>
                <option value="COMMISSION">COMMISSION</option>
                <option value="LEAVE">LEAVE</option>
                <option value="ROLE">ROLE</option>
                <option value="PERMISSION">PERMISSION</option>
                <option value="ORGUNIT">ORGUNIT</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Category *</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={newPermission.category}
                onChange={(e) => setNewPermission({ ...newPermission, category: e.target.value })}
              >
                <option value="System">System</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
                <option value="Business">Business</option>
                <option value="Reports">Reports</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={createNewPermission}
                disabled={!newPermission.name || !newPermission.action}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Create Permission
              </button>
              <button
                onClick={() => {
                  setShowPermissionModal(false);
                  resetPermissionForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==================== MAIN RENDER ====================
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar title="PermissionsManager" navItems={navItems} />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
      
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mx-6 mt-6 p-4 bg-green-100 border border-green-400 text-green-800 rounded-lg flex items-center gap-2">
            <Check size={20} />
            {successMessage}
          </div>
        )}
        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-100 border border-red-400 text-red-800 rounded-lg flex items-center gap-2">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {viewMode === "employees" && renderEmployeesView()}
          {viewMode === "roles" && renderRolesView()}
          {viewMode === "permissions" && renderPermissionsView()}
          {viewMode === "statistics" && renderStatisticsView()}
        </div>
      </div>

      {/* Permission Modal */}
      {renderPermissionModal()}
    </div>
  );
}