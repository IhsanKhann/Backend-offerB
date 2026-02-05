import { useState, useEffect } from 'react';
import { Building2, Users, ChevronRight, ChevronDown, Plus, Edit2, Trash2, Move, Search } from 'lucide-react';
import api from '../api/axios';

const HierarchyTree = () => {
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [branches, setBranches] = useState([]);
  
  // Editor States
  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState('create');
  const [editorData, setEditorData] = useState(null);

  useEffect(() => {
    fetchTree();
    fetchBranches();
  }, [filterBranch, filterDept]);

  const fetchTree = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterBranch !== 'all') params.append('branchId', filterBranch);
      if (filterDept !== 'all') params.append('departmentCode', filterDept);
      
      const response = await api.get(`/org-units?${params}`);
      
      setTreeData(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch tree:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await api.get('/branches');
      setBranches(response.data.branches || []);
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    }
  };

  const handleCreate = (parentNode = null) => {
    setEditorMode('create');
    setEditorData({ parent: parentNode });
    setShowEditor(true);
  };

  const handleEdit = (node) => {
    setEditorMode('edit');
    setEditorData(node);
    setShowEditor(true);
  };

  const handleMove = (node) => {
    setEditorMode('move');
    setEditorData(node);
    setShowEditor(true);
  };

  const handleDelete = async (node) => {
    if (!confirm(`Delete ${node.name}?`)) return;
    
    // ✅ Optimistic update
    const originalTree = [...treeData];
    const removeNode = (nodes, targetId) => {
      return nodes.filter(n => {
        if (n._id === targetId) return false;
        if (n.children) {
          n.children = removeNode(n.children, targetId);
        }
        return true;
      });
    };
    setTreeData(removeNode([...treeData], node._id));
    
    try {
      const response = await api.delete(`/org-units/${node._id}`);
      
      if (!response.data.success) {
        // Rollback on failure
        setTreeData(originalTree);
        alert(`Failed: ${response.data.error}`);
      } else {
        alert('Deleted successfully');
      }
    } catch (error) {
      // Rollback on error
      setTreeData(originalTree);
      alert('Failed to delete');
    }
  };

  const handleSave = async (formData) => {
    try {
      const url = editorMode === 'edit' 
        ? `/org-units/${editorData._id}`
        : editorMode === 'move'
        ? `/org-units/${editorData._id}/move`
        : '/org-units';
      
      const method = editorMode === 'edit' ? 'put' : editorMode === 'move' ? 'patch' : 'post';
      
      // ✅ Optimistic update for create/edit
      if (editorMode === 'create') {
        const tempId = `temp-${Date.now()}`;
        const newNode = {
          _id: tempId,
          ...formData,
          children: [],
          employeeCount: 0
        };
        
        if (formData.parent) {
          const addToParent = (nodes) => {
            return nodes.map(n => {
              if (n._id === formData.parent) {
                return { ...n, children: [...(n.children || []), newNode] };
              }
              if (n.children) {
                return { ...n, children: addToParent(n.children) };
              }
              return n;
            });
          };
          setTreeData(addToParent([...treeData]));
        } else {
          setTreeData([...treeData, newNode]);
        }
      }
      
      const response = await api[method](url, formData);
      
      if (response.data.success) {
        setShowEditor(false);
        fetchTree(); // Full refresh to get correct data
      } else {
        alert(`Failed: ${response.data.error}`);
        fetchTree(); // Rollback
      }
    } catch (error) {
      alert('Failed to save');
      fetchTree(); // Rollback
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-800">Organization Structure</h1>
          <button 
            onClick={() => handleCreate()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={18} />
            Add Root Unit
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search units..." 
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* ✅ NEW: Branch switcher */}
          <select 
            className="px-4 py-2 bg-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
          >
            <option value="all">All Branches</option>
            <option value="head-office">Head Office</option>
            {branches.map(branch => (
              <option key={branch._id} value={branch._id}>{branch.name}</option>
            ))}
          </select>

          <select 
            className="px-4 py-2 bg-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            <option value="all">All Departments</option>
            <option value="HR">HR</option>
            <option value="Finance">Finance</option>
            <option value="BusinessOperation">Business Operation</option>
            <option value="IT">IT</option>
            <option value="Compliance">Compliance</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {treeData.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <Building2 size={48} className="mx-auto mb-4 opacity-30" />
                <p>No organizational units found</p>
                <p className="text-sm mt-2">Try adjusting your filters or create a new root unit</p>
              </div>
            ) : (
              treeData.map(node => (
                <TreeNode 
                  key={node._id} 
                  node={node}
                  selectedId={selectedNode?._id}
                  onSelect={setSelectedNode}
                  onAddChild={handleCreate}
                  onEdit={handleEdit}
                  onMove={handleMove}
                  onDelete={handleDelete}
                  searchTerm={searchTerm}
                />
              ))
            )}
          </div>
        )}
      </div>

      {showEditor && (
        <EditorModal 
          mode={editorMode}
          data={editorData}
          treeData={treeData}
          branches={branches}
          onSave={handleSave}
          onClose={() => setShowEditor(false)}
        />
      )}

      {selectedNode && (
        <NodeDetailsPanel 
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
};

const TreeNode = ({ node, level = 0, selectedId, onSelect, onAddChild, onEdit, onMove, onDelete, searchTerm }) => {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node._id;
  
  const matchesSearch = !searchTerm || 
    node.name.toLowerCase().includes(searchTerm.toLowerCase());
  
  if (!matchesSearch && !hasChildren) return null;

  const getDeptColor = (dept) => {
    const colors = {
      Finance: 'bg-blue-100 text-blue-700',
      HR: 'bg-green-100 text-green-700',
      IT: 'bg-indigo-100 text-indigo-700',
      Compliance: 'bg-orange-100 text-orange-700',
      BusinessOperation: 'bg-purple-100 text-purple-700',
      All: 'bg-gray-100 text-gray-700'
    };
    return colors[dept] || colors.All;
  };

  return (
    <div className="mb-1">
      <div 
        onClick={() => onSelect(node)}
        className={`group flex items-center p-3 rounded-lg cursor-pointer transition-all border ${
          isSelected 
            ? 'bg-blue-600 border-blue-700 text-white shadow-md' 
            : 'bg-white hover:border-blue-300 border-gray-200'
        }`}
        style={{ marginLeft: `${level * 24}px` }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); if (hasChildren) setExpanded(!expanded); }}
          className={`w-6 h-6 flex items-center justify-center rounded mr-2 ${
            isSelected ? 'hover:bg-blue-500' : 'hover:bg-gray-100'
          }`}
        >
          {hasChildren ? (
            expanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>
          ) : (
            <div className="w-2 h-2 bg-current opacity-30 rounded-full"/>
          )}
        </button>

        <div className="flex-1 flex items-center gap-3 overflow-hidden">
          {hasChildren ? <Building2 size={18} /> : <Users size={18} />}
          <div className="flex-1">
            <span className="font-semibold truncate block">{node.name}</span>
            <span className="text-xs opacity-75">{node.type}</span>
          </div>
          
          {/* ✅ NEW: Employee count badge */}
          {node.employeeCount > 0 && (
            <span className={`text-xs px-2 py-1 rounded-full ${
              isSelected ? 'bg-white/20' : 'bg-blue-100 text-blue-700'
            }`}>
              {node.employeeCount} 👤
            </span>
          )}
          
          {!isSelected && (
            <span className={`text-[10px] px-2 py-1 rounded-full ${getDeptColor(node.departmentCode)}`}>
              {node.departmentCode}
            </span>
          )}
        </div>

        <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
          <button 
            onClick={(e) => { e.stopPropagation(); onAddChild(node); }} 
            className="p-1.5 hover:bg-black/10 rounded"
            title="Add child unit"
          >
            <Plus size={16}/>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(node); }} 
            className="p-1.5 hover:bg-black/10 rounded"
            title="Edit unit"
          >
            <Edit2 size={16}/>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onMove(node); }} 
            className="p-1.5 hover:bg-black/10 rounded"
            title="Move unit"
          >
            <Move size={16}/>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(node); }} 
            className="p-1.5 hover:bg-red-500/20 rounded text-red-500"
            title="Delete unit"
          >
            <Trash2 size={16}/>
          </button>
        </div>
      </div>
      
      {expanded && hasChildren && (
        <div className="mt-1">
          {node.children.map(child => (
            <TreeNode 
              key={child._id} 
              node={child} 
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onMove={onMove}
              onDelete={onDelete}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const EditorModal = ({ mode, data, treeData, branches, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: data?.name || '',
    type: data?.type || 'DIVISION',
    departmentCode: data?.departmentCode || 'All',
    parent: data?.parent?._id || data?.parent || null,
    branchId: data?.branchId?._id || data?.branchId || null,
    newParentId: null // For move mode
  });

  const handleSubmit = () => {
    if (mode === 'move') {
      onSave({ newParentId: form.newParentId });
    } else {
      onSave(form);
    }
  };

  const flattenTree = (nodes, level = 0) => {
    let result = [];
    nodes.forEach(node => {
      result.push({ ...node, level });
      if (node.children) {
        result = [...result, ...flattenTree(node.children, level + 1)];
      }
    });
    return result;
  };

  const flatNodes = flattenTree(treeData).filter(n => 
    mode === 'move' ? n._id !== data?._id : true
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6 border-b bg-gray-50">
          <h3 className="text-xl font-bold text-gray-800">
            {mode === 'create' ? 'Create Unit' : mode === 'edit' ? 'Edit Unit' : 'Move Unit'}
          </h3>
        </div>
        
        <div className="p-6 space-y-4">
          {mode !== 'move' && (
            <>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Unit Name</label>
                <input 
                  className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
                <select 
                  className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.type}
                  onChange={e => setForm({...form, type: e.target.value})}
                >
                  <option value="ORG_ROOT">Org Root</option>
                  <option value="BOARD">Board</option>
                  <option value="EXECUTIVE">Executive</option>
                  <option value="DIVISION">Division</option>
                  <option value="DEPARTMENT">Department</option>
                  <option value="DESK">Desk</option>
                  <option value="CELL">Cell</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Department</label>
                <select 
                  className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.departmentCode}
                  onChange={e => setForm({...form, departmentCode: e.target.value})}
                >
                  <option value="All">All (Executive)</option>
                  <option value="HR">HR</option>
                  <option value="Finance">Finance</option>
                  <option value="BusinessOperation">Business Operation</option>
                  <option value="IT">IT</option>
                  <option value="Compliance">Compliance</option>
                </select>
              </div>

              {/* ✅ NEW: Branch selector */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Branch</label>
                <select 
                  className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.branchId || ''}
                  onChange={e => setForm({...form, branchId: e.target.value || null})}
                >
                  <option value="">Global (No specific branch)</option>
                  {branches.map(branch => (
                    <option key={branch._id} value={branch._id}>{branch.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              {mode === 'move' ? 'New Parent Unit' : 'Parent Unit'}
            </label>
            <select 
              className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              value={mode === 'move' ? form.newParentId || '' : form.parent || ''}
              onChange={e => {
                const value = e.target.value || null;
                setForm(mode === 'move' 
                  ? {...form, newParentId: value}
                  : {...form, parent: value}
                );
              }}
            >
              <option value="">None (Root)</option>
              {flatNodes.map(node => (
                <option key={node._id} value={node._id}>
                  {'  '.repeat(node.level)}└─ {node.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              onClick={onClose}
              className="flex-1 py-3 font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
            >
              Cancel
            </button>
            <button 
              onClick={handleSubmit}
              className="flex-1 py-3 font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const NodeDetailsPanel = ({ node, onClose }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await api.get(`/org-units/${node._id}/employees`);
        setEmployees(response.data.employees || []);
      } catch (error) {
        console.error('Failed to fetch employees:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, [node._id]);

  return (
    <div className="fixed right-0 top-0 h-screen w-96 bg-white shadow-2xl z-40 overflow-y-auto">
      <div className="p-6 border-b bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-gray-800">{node.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="flex gap-2">
          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-bold">
            {node.type}
          </span>
          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full font-bold">
            {node.departmentCode}
          </span>
        </div>
      </div>

      <div className="p-6">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Users size={20} /> Employees ({employees.length})
        </h3>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : employees.length > 0 ? (
          <div className="space-y-3">
            {employees.map(emp => (
              <div key={emp._id} className="bg-gray-50 p-4 rounded-lg border">
                <p className="font-bold text-gray-900">{emp.individualName}</p>
                <p className="text-sm text-gray-500">{emp.personalEmail}</p>
                {emp.role && (
                  <span className="inline-block mt-2 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    {emp.role.roleName}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-400">
            No employees assigned
          </div>
        )}
      </div>
    </div>
  );
};

export default HierarchyTree;