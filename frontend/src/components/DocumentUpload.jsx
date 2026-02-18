import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Upload, CheckCircle, XCircle, Clock, Trash2, Eye } from 'lucide-react';
import api from '../../src/api/axios.js';

const DocumentUpload = ({
  employeeId = null,
  documents: initialDocuments,  // ✅ Rename to avoid confusion
  setDocuments,
  isFinal = false,
  readOnly = false
}) => {
 
  // ✅ FIXED: Initialize with fallback to empty array
  const [localDocuments, setLocalDocuments] = useState(initialDocuments || []);
  const [documentConfig, setDocumentConfig] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [customName, setCustomName] = useState('');
  const [completionStatus, setCompletionStatus] = useState('Incomplete');

  // Use a ref to track if initial config is loaded to prevent flickering
  const configFetched = useRef(false);

  // ✅ FIXED: Sync local state when prop changes
  useEffect(() => {
    if (initialDocuments !== undefined) {
      setLocalDocuments(initialDocuments);
    }
  }, [initialDocuments]);

  const fetchDocuments = useCallback(async () => {
    if (!employeeId) return;
    try {
      const response = await api.get(
        `/documents/employees/${employeeId}/documents`,
        { params: { isFinal } }
      );
      const docs = response.data.data.documents || [];
      setLocalDocuments(docs);
      if (setDocuments) {
        setDocuments(docs);
      }
      setCompletionStatus(response.data.data.completionStatus || 'Incomplete');
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  }, [employeeId, isFinal, setDocuments]);

  const fetchDocumentConfig = useCallback(async () => {
    try {
      const response = await api.get('/documents/configuration');
      setDocumentConfig(response.data.data);
      configFetched.current = true;
    } catch (error) {
      console.error('Failed to fetch document configuration:', error);
    }
  }, []);

  useEffect(() => {
    fetchDocumentConfig();
    
    if (employeeId) {
      fetchDocuments();
    }
  }, [employeeId, fetchDocuments, fetchDocumentConfig]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedType) return;

    // common validation
    if (documentConfig && file.size > documentConfig.maxFileSize) {
      alert(`File size must be less than ${documentConfig.maxFileSize / 1048576}MB`);
      return;
    }

    // 🟡 DRAFT MODE (no employeeId)
    if (!employeeId) {
      const newDoc = {
        tempId: crypto.randomUUID(),
        documentType: selectedType,
        customDocumentName: selectedType === 'Other' ? customName : null,
        file,
        status: 'Pending',
        uploadedAt: new Date()
      };

      setLocalDocuments(prev => [...prev, newDoc]);
      if (setDocuments) {
        setDocuments(prev => [...(prev || []), newDoc]);
      }

      setSelectedType('');
      setCustomName('');
      e.target.value = '';
      return;
    }

    // 🟢 FINAL MODE (existing employee → API)
    const formData = new FormData();
    formData.append('document', file);
    formData.append('documentType', selectedType);
    formData.append('isFinal', String(isFinal));

    if (selectedType === 'Other' && customName) {
      formData.append('customDocumentName', customName);
    }

    try {
      setUploading(true);
      const res = await api.post(
        `/documents/employees/${employeeId}/documents`,
        formData
      );

      const newDoc = res.data.data.document;
      setLocalDocuments(prev => [...prev, newDoc]);
      if (setDocuments) {
        setDocuments(prev => [...(prev || []), newDoc]);
      }
      setCompletionStatus(res.data.data.completionStatus);

      setSelectedType('');
      setCustomName('');
      e.target.value = '';
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (id) => {
    // 🟡 Draft mode
    if (!employeeId) {
      setLocalDocuments(prev => prev.filter(doc => doc.tempId !== id));
      if (setDocuments) {
        setDocuments(prev => (prev || []).filter(doc => doc.tempId !== id));
      }
      return;
    }

    // 🟢 Final mode
    if (!window.confirm('Delete this document?')) return;

    try {
      await api.delete(
        `/documents/employees/${employeeId}/documents/${id}`,
        { params: { isFinal } }
      );

      setLocalDocuments(prev => prev.filter(doc => doc._id !== id));
      if (setDocuments) {
        setDocuments(prev => (prev || []).filter(doc => doc._id !== id));
      }
      fetchDocuments();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete document');
    }
  };

  if (!documentConfig) {
    return <p className="text-sm text-gray-500">Loading document configuration…</p>;
  }

  const getStatusBadge = (status) => {
    const styles = {
      'Incomplete': 'bg-gray-100 text-gray-700',
      'Complete': 'bg-blue-100 text-blue-700',
      'Under Review': 'bg-yellow-100 text-yellow-700',
      'Approved': 'bg-green-100 text-green-700'
    };
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>
        {status}
      </span>
    );
  };

  // ✅ FIXED: Use localDocuments which is always an array
  const requiredDocs = documentConfig?.documentTypes.filter(d => d.required) || [];
  const uploadedTypes = localDocuments.map(d => d.documentType);
  const missingRequired = requiredDocs.filter(req => !uploadedTypes.includes(req.value));

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Document Management</h3>
          <p className="text-sm text-gray-600 mt-1">
            Upload and manage employee documents
          </p>
        </div>
        {getStatusBadge(completionStatus)}
      </div>

      {/* Missing Required Documents Alert */}
      {missingRequired.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Missing required documents:</strong> {missingRequired.map(d => d.label).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Section */}
      {!readOnly && (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select document type</option>
                  {documentConfig?.documentTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label} {type.required ? '(Required)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedType === 'Other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Document Name
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Enter document name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload File
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-3 text-gray-400" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">
                      PDF, JPG, PNG, DOC or DOCX (MAX. 5MB)
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading || !selectedType}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  />
                </label>
              </div>
            </div>

            {uploading && (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-600">Uploading...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documents List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700">
            Uploaded Documents ({localDocuments.length})
          </h4>
        </div>
        
        {localDocuments.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p>No documents uploaded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {localDocuments.map((doc) => (
              <div key={doc._id || doc.tempId} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <FileText className="text-blue-500 mt-1" size={20} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {doc.documentType === 'Other' && doc.customDocumentName
                          ? doc.customDocumentName
                          : doc.documentType}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {doc.file?.originalName || doc.file?.name || 'Local file'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                        {doc.file?.fileSize && ` • ${(doc.file.fileSize / 1024).toFixed(2)} KB`}
                      </p>
                      {doc.reviewNotes && (
                        <div className="mt-2 text-xs bg-gray-100 p-2 rounded">
                          <span className="font-semibold">Review Notes:</span> {doc.reviewNotes}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {doc.file?.url && (
                      <a
                        href={doc.file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Eye size={18} />
                      </a>
                    )}
                    {!readOnly && (
                      <button
                        onClick={() => handleDeleteDocument(doc._id || doc.tempId)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete document"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentUpload;