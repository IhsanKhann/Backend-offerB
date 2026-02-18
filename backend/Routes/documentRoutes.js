// routes/documentRoutes.js
import express from "express";
import {
  uploadEmployeeDocument,
  getEmployeeDocuments,
  reviewDocument,
  deleteEmployeeDocument,
  getDocumentConfiguration
} from "../contollers/documentController.js";
import upload from "../middlewares/mutlerMiddleware.js";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// Get document configuration
router.get("/configuration",  
    getDocumentConfiguration
);

// Upload document
router.post(
  "/employees/:employeeId/documents",
  upload.single("document"),
  uploadEmployeeDocument
);

// Get employee documents
router.get(
  "/employees/:employeeId/documents",
  getEmployeeDocuments
);

// Review document
router.patch(
  "/employees/:employeeId/documents/:documentId/review",
  reviewDocument
);

// Delete document
router.delete(
  "/employees/:employeeId/documents/:documentId",
  deleteEmployeeDocument
);

export default router;