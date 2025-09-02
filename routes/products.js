import { Router } from "express";
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  updateProductStock,
  toggleProductStatus,
  deleteProduct,
  getProductFilters,
  getAvailableProducts,
  getProductPerformanceReport
} from "../controllers/products.js";

import {
  authenticate,
  requireProductManagement,
  requireReportAccess,
  catchAsync
} from "../middlewares/index.js";

const router = Router();

// ============================================================================
// PRODUCT MANAGEMENT ROUTES
// ============================================================================

// Create a new product (Admin/Super Admin only)
router.post("/", 
  authenticate, 
  requireProductManagement, 
  catchAsync(createProduct)
);

// Get all products with filtering and pagination (All authenticated users)
router.get("/", 
  authenticate, 
  catchAsync(getAllProducts)
);

// Get available products for normal users (active products only) - Must come before /:id
router.get("/available", 
  authenticate, 
  catchAsync(getAvailableProducts)
);

// Get product filters (All authenticated users)
router.get("/filters", 
  authenticate, 
  catchAsync(getProductFilters)
);

// Get product by ID (All authenticated users)
router.get("/:id", 
  authenticate, 
  catchAsync(getProductById)
);

// Update product (Admin/Super Admin only)
router.put("/:id", 
  authenticate, 
  requireProductManagement, 
  catchAsync(updateProduct)
);

// Update product stock (Admin/Super Admin only)
router.patch("/:id/stock", 
  authenticate, 
  requireProductManagement, 
  catchAsync(updateProductStock)
);

// Toggle product status (activate/deactivate) (Admin/Super Admin only)
router.patch("/:id/status", 
  authenticate, 
  requireProductManagement, 
  catchAsync(toggleProductStatus)
);

// Delete product (Admin/Super Admin only)
router.delete("/:id", 
  authenticate, 
  requireProductManagement, 
  catchAsync(deleteProduct)
);

// Get product performance report (Report access required)
router.get("/reports/performance", 
  authenticate, 
  requireReportAccess, 
  catchAsync(getProductPerformanceReport)
);

export default router;
