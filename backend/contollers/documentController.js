import Employee from "../models/HRModals/Employee.model.js";
import FinalizedEmployee from "../models/HRModals/FinalizedEmployees.model.js";
import { uploadFileToCloudinary, destroyImageFromCloudinary } from "../utilis/cloudinary.js";
import AuditService from "../services/auditService.js";
import CONSTANTS from "../configs/constants.js";

/**
 * Upload document for employee (draft or finalized)
 */
export const uploadEmployeeDocument = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { documentType, customDocumentName, isFinal } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    // Validate document type
    const validTypes = [
      "CV/Resume", "Educational Certificates", "Experience Letters",
      "CNIC/Passport Copy", "Police Verification", "Medical Certificate",
      "Reference Letters", "Bank Account Details", "Other"
    ];
    
    if (!validTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document type"
      });
    }

    // Upload to Cloudinary
    const uploadResult = await uploadFileToCloudinary(req.file, "employee-documents");

    // Determine which model to use
    const EmployeeModel = isFinal === "true" ? FinalizedEmployee : Employee;
    const employee = await EmployeeModel.findById(employeeId);

    if (!employee) {
      await destroyImageFromCloudinary(uploadResult.public_id);
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    // Create document object
    const newDocument = {
      documentType,
      customDocumentName: documentType === "Other" ? customDocumentName : undefined,
      file: {
        public_id: uploadResult.public_id,
        url: uploadResult.secure_url,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      },
      uploadedAt: new Date(),
      status: "Pending"
    };

    // Add document to array
    if (!employee.documents) {
      employee.documents = [];
    }
    employee.documents.push(newDocument);

    // Update completion status
    const requiredDocs = ["CV/Resume", "CNIC/Passport Copy", "Educational Certificates"];
    const uploadedTypes = employee.documents.map(d => d.documentType);
    const hasAllRequired = requiredDocs.every(type => uploadedTypes.includes(type));
    
    employee.documentCompletionStatus = hasAllRequired ? "Complete" : "Incomplete";

    await employee.save();

    // Audit log
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.DOCUMENT_UPLOADED,
      actorId: req.user._id,
      targetId: employee._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        documentType,
        fileName: req.file.originalname,
        employeeName: employee.individualName
      }
    });

    res.status(200).json({
      success: true,
      message: "Document uploaded successfully",
      data: {
        document: newDocument,
        completionStatus: employee.documentCompletionStatus
      }
    });

  } catch (err) {
    console.error("❌ uploadEmployeeDocument error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to upload document",
      error: err.message
    });
  }
};

/**
 * Get all documents for an employee
 */
export const getEmployeeDocuments = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { isFinal } = req.query;

    const EmployeeModel = isFinal === "true" ? FinalizedEmployee : Employee;
    const employee = await EmployeeModel.findById(employeeId)
      .select('documents documentCompletionStatus individualName')
      .populate('documents.reviewedBy', 'individualName personalEmail');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        employeeName: employee.individualName,
        documents: employee.documents || [],
        completionStatus: employee.documentCompletionStatus
      }
    });

  } catch (err) {
    console.error("❌ getEmployeeDocuments error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch documents",
      error: err.message
    });
  }
};

/**
 * Review/Approve/Reject a document
 */
export const reviewDocument = async (req, res) => {
  try {
    const { employeeId, documentId } = req.params;
    const { status, reviewNotes, isFinal } = req.body;

    if (!["Approved", "Rejected", "Needs Revision"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    const EmployeeModel = isFinal === "true" ? FinalizedEmployee : Employee;
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

    // Update document review status
    document.status = status;
    document.reviewNotes = reviewNotes || "";
    document.reviewedBy = req.user._id;
    document.reviewedAt = new Date();

    // Update overall document status
    const allApproved = employee.documents.every(d => d.status === "Approved");
    const anyRejected = employee.documents.some(d => d.status === "Rejected");
    
    if (allApproved) {
      employee.documentCompletionStatus = "Approved";
    } else if (anyRejected) {
      employee.documentCompletionStatus = "Under Review";
    } else {
      employee.documentCompletionStatus = "Under Review";
    }

    await employee.save();

    // Audit log
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.DOCUMENT_REVIEWED,
      actorId: req.user._id,
      targetId: employee._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        documentType: document.documentType,
        reviewStatus: status,
        employeeName: employee.individualName
      }
    });

    res.status(200).json({
      success: true,
      message: "Document reviewed successfully",
      data: {
        document,
        completionStatus: employee.documentCompletionStatus
      }
    });

  } catch (err) {
    console.error("❌ reviewDocument error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to review document",
      error: err.message
    });
  }
};

/**
 * Delete a document
 */
export const deleteEmployeeDocument = async (req, res) => {
  try {
    const { employeeId, documentId } = req.params;
    const { isFinal } = req.query;

    const EmployeeModel = isFinal === "true" ? FinalizedEmployee : Employee;
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

    // Delete from Cloudinary
    await destroyImageFromCloudinary(document.file.public_id);

    // Remove from array
    employee.documents.pull(documentId);

    // Update completion status
    const requiredDocs = ["CV/Resume", "CNIC/Passport Copy", "Educational Certificates"];
    const uploadedTypes = employee.documents.map(d => d.documentType);
    const hasAllRequired = requiredDocs.every(type => uploadedTypes.includes(type));
    
    employee.documentCompletionStatus = hasAllRequired ? "Complete" : "Incomplete";

    await employee.save();

    // Audit log
    await AuditService.log({
      eventType: CONSTANTS.AUDIT_EVENTS.DOCUMENT_DELETED,
      actorId: req.user._id,
      targetId: employee._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        documentType: document.documentType,
        employeeName: employee.individualName
      }
    });

    res.status(200).json({
      success: true,
      message: "Document deleted successfully",
      data: {
        completionStatus: employee.documentCompletionStatus
      }
    });

  } catch (err) {
    console.error("❌ deleteEmployeeDocument error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete document",
      error: err.message
    });
  }
};

/**
 * Get document configuration (editable document types)
 */
export const getDocumentConfiguration = async (req, res) => {
  try {
    // This could be stored in a database for full dynamic configuration
    // For now, returning the enum values
    const configuration = {
      documentTypes: [
        { value: "CV/Resume", label: "CV/Resume", required: true },
        { value: "Educational Certificates", label: "Educational Certificates", required: true },
        { value: "Experience Letters", label: "Experience Letters", required: false },
        { value: "CNIC/Passport Copy", label: "CNIC/Passport Copy", required: true },
        { value: "Police Verification", label: "Police Verification", required: false },
        { value: "Medical Certificate", label: "Medical Certificate", required: false },
        { value: "Reference Letters", label: "Reference Letters", required: false },
        { value: "Bank Account Details", label: "Bank Account Details", required: false },
        { value: "Other", label: "Other", required: false }
      ],
      allowedFileTypes: [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ],
      maxFileSize: 5242880 // 5MB in bytes
    };

    res.status(200).json({
      success: true,
      data: configuration
    });

  } catch (err) {
    console.error("❌ getDocumentConfiguration error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch configuration",
      error: err.message
    });
  }
};