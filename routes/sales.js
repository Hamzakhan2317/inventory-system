import { Router } from "express";
import {
  createSalesRecord,
  getMySalesRecords,
  getSalesRecordById,
  updateSalesRecord,
  getSalesDashboard,
  getProductsForSale,
  getRecentSalesHistory
} from "../controllers/sales.js";

import {
  catchAsync
} from "../middlewares/index.js";

const router = Router();

// ============================================================================
// SALES RECORDING ROUTES FOR NORMAL USERS
// ============================================================================

// Get sales dashboard for current user
router.get(
  "/dashboard",
  catchAsync(getSalesDashboard)
);

// Get recent sales history with user and product details
router.get(
  "/history",
  catchAsync(getRecentSalesHistory)
);

// Get available products for sales (quick access)
router.get(
  "/products",
  catchAsync(getProductsForSale)
);

// Create a new sales record
router.post(
  "/",
  catchAsync(createSalesRecord)
);

// Get current user's sales records
router.get(
  "/",
  catchAsync(getMySalesRecords)
);

// Get specific sales record by ID (user's own only)
router.get(
  "/:id",
  catchAsync(getSalesRecordById)
);

// Update sales record (limited fields for normal users)
router.put(
  "/:id",
  catchAsync(updateSalesRecord)
);

export default router;
