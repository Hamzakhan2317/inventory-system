import { Router } from "express";
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  updateProductBasic,
  updateProductStock,
  toggleProductStatus,
  deleteProduct,
  removeProductImage,
  getProductFilters,
  getAvailableProducts,
  getProductPerformanceReport
} from "../controllers/products.js";

import {
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
  requireProductManagement, 
  catchAsync(createProduct)
);

// Get all products with filtering and pagination (All authenticated users)
router.get("/", 
  catchAsync(getAllProducts)
);

// Get available products for normal users (active products only) - Must come before /:id
router.get("/available", 
  catchAsync(getAvailableProducts)
);

// Get product filters (All authenticated users)
router.get("/filters", 
  catchAsync(getProductFilters)
);

// Get product by ID (All authenticated users)
router.get("/:id", 
  catchAsync(getProductById)
);

// Update product with file uploads (Admin/Super Admin only)
router.put("/:id", 
  requireProductManagement, 
  catchAsync(updateProduct)
);

// Update product basic fields only (Admin/Super Admin only)
router.patch("/:id/basic", 
  requireProductManagement, 
  catchAsync(updateProductBasic)
);

// Update product stock (Admin/Super Admin only)
router.patch("/:id/stock", 
  requireProductManagement, 
  catchAsync(updateProductStock)
);

// Toggle product status (activate/deactivate) (Admin/Super Admin only)
router.patch("/:id/status", 
  requireProductManagement, 
  catchAsync(toggleProductStatus)
);

// Remove product image (Admin/Super Admin only)
router.patch("/:id/remove-image", 
  requireProductManagement, 
  catchAsync(removeProductImage)
);

// Delete product (Admin/Super Admin only)
router.delete("/:id", 
  requireProductManagement, 
  catchAsync(deleteProduct)
);

// Get product performance report (Report access required)
router.get("/reports/performance", 
  requireReportAccess, 
  catchAsync(getProductPerformanceReport)
);

export default router;
