# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## HR Module Enhancement - Complete Onboarding & Permission Management System

---

## 📋 DOCUMENT METADATA

**Project:** HR Management System - Phase 2 Enhancements
**Version:** 2.0
**Date:** February 8, 2026
**Status:** Ready for Implementation
**Author:** Product Team
**Stakeholders:** HR Department, IT Department, Compliance Team

---

## 🎯 EXECUTIVE SUMMARY

This PRD outlines four critical enhancements to the existing HR Management System:

1. **Document Management System** - Complete employee onboarding with document collection and approval workflow
2. **Branch Management Integration** - Full CRUD operations for branches with organizational hierarchy integration
3. **Dashboard UI/UX Improvements** - Enhanced sidebar navigation and proper spacing for organizational trees
4. **Permission Management Interface** - Complete UI for managing roles, permissions, and visualizing hierarchical authority

**Business Impact:**
- Digitizes paper-based onboarding process
- Reduces onboarding time by 60%
- Improves compliance tracking
- Provides clear visibility into organizational permissions
- Enhances administrative efficiency

**Technical Impact:**
- Extends existing Multer/Cloudinary integration
- Completes Branch module integration
- Improves dashboard UX consistency
- Provides comprehensive permission management tools

---

## 🔍 CURRENT ISSUE ANALYSIS

### Issue: "Selected position does not belong to the specific branch"

**Root Cause Analysis:**

```javascript
// Current validation in AssignEmployeePost
if (branchId && targetOrgUnit.branchId && 
    targetOrgUnit.branchId.toString() !== branchId) {
  return res.status(400).json({ 
    success: false, 
    message: "Selected position does not belong to the selected branch" 
  });
}
```

**Why This Happens:**

1. **OrgUnit-Branch Mismatch**: The selected organizational unit (position) has a `branchId` field that doesn't match the branch you're trying to assign
2. **Data Integrity Check**: This is a CORRECT validation - it prevents assigning an employee to a branch they don't work in
3. **Missing Branch Assignment**: OrgUnits may not have branches properly assigned during setup

**Three Solutions:**

**Option A: Allow Null Branch Assignment** (Recommended for HQ/Remote positions)
```javascript
// Only validate if orgUnit actually has a branch requirement
if (branchId && targetOrgUnit.branchId && 
    targetOrgUnit.branchId.toString() !== branchId) {
  // Error
}
// If targetOrgUnit.branchId is null, any branch is OK
```

**Option B: Auto-Assign Branch to OrgUnit**
```javascript
// If orgUnit has no branch, assign the selected branch
if (branchId && !targetOrgUnit.branchId) {
  targetOrgUnit.branchId = branchId;
  await targetOrgUnit.save();
}
```

**Option C: Make Branch Optional**
```javascript
// Don't validate branch at all - just store it
// Useful if positions can span multiple branches
```

**Recommended Fix:** Implement Option A + enhance UI to show branch requirement

---

## 📦 FEATURE 1: DOCUMENT MANAGEMENT SYSTEM

### Overview
Complete employee onboarding workflow with document collection, review, and approval capabilities.

### User Stories

**As an HR Manager, I want to:**
- Collect required documents from new employees during registration
- Review submitted documents before approval
- Request document corrections with comments
- Approve/reject individual documents
- Track document submission status

**As an Employee, I want to:**
- See which documents are required
- Upload multiple document types
- See upload status and feedback
- Resubmit rejected documents

### Functional Requirements

#### 1.1 Document Configuration

**Requirements:**
- System should support configurable document types
- Admin can add/edit/remove required document categories
- Each document type has: name, description, required/optional flag, file type restrictions

**Document Types (Default):**
```javascript
const DEFAULT_DOCUMENT_TYPES = [
  {
    id: "cv",
    name: "Curriculum Vitae (CV)",
    description: "Updated CV or Resume",
    required: true,
    acceptedFormats: [".pdf", ".doc", ".docx"],
    maxSize: "5MB"
  },
  {
    id: "cnic_front",
    name: "CNIC Front",
    description: "Front side of national ID card",
    required: true,
    acceptedFormats: [".pdf", ".jpg", ".png"],
    maxSize: "2MB"
  },
  {
    id: "cnic_back",
    name: "CNIC Back",
    description: "Back side of national ID card",
    required: true,
    acceptedFormats: [".pdf", ".jpg", ".png"],
    maxSize: "2MB"
  },
  {
    id: "education_certificates",
    name: "Education Certificates",
    description: "Degrees and certifications",
    required: true,
    acceptedFormats: [".pdf"],
    maxSize: "10MB",
    allowMultiple: true
  },
  {
    id: "experience_letters",
    name: "Experience Letters",
    description: "Previous employment letters",
    required: false,
    acceptedFormats: [".pdf"],
    maxSize: "5MB",
    allowMultiple: true
  },
  {
    id: "passport",
    name: "Passport",
    description: "Valid passport copy",
    required: false,
    acceptedFormats: [".pdf", ".jpg", ".png"],
    maxSize: "2MB"
  },
  {
    id: "bank_statement",
    name: "Bank Statement",
    description: "Recent bank account statement",
    required: false,
    acceptedFormats: [".pdf"],
    maxSize: "5MB"
  }
];
```

#### 1.2 Database Schema Updates

**Employee Model Extension:**
```javascript
// Add to Employee.model.js and FinalizedEmployees.model.js

const DocumentSubmissionSchema = new mongoose.Schema({
  documentType: {
    type: String,
    required: true,
    // References document type ID (cv, cnic_front, etc.)
  },
  files: [{
    url: { type: String, required: true },
    public_id: { type: String, required: true },
    filename: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    size: { type: Number }, // in bytes
    mimetype: { type: String }
  }],
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected", "Resubmission Required"],
    default: "Pending"
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "FinalizedEmployee",
    default: null
  },
  reviewedAt: { type: Date },
  reviewComments: { type: String },
  submittedAt: { type: Date, default: Date.now }
}, { _id: true });

// Add to employee schema
const employeeSchema = new mongoose.Schema({
  // ... existing fields ...
  
  documents: {
    type: [DocumentSubmissionSchema],
    default: []
  },
  
  documentReviewStatus: {
    type: String,
    enum: ["Incomplete", "Under Review", "Approved", "Revisions Required"],
    default: "Incomplete"
  }
});
```

**Document Configuration Model (NEW):**
```javascript
// models/HRModals/DocumentConfiguration.model.js

const DocumentTypeSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  required: {
    type: Boolean,
    default: false
  },
  acceptedFormats: {
    type: [String],
    default: [".pdf"]
  },
  maxSize: {
    type: String,
    default: "5MB"
  },
  maxSizeBytes: {
    type: Number,
    default: 5242880 // 5MB
  },
  allowMultiple: {
    type: Boolean,
    default: false
  },
  category: {
    type: String,
    enum: ["Identity", "Education", "Experience", "Financial", "Other"],
    default: "Other"
  },
  isActive: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

export const DocumentConfigurationModel = mongoose.model(
  "DocumentConfiguration", 
  DocumentTypeSchema
);
```

#### 1.3 Frontend Implementation

**Registration Form - New Step:**

```javascript
// Component: DocumentUploadStep.jsx

const DocumentUploadStep = ({ employeeId, onComplete, onBack }) => {
  const [documentTypes, setDocumentTypes] = useState([]);
  const [uploads, setUploads] = useState({});
  const [uploading, setUploading] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadDocumentTypes();
  }, []);

  const loadDocumentTypes = async () => {
    const res = await api.get('/documents/configuration');
    setDocumentTypes(res.data.documentTypes);
  };

  const handleFileSelect = async (documentTypeId, files) => {
    const config = documentTypes.find(d => d.id === documentTypeId);
    
    // Validate
    if (!config.allowMultiple && files.length > 1) {
      setErrors(prev => ({
        ...prev,
        [documentTypeId]: "Only one file allowed"
      }));
      return;
    }

    for (const file of files) {
      // Check file type
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!config.acceptedFormats.includes(ext)) {
        setErrors(prev => ({
          ...prev,
          [documentTypeId]: `Only ${config.acceptedFormats.join(', ')} allowed`
        }));
        return;
      }

      // Check file size
      if (file.size > config.maxSizeBytes) {
        setErrors(prev => ({
          ...prev,
          [documentTypeId]: `File too large. Max: ${config.maxSize}`
        }));
        return;
      }
    }

    // Upload
    await uploadFiles(documentTypeId, files);
  };

  const uploadFiles = async (documentTypeId, files) => {
    setUploading(prev => ({ ...prev, [documentTypeId]: true }));
    setErrors(prev => ({ ...prev, [documentTypeId]: null }));

    const formData = new FormData();
    formData.append('employeeId', employeeId);
    formData.append('documentType', documentTypeId);
    
    for (const file of files) {
      formData.append('documents', file);
    }

    try {
      const res = await api.post('/employees/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUploads(prev => ({
        ...prev,
        [documentTypeId]: res.data.documents
      }));
    } catch (err) {
      setErrors(prev => ({
        ...prev,
        [documentTypeId]: err.response?.data?.message || "Upload failed"
      }));
    } finally {
      setUploading(prev => ({ ...prev, [documentTypeId]: false }));
    }
  };

  const canProceed = () => {
    const requiredDocs = documentTypes.filter(d => d.required);
    return requiredDocs.every(doc => uploads[doc.id]?.length > 0);
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold">Document Submission</h2>
        <p className="text-gray-600">Upload required documents for verification</p>
      </div>

      {documentTypes.map(docType => (
        <DocumentUploadCard
          key={docType.id}
          config={docType}
          files={uploads[docType.id]}
          uploading={uploading[docType.id]}
          error={errors[docType.id]}
          onFileSelect={(files) => handleFileSelect(docType.id, files)}
        />
      ))}

      <div className="flex justify-between pt-6 border-t">
        <button
          onClick={onBack}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={onComplete}
          disabled={!canProceed()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          Submit for Review
        </button>
      </div>
    </div>
  );
};
```

**Document Review Dashboard:**

```javascript
// Component: DocumentReviewDashboard.jsx

const DocumentReviewDashboard = ({ employeeId }) => {
  const [employee, setEmployee] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [reviewComment, setReviewComment] = useState("");

  const handleApprove = async (documentId) => {
    await api.post('/employees/documents/review', {
      employeeId,
      documentId,
      action: 'approve'
    });
    refreshEmployee();
  };

  const handleReject = async (documentId) => {
    await api.post('/employees/documents/review', {
      employeeId,
      documentId,
      action: 'reject',
      comments: reviewComment
    });
    setReviewComment("");
    refreshEmployee();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Document List */}
      <div className="lg:col-span-1 space-y-4">
        {employee?.documents?.map(doc => (
          <DocumentCard
            key={doc._id}
            document={doc}
            selected={selectedDoc?._id === doc._id}
            onClick={() => setSelectedDoc(doc)}
          />
        ))}
      </div>

      {/* Document Viewer */}
      <div className="lg:col-span-2">
        {selectedDoc && (
          <DocumentViewer
            document={selectedDoc}
            onApprove={() => handleApprove(selectedDoc._id)}
            onReject={handleReject}
            reviewComment={reviewComment}
            setReviewComment={setReviewComment}
          />
        )}
      </div>
    </div>
  );
};
```

#### 1.4 Backend API Endpoints

**Document Upload Endpoint:**
```javascript
// POST /api/employees/documents/upload
export const uploadEmployeeDocuments = async (req, res) => {
  try {
    const { employeeId, documentType } = req.body;
    const files = req.files; // Multer array

    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: "Employee not found" 
      });
    }

    // Upload to Cloudinary
    const uploadedFiles = [];
    for (const file of files) {
      const result = await uploadFileToCloudinary(
        file, 
        `employees/${employeeId}/documents/${documentType}`
      );
      
      uploadedFiles.push({
        url: result.secure_url,
        public_id: result.public_id,
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      });
    }

    // Find or create document submission
    let docSubmission = employee.documents.find(
      d => d.documentType === documentType
    );

    if (docSubmission) {
      docSubmission.files.push(...uploadedFiles);
      docSubmission.submittedAt = new Date();
      docSubmission.status = "Pending";
    } else {
      employee.documents.push({
        documentType,
        files: uploadedFiles,
        status: "Pending"
      });
    }

    // Update overall status
    updateDocumentReviewStatus(employee);
    
    await employee.save();

    res.json({
      success: true,
      message: "Documents uploaded successfully",
      documents: uploadedFiles
    });

  } catch (error) {
    console.error("❌ Upload error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Upload failed" 
    });
  }
};

// Helper function
function updateDocumentReviewStatus(employee) {
  const allApproved = employee.documents.every(
    d => d.status === "Approved"
  );
  const anyRejected = employee.documents.some(
    d => d.status === "Rejected" || d.status === "Resubmission Required"
  );
  
  if (allApproved && employee.documents.length > 0) {
    employee.documentReviewStatus = "Approved";
  } else if (anyRejected) {
    employee.documentReviewStatus = "Revisions Required";
  } else {
    employee.documentReviewStatus = "Under Review";
  }
}
```

**Document Review Endpoint:**
```javascript
// POST /api/employees/documents/review
export const reviewEmployeeDocument = async (req, res) => {
  try {
    const actorId = req.user._id;
    const { employeeId, documentId, action, comments } = req.body;

    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: "Employee not found" 
      });
    }

    const document = employee.documents.id(documentId);
    if (!document) {
      return res.status(404).json({ 
        success: false, 
        message: "Document not found" 
      });
    }

    // Update document status
    if (action === 'approve') {
      document.status = "Approved";
    } else if (action === 'reject') {
      document.status = "Rejected";
    } else if (action === 'request_resubmission') {
      document.status = "Resubmission Required";
    }

    document.reviewedBy = actorId;
    document.reviewedAt = new Date();
    document.reviewComments = comments || "";

    // Update overall status
    updateDocumentReviewStatus(employee);

    await employee.save();

    // Audit log
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.DOCUMENT_REVIEWED,
      actorId,
      targetId: employeeId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        documentType: document.documentType,
        action,
        comments
      }
    });

    res.json({
      success: true,
      message: `Document ${action}ed successfully`,
      document
    });

  } catch (error) {
    console.error("❌ Review error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Review failed" 
    });
  }
};
```

### Success Criteria

- [ ] HR can configure document types via admin interface
- [ ] Registration form includes document upload step
- [ ] Documents upload to Cloudinary successfully
- [ ] Document metadata stored in MongoDB
- [ ] Draft dashboard shows document review interface
- [ ] HR can approve/reject individual documents
- [ ] HR can add comments to document reviews
- [ ] Employees can see document status
- [ ] Employees can resubmit rejected documents
- [ ] Overall document status calculated correctly
- [ ] Audit logs track all document actions

---

## 🏢 FEATURE 2: BRANCH MANAGEMENT INTEGRATION

### Overview
Complete CRUD operations for branches with full organizational hierarchy integration.

### User Stories

**As an Admin, I want to:**
- Create new branches with location details
- Edit existing branch information
- Deactivate branches
- Assign branches to organizational units
- View branch hierarchy
- See employees assigned to each branch

### Functional Requirements

#### 2.1 Branch CRUD Operations

**Create Branch:**
```javascript
// POST /api/branches
{
  "name": "Karachi Regional Office",
  "code": "KHI",
  "location": {
    "address": "Plot 123, Main Boulevard",
    "city": "Karachi",
    "state": "Sindh",
    "country": "Pakistan",
    "postalCode": "75500"
  },
  "branchType": "Regional",
  "manager": "employeeId", // optional
  "contactInfo": {
    "phone": "+92-21-1234567",
    "email": "karachi@company.com"
  },
  "openedDate": "2024-01-15"
}
```

**Update Branch:**
```javascript
// PUT /api/branches/:branchId
// Same payload as create
```

**Delete/Deactivate Branch:**
```javascript
// DELETE /api/branches/:branchId
// Sets isActive: false
// Checks for dependencies (employees, orgUnits)
```

**List Branches:**
```javascript
// GET /api/branches
// Response includes employee count, orgUnit count
```

#### 2.2 Branch-OrgUnit Integration

**Requirements:**
- OrgUnits can be assigned to branches
- Branch assignment is optional (for HQ positions)
- Employees inherit branch from their OrgUnit
- Can override employee branch if needed

**OrgUnit Branch Assignment:**
```javascript
// PUT /api/org-units/:orgUnitId/branch
{
  "branchId": "branchId or null"
}
```

**Branch View in Org Hierarchy:**
```javascript
// GET /api/org-units/tree
// Response includes branch info for each orgUnit
{
  "_id": "...",
  "name": "Sales Department",
  "branchId": {
    "_id": "...",
    "name": "Karachi Regional Office",
    "code": "KHI"
  },
  "children": [...]
}
```

#### 2.3 Frontend Components

**Branch Management Dashboard:**
```javascript
// Component: BranchManagementDashboard.jsx

const BranchManagementDashboard = () => {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Branch Management</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Add New Branch
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Branch List */}
        <div className="lg:col-span-1">
          <BranchList
            branches={branches}
            selectedBranch={selectedBranch}
            onSelect={setSelectedBranch}
          />
        </div>

        {/* Branch Details */}
        <div className="lg:col-span-2">
          {selectedBranch && (
            <BranchDetailView
              branch={selectedBranch}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      {showCreateModal && (
        <BranchFormModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreate}
        />
      )}
    </div>
  );
};
```

**Enhanced AssignRolesForm:**
```javascript
// Update to show branch requirement

const AssignRolesForm = ({ employeeId }) => {
  // ... existing code ...

  const selectedOrgUnit = findOrgUnitById(orgTree, form.orgUnitId);
  const orgUnitRequiresBranch = selectedOrgUnit?.branchId != null;
  const suggestedBranch = selectedOrgUnit?.branchId;

  return (
    <div>
      {/* ... existing fields ... */}

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">
          Work Branch / Location
          {orgUnitRequiresBranch && <span className="text-red-500 ml-1">*</span>}
        </label>
        
        {orgUnitRequiresBranch && (
          <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> This position requires assignment to{" "}
              <strong>{suggestedBranch.name}</strong> branch
            </p>
          </div>
        )}

        <select
          className="w-full border-2 rounded-xl px-4 py-3 bg-gray-50"
          value={form.branchId}
          onChange={(e) => setForm(prev => ({ ...prev, branchId: e.target.value }))}
        >
          <option value="">
            {orgUnitRequiresBranch ? "Select required branch" : "No specific branch (HQ/Remote)"}
          </option>
          {branches.map((branch) => (
            <option 
              key={branch._id} 
              value={branch._id}
              disabled={orgUnitRequiresBranch && branch._id !== suggestedBranch._id}
            >
              {branch.name} ({branch.code})
              {branch._id === suggestedBranch?._id && " - Required"}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
```

#### 2.4 Backend Implementation

**Branch Controller:**
```javascript
// controllers/branchController.js

export const createBranch = async (req, res) => {
  try {
    const actorId = req.user._id;
    const branchData = req.body;

    // Check for duplicate code
    const existingBranch = await BranchModel.findOne({ 
      code: branchData.code.toUpperCase() 
    });

    if (existingBranch) {
      return res.status(400).json({
        success: false,
        message: "Branch code already exists"
      });
    }

    const branch = await BranchModel.create({
      ...branchData,
      code: branchData.code.toUpperCase()
    });

    // Audit log
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.BRANCH_CREATED,
      actorId,
      targetId: branch._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        branchName: branch.name,
        branchCode: branch.code,
        branchType: branch.branchType
      }
    });

    res.status(201).json({
      success: true,
      message: "Branch created successfully",
      branch
    });

  } catch (error) {
    console.error("❌ Create branch error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create branch"
    });
  }
};

export const updateBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    const updates = req.body;
    const actorId = req.user._id;

    const branch = await BranchModel.findById(branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found"
      });
    }

    // Track changes
    const changes = {};
    ['name', 'location', 'branchType', 'manager', 'contactInfo'].forEach(field => {
      if (updates[field] && JSON.stringify(updates[field]) !== JSON.stringify(branch[field])) {
        changes[field] = {
          old: branch[field],
          new: updates[field]
        };
      }
    });

    Object.assign(branch, updates);
    await branch.save();

    // Audit log
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.BRANCH_UPDATED,
      actorId,
      targetId: branchId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        branchName: branch.name,
        changes
      }
    });

    res.json({
      success: true,
      message: "Branch updated successfully",
      branch
    });

  } catch (error) {
    console.error("❌ Update branch error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update branch"
    });
  }
};

export const deleteBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    const actorId = req.user._id;

    const branch = await BranchModel.findById(branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found"
      });
    }

    // Check dependencies
    const orgUnitCount = await OrgUnitModel.countDocuments({ branchId });
    const employeeCount = await RoleAssignmentModel.countDocuments({ 
      branchId, 
      isActive: true 
    });

    if (orgUnitCount > 0 || employeeCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete branch with ${orgUnitCount} org units and ${employeeCount} employees`,
        dependencies: { orgUnitCount, employeeCount }
      });
    }

    branch.isActive = false;
    branch.closedDate = new Date();
    await branch.save();

    // Audit log
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.BRANCH_DELETED,
      actorId,
      targetId: branchId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        branchName: branch.name,
        branchCode: branch.code
      }
    });

    res.json({
      success: true,
      message: "Branch deactivated successfully"
    });

  } catch (error) {
    console.error("❌ Delete branch error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete branch"
    });
  }
};

export const getAllBranches = async (req, res) => {
  try {
    const { includeInactive = false } = req.query;

    const filter = includeInactive ? {} : { isActive: true };
    
    const branches = await BranchModel.find(filter)
      .populate('manager', 'individualName personalEmail')
      .sort({ code: 1 })
      .lean();

    // Get counts
    const branchesWithCounts = await Promise.all(
      branches.map(async (branch) => {
        const orgUnitCount = await OrgUnitModel.countDocuments({ 
          branchId: branch._id, 
          isActive: true 
        });
        
        const employeeCount = await RoleAssignmentModel.countDocuments({ 
          branchId: branch._id, 
          isActive: true 
        });

        return {
          ...branch,
          orgUnitCount,
          employeeCount
        };
      })
    );

    res.json({
      success: true,
      branches: branchesWithCounts
    });

  } catch (error) {
    console.error("❌ Get branches error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch branches"
    });
  }
};
```

**Fix AssignEmployeePost Branch Validation:**
```javascript
// Updated validation in AssignEmployeePost

// ✅ ENHANCED: Branch validation with better logic
if (branchId) {
  const branch = await BranchModel.findById(branchId);
  if (!branch) {
    return res.status(404).json({ 
      success: false, 
      message: "Branch not found" 
    });
  }

  if (!branch.isActive) {
    return res.status(400).json({ 
      success: false, 
      message: "Selected branch is inactive" 
    });
  }
  
  // Only validate if orgUnit has a branch requirement
  // If orgUnit.branchId is null, employee can be assigned to any branch
  if (targetOrgUnit.branchId) {
    if (targetOrgUnit.branchId.toString() !== branchId) {
      return res.status(400).json({ 
        success: false, 
        message: `This position is assigned to ${targetOrgUnit.branchId.name} branch. Please select the correct branch or choose a different position.`,
        requiredBranch: {
          _id: targetOrgUnit.branchId._id,
          name: targetOrgUnit.branchId.name,
          code: targetOrgUnit.branchId.code
        }
      });
    }
  }
} else {
  // No branch selected
  if (targetOrgUnit.branchId) {
    // But orgUnit requires one
    return res.status(400).json({
      success: false,
      message: `This position requires assignment to a branch`,
      requiredBranch: {
        _id: targetOrgUnit.branchId._id,
        name: targetOrgUnit.branchId.name,
        code: targetOrgUnit.branchId.code
      }
    });
  }
}
```

### Success Criteria

- [ ] Can create new branches via UI
- [ ] Can edit branch details
- [ ] Can deactivate branches (with dependency check)
- [ ] Can view list of all branches with counts
- [ ] Can assign branches to org units
- [ ] Branch info shows in org hierarchy
- [ ] AssignRolesForm validates branch requirements
- [ ] Clear error messages when branch mismatch occurs
- [ ] Audit logs track all branch operations

---

## 🎨 FEATURE 3: DASHBOARD UI/UX IMPROVEMENTS

### Overview
Enhance dashboard navigation and layout for better usability and visual hierarchy.

### User Stories

**As a User, I want to:**
- Have consistent navigation across dashboards
- See relevant menu items for my role
- Have enough space to view organizational hierarchy
- Access features quickly from sidebar

### Functional Requirements

#### 3.1 Draft Dashboard Sidebar

**Requirements:**
- Add full sidebar to draft dashboard
- Remove mini org tree (specific to admin dashboard only)
- Include relevant navigation items
- Match styling with admin dashboard

**Draft Dashboard Navigation Items:**
```javascript
const DRAFT_DASHBOARD_NAV = [
  {
    section: "Employee Management",
    items: [
      { 
        label: "All Drafts", 
        icon: Users, 
        path: "/draft/employees",
        badge: { type: "count", source: "draftCount" }
      },
      { 
        label: "Register New", 
        icon: UserPlus, 
        path: "/draft/register" 
      },
      { 
        label: "Pending Submission", 
        icon: Clock, 
        path: "/draft/pending",
        badge: { type: "count", source: "pendingCount" }
      },
      { 
        label: "Document Review", 
        icon: FileText, 
        path: "/draft/documents",
        badge: { type: "count", source: "documentsNeedingReview" }
      }
    ]
  },
  {
    section: "Assignment",
    items: [
      { 
        label: "Assign Roles", 
        icon: Shield, 
        path: "/draft/assign-roles" 
      },
      { 
        label: "Unassigned Employees", 
        icon: AlertCircle, 
        path: "/draft/unassigned",
        badge: { type: "count", source: "unassignedCount" }
      }
    ]
  },
  {
    section: "Reports",
    items: [
      { 
        label: "Draft Statistics", 
        icon: BarChart, 
        path: "/draft/statistics" 
      },
      { 
        label: "Submission History", 
        icon: History, 
        path: "/draft/history" 
      }
    ]
  }
];
```

**Component Structure:**
```javascript
// Component: DraftDashboardLayout.jsx

const DraftDashboardLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    loadCounts();
  }, []);

  const loadCounts = async () => {
    const res = await api.get('/draft/counts');
    setCounts(res.data);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        navigation={DRAFT_DASHBOARD_NAV}
        counts={counts}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        width="280px" // Consistent width
      />

      {/* Main Content */}
      <main className={`flex-1 overflow-auto transition-all ${
        sidebarOpen ? 'ml-280' : 'ml-0'
      }`}>
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};
```

#### 3.2 Admin Dashboard Sidebar Enhancement

**Requirements:**
- Increase sidebar width from 256px to 320px
- Keep mini org tree feature (exclusive to admin)
- Improve spacing for hierarchy display
- Add collapse/expand for sections

**Enhanced Layout:**
```javascript
// Component: AdminDashboardLayout.jsx

const AdminDashboardLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [orgTreeExpanded, setOrgTreeExpanded] = useState(true);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Wider for org tree */}
      <aside className={`
        bg-white border-r border-gray-200 
        transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'w-80' : 'w-0'}
        overflow-hidden
      `}>
        {/* Navigation Menu */}
        <div className="h-1/2 border-b overflow-y-auto">
          <Navigation items={ADMIN_DASHBOARD_NAV} />
        </div>

        {/* Organization Tree - Admin Only */}
        <div className="h-1/2 overflow-y-auto">
          <div 
            className="p-4 border-b bg-gray-50 cursor-pointer flex justify-between items-center"
            onClick={() => setOrgTreeExpanded(!orgTreeExpanded)}
          >
            <h3 className="font-semibold text-sm text-gray-700">
              Organization Tree
            </h3>
            {orgTreeExpanded ? 
              <ChevronDown className="w-4 h-4" /> : 
              <ChevronRight className="w-4 h-4" />
            }
          </div>
          
          {orgTreeExpanded && (
            <div className="p-3">
              <MiniOrgTree />
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};
```

**Responsive Sidebar Component:**
```javascript
// Component: Sidebar.jsx

const Sidebar = ({ navigation, counts, isOpen, onToggle, width = "280px" }) => {
  const location = useLocation();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside 
        className={`
          hidden lg:block fixed left-0 top-0 h-screen
          bg-white border-r border-gray-200
          transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ width: isOpen ? width : '0' }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b">
          <h1 className="text-xl font-bold text-gray-800">HR System</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          {navigation.map((section, idx) => (
            <div key={idx} className="mb-6">
              <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {section.section}
              </h3>
              <div className="space-y-1">
                {section.items.map((item, itemIdx) => (
                  <NavItem
                    key={itemIdx}
                    item={item}
                    isActive={location.pathname === item.path}
                    badge={item.badge ? counts[item.badge.source] : null}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onToggle}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`
        lg:hidden fixed left-0 top-0 h-screen w-80
        bg-white z-50
        transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Same content as desktop */}
      </aside>
    </>
  );
};
```

### Success Criteria

- [ ] Draft dashboard has full sidebar
- [ ] Draft dashboard sidebar shows relevant menu items
- [ ] Admin dashboard sidebar is 320px wide
- [ ] Admin dashboard keeps mini org tree
- [ ] Org tree has adequate spacing
- [ ] Sidebars are responsive on mobile
- [ ] Sidebar state persists across page navigation
- [ ] Badge counts update in real-time

---

## 🔐 FEATURE 4: PERMISSION MANAGEMENT INTERFACE

### Overview
Complete UI for managing permissions, roles, and visualizing hierarchical authority.

### User Stories

**As an Admin, I want to:**
- View all permissions organized by category
- Create/edit/delete permissions
- Assign permissions to roles
- See which roles have which permissions
- Visualize employee authority scope
- See permission inheritance in org hierarchy

### Functional Requirements

#### 4.1 Permission Manager Dashboard

**Main Features:**
- Permission CRUD operations
- Permission categorization
- Bulk operations
- Search and filter

**Component Structure:**
```javascript
// Component: PermissionManagerDashboard.jsx

const PermissionManagerDashboard = () => {
  const [permissions, setPermissions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const categories = ["All", "HR", "Finance", "Business", "System", "Reports"];

  const filteredPermissions = selectedCategory === "All"
    ? permissions
    : permissions.filter(p => p.category === selectedCategory);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Permission Manager</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Create Permission
          </button>
          {selectedPermissions.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg"
            >
              Delete Selected ({selectedPermissions.length})
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 font-medium transition-colors ${
              selectedCategory === cat
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Permissions Table */}
      <PermissionsTable
        permissions={filteredPermissions}
        selectedPermissions={selectedPermissions}
        onSelectionChange={setSelectedPermissions}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <PermissionFormModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreate}
        />
      )}
    </div>
  );
};
```

**Permission Form:**
```javascript
// Component: PermissionFormModal.jsx

const PermissionFormModal = ({ permission, onClose, onSave }) => {
  const [form, setForm] = useState({
    name: permission?.name || "",
    action: permission?.action || "",
    description: permission?.description || "",
    statusScope: permission?.statusScope || ["ALL"],
    hierarchyScope: permission?.hierarchyScope || "SELF",
    resourceType: permission?.resourceType || "ALL",
    category: permission?.category || "System",
    actionType: permission?.actionType || "FUNCTIONAL"
  });

  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    
    if (!form.name) newErrors.name = "Name is required";
    if (!form.action) newErrors.action = "Action is required";
    if (form.statusScope.includes("ALL") && form.statusScope.length > 1) {
      newErrors.statusScope = "ALL cannot be combined with specific departments";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      await onSave(form);
      onClose();
    } catch (error) {
      setErrors({ submit: error.message });
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={permission ? "Edit Permission" : "Create Permission"}>
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Permission Name *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({...form, name: e.target.value})}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="e.g., view_employee_details"
          />
          {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
        </div>

        {/* Action */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Action *
          </label>
          <input
            type="text"
            value={form.action}
            onChange={(e) => setForm({...form, action: e.target.value})}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="e.g., VIEW_EMPLOYEE"
          />
          {errors.action && <p className="text-red-600 text-sm mt-1">{errors.action}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({...form, description: e.target.value})}
            className="w-full border rounded-lg px-3 py-2"
            rows={3}
            placeholder="Describe what this permission allows"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category *
          </label>
          <select
            value={form.category}
            onChange={(e) => setForm({...form, category: e.target.value})}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="HR">HR</option>
            <option value="Finance">Finance</option>
            <option value="Business">Business</option>
            <option value="System">System</option>
            <option value="Reports">Reports</option>
          </select>
        </div>

        {/* Action Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Action Type *
          </label>
          <select
            value={form.actionType}
            onChange={(e) => setForm({...form, actionType: e.target.value})}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="INFORMATIONAL">Informational (Read-only)</option>
            <option value="FUNCTIONAL">Functional (Requires department match)</option>
            <option value="ADMINISTRATIVE">Administrative (Requires hierarchy)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {form.actionType === "INFORMATIONAL" && "Can view data without modification"}
            {form.actionType === "FUNCTIONAL" && "Can perform actions within same department"}
            {form.actionType === "ADMINISTRATIVE" && "Can perform sensitive actions on subordinates"}
          </p>
        </div>

        {/* Hierarchy Scope */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hierarchy Scope *
          </label>
          <select
            value={form.hierarchyScope}
            onChange={(e) => setForm({...form, hierarchyScope: e.target.value})}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="SELF">Self Only</option>
            <option value="DESCENDANT">Subordinates (Descendants)</option>
            <option value="DEPARTMENT">Entire Department</option>
            <option value="ORGANIZATION">Entire Organization</option>
          </select>
        </div>

        {/* Status Scope (Departments) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Department Scope *
          </label>
          <div className="space-y-2">
            {["ALL", "HR", "Finance", "BusinessOperation", "IT", "Compliance"].map(dept => (
              <label key={dept} className="flex items-center">
                <input
                  type="checkbox"
                  checked={form.statusScope.includes(dept)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      if (dept === "ALL") {
                        setForm({...form, statusScope: ["ALL"]});
                      } else {
                        setForm({
                          ...form, 
                          statusScope: [...form.statusScope.filter(d => d !== "ALL"), dept]
                        });
                      }
                    } else {
                      setForm({
                        ...form,
                        statusScope: form.statusScope.filter(d => d !== dept)
                      });
                    }
                  }}
                  className="mr-2"
                  disabled={form.statusScope.includes("ALL") && dept !== "ALL"}
                />
                <span className="text-sm">{dept}</span>
              </label>
            ))}
          </div>
          {errors.statusScope && <p className="text-red-600 text-sm mt-1">{errors.statusScope}</p>}
        </div>

        {/* Resource Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Resource Type *
          </label>
          <select
            value={form.resourceType}
            onChange={(e) => setForm({...form, resourceType: e.target.value})}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="ALL">All Resources</option>
            <option value="EMPLOYEE">Employee</option>
            <option value="LEAVE">Leave</option>
            <option value="ROLE">Role</option>
            <option value="PERMISSION">Permission</option>
            <option value="NOTIFICATION">Notification</option>
            <option value="ORG_UNIT">Organization Unit</option>
            <option value="SALARY">Salary</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {permission ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
};
```

#### 4.2 Role-Permission Assignment

**Component:**
```javascript
// Component: RolePermissionManager.jsx

const RolePermissionManager = ({ roleId }) => {
  const [role, setRole] = useState(null);
  const [allPermissions, setAllPermissions] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadData();
  }, [roleId]);

  const loadData = async () => {
    const [roleRes, permsRes] = await Promise.all([
      api.get(`/roles/${roleId}`),
      api.get('/permissions/AllPermissions')
    ]);

    setRole(roleRes.data.role);
    setAllPermissions(permsRes.data.data);
    setSelectedPermissions(roleRes.data.role.permissions.map(p => p._id));
  };

  const handleTogglePermission = async (permissionId) => {
    const isSelected = selectedPermissions.includes(permissionId);

    try {
      if (isSelected) {
        await api.post('/roles/remove-permission', {
          roleId,
          permissionId
        });
        setSelectedPermissions(prev => prev.filter(id => id !== permissionId));
      } else {
        await api.post('/roles/add-permission', {
          roleId,
          permissionId
        });
        setSelectedPermissions(prev => [...prev, permissionId]);
      }
    } catch (error) {
      alert(error.response?.data?.message || "Operation failed");
    }
  };

  const filteredPermissions = searchQuery
    ? allPermissions.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allPermissions;

  const groupedPermissions = filteredPermissions.reduce((acc, perm) => {
    const category = perm.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(perm);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{role?.roleName}</h2>
          <p className="text-gray-600">
            {selectedPermissions.length} of {allPermissions.length} permissions assigned
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search permissions..."
          className="w-full border rounded-lg pl-10 pr-4 py-2"
        />
        <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
      </div>

      {/* Permissions by Category */}
      <div className="space-y-6">
        {Object.entries(groupedPermissions).map(([category, perms]) => (
          <div key={category} className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b">
              <h3 className="font-semibold text-gray-800">{category}</h3>
              <p className="text-sm text-gray-600">
                {perms.filter(p => selectedPermissions.includes(p._id)).length} / {perms.length} selected
              </p>
            </div>
            <div className="divide-y">
              {perms.map(perm => (
                <PermissionRow
                  key={perm._id}
                  permission={perm}
                  isSelected={selectedPermissions.includes(perm._id)}
                  onToggle={() => handleTogglePermission(perm._id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PermissionRow = ({ permission, isSelected, onToggle }) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div>
          <p className="font-medium text-gray-900">{permission.name}</p>
          {permission.description && (
            <p className="text-sm text-gray-600">{permission.description}</p>
          )}
          <div className="flex gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
              {permission.hierarchyScope}
            </span>
            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
              {permission.actionType}
            </span>
            {permission.statusScope.map(dept => (
              <span key={dept} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                {dept}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
```

#### 4.3 Employee Authority Visualizer

**Component:**
```javascript
// Component: EmployeeAuthorityVisualizer.jsx

const EmployeeAuthorityVisualizer = ({ employeeId }) => {
  const [employeeData, setEmployeeData] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [subordinates, setSubordinates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmployeeAuthority();
  }, [employeeId]);

  const loadEmployeeAuthority = async () => {
    try {
      setLoading(true);

      const [empRes, permsRes, subsRes] = await Promise.all([
        api.get(`/finalized-employees/${employeeId}`),
        api.get(`/permissions/getPermissionsDetailed/${employeeId}`),
        api.get(`/hierarchy/subordinates/${employeeId}`)
      ]);

      setEmployeeData(empRes.data.data);
      setPermissions(permsRes.data.permissions);
      setSubordinates(subsRes.data.subordinates);
    } catch (error) {
      console.error("Failed to load authority data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Employee Summary */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl p-6">
        <div className="flex items-center gap-4">
          <img
            src={employeeData.avatar?.url || '/default-avatar.png'}
            alt={employeeData.individualName}
            className="w-20 h-20 rounded-full border-4 border-white"
          />
          <div>
            <h2 className="text-2xl font-bold">{employeeData.individualName}</h2>
            <p className="opacity-90">{employeeData.role?.roleName}</p>
            <p className="text-sm opacity-75">{employeeData.orgUnit?.name}</p>
          </div>
        </div>
      </div>

      {/* Authority Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Permissions"
          value={permissions?.total?.length || 0}
          icon={Shield}
          color="blue"
        />
        <StatCard
          title="Direct Reports"
          value={subordinates.length}
          icon={Users}
          color="green"
        />
        <StatCard
          title="Hierarchical Depth"
          value={employeeData.orgUnit?.level || 0}
          icon={BarChart}
          color="purple"
        />
      </div>

      {/* Permissions Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Type */}
        <div className="border rounded-xl p-6">
          <h3 className="font-bold text-lg mb-4">Permissions by Type</h3>
          <PermissionTypeChart permissions={permissions?.total || []} />
        </div>

        {/* By Scope */}
        <div className="border rounded-xl p-6">
          <h3 className="font-bold text-lg mb-4">Permissions by Scope</h3>
          <PermissionScopeChart permissions={permissions?.total || []} />
        </div>
      </div>

      {/* Subordinate Tree */}
      <div className="border rounded-xl p-6">
        <h3 className="font-bold text-lg mb-4">
          Reporting Structure ({subordinates.length} subordinates)
        </h3>
        <SubordinateTree subordinates={subordinates} />
      </div>

      {/* Detailed Permissions */}
      <div className="border rounded-xl p-6">
        <h3 className="font-bold text-lg mb-4">Detailed Permissions</h3>
        <PermissionsList
          direct={permissions?.direct || []}
          inherited={permissions?.inherited || []}
          overrides={permissions?.overrides || []}
        />
      </div>
    </div>
  );
};
```

### Success Criteria

- [ ] Can view all permissions in organized table
- [ ] Can create new permissions with all fields
- [ ] Can edit existing permissions
- [ ] Can delete permissions (with dependency check)
- [ ] Can search and filter permissions
- [ ] Can assign/remove permissions to/from roles
- [ ] Can see which roles have which permissions
- [ ] Can visualize employee authority scope
- [ ] Can see permission inheritance in org tree
- [ ] Can see subordinate count and structure
- [ ] Permission changes reflect immediately

---

## 🚀 IMPLEMENTATION PLAN

### Phase 1: Foundation (Week 1)
- [ ] Fix current branch validation error
- [ ] Update database schemas
- [ ] Create migration scripts

### Phase 2: Document Management (Week 2)
- [ ] Implement document configuration model
- [ ] Add document upload step to registration
- [ ] Create document review dashboard
- [ ] Test upload/review workflow

### Phase 3: Branch Management (Week 3)
- [ ] Create branch CRUD endpoints
- [ ] Build branch management UI
- [ ] Integrate branches with org hierarchy
- [ ] Update AssignRolesForm

### Phase 4: Dashboard UI (Week 4)
- [ ] Add sidebar to draft dashboard
- [ ] Enhance admin dashboard sidebar
- [ ] Implement responsive design
- [ ] Test on multiple screen sizes

### Phase 5: Permission Management (Week 5-6)
- [ ] Build permission manager UI
- [ ] Create role-permission assignment interface
- [ ] Develop employee authority visualizer
- [ ] Add permission search/filter
- [ ] Integrate with existing guards

### Phase 6: Testing & Polish (Week 7)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Bug fixes
- [ ] Documentation

---

## 📊 SUCCESS METRICS

### Technical Metrics
- [ ] All features pass automated tests
- [ ] Page load time < 2 seconds
- [ ] API response time < 500ms
- [ ] Zero critical bugs
- [ ] Code coverage > 80%

### User Experience Metrics
- [ ] Onboarding time reduced by 60%
- [ ] Document approval time < 24 hours
- [ ] User satisfaction score > 4/5
- [ ] Feature adoption rate > 80%

### Business Metrics
- [ ] 100% document collection compliance
- [ ] 50% reduction in permission errors
- [ ] 30% faster role assignment process

---

## 🔒 SECURITY CONSIDERATIONS

### Data Protection
- All file uploads validated for type and size
- Files stored securely in Cloudinary
- Access control on document viewing
- Audit logs for all sensitive operations

### Permission Security
- Cannot grant permissions you don't have
- Hierarchy enforced on all administrative actions
- Department scope validated
- Role changes audited

### Branch Security
- Cannot delete branches with dependencies
- Branch changes require admin permission
- Branch assignment validated against org unit

---

## 📝 ACCEPTANCE CRITERIA

### Feature 1: Documents
- [ ] Can configure document types
- [ ] Can upload multiple file types
- [ ] File size limits enforced
- [ ] Documents stored in Cloudinary
- [ ] Can review and approve/reject
- [ ] Can add review comments
- [ ] Status updates correctly
- [ ] Audit trail complete

### Feature 2: Branches
- [ ] Can create branches
- [ ] Can edit branch details
- [ ] Can deactivate branches
- [ ] Dependency check works
- [ ] Branch count accurate
- [ ] Integration with org units works
- [ ] Assignment validation correct

### Feature 3: Dashboard UI
- [ ] Draft dashboard has sidebar
- [ ] Admin sidebar is wider
- [ ] Org tree displays correctly
- [ ] Navigation works
- [ ] Responsive on mobile
- [ ] Badge counts accurate

### Feature 4: Permissions
- [ ] Can CRUD permissions
- [ ] Can assign to roles
- [ ] Authority visualizer works
- [ ] Search/filter works
- [ ] Permission inheritance shown
- [ ] Guards enforce permissions

---

End of PRD