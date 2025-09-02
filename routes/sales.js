import { Router } from "express";
import {
  createSalesRecord,
  getMySalesRecords,
  getSalesRecordById,
  updateSalesRecord,
  getSalesDashboard,
  getProductsForSale
} from "../controllers/sales.js";

import {
  authenticate,
  catchAsync
} from "../middlewares/index.js";

const router = Router();

// ============================================================================
// SALES RECORDING ROUTES FOR NORMAL USERS
// ============================================================================

// Get sales dashboard for current user
router.get(
  "/dashboard",
  authenticate,
  catchAsync(getSalesDashboard)
);

// Get available products for sales (quick access)
router.get(
  "/products",
  authenticate,
  catchAsync(getProductsForSale)
);

// Create a new sales record
router.post(
  "/",
  authenticate,
  catchAsync(createSalesRecord)
);

// Get current user's sales records
router.get(
  "/",
  authenticate,
  catchAsync(getMySalesRecords)
);

// Get specific sales record by ID (user's own only)
router.get(
  "/:id",
  authenticate,
  catchAsync(getSalesRecordById)
);

// Update sales record (limited fields for normal users)
router.put(
  "/:id",
  authenticate,
  catchAsync(updateSalesRecord)
);

export default router;
