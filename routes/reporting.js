import { Router } from "express";
import {
  getOverallSalesReport,
  getUserSalesReport,
  getAllUsersSalesReport,
  exportOverallSalesReport,
  exportUserSalesReport
} from "../controllers/reporting.js";
import {
  requireSuperAdmin,
  catchAsync
} from "../middlewares/index.js";

const router = Router();

// ============================================================================
// OVERALL SALES REPORTING ROUTES (Super Admin Only)
// ============================================================================

// Get comprehensive overall sales report
router.get(
  "/sales/overall",
  requireSuperAdmin,
  catchAsync(getOverallSalesReport)
);

// Export overall sales report (Excel/PDF)
router.get(
  "/sales/overall/export",
  requireSuperAdmin,
  catchAsync(exportOverallSalesReport)
);

// ============================================================================
// USER SALES REPORTING ROUTES (Super Admin Only)
// ============================================================================

// Get all users' sales performance summary
router.get(
  "/sales/users",
  requireSuperAdmin,
  catchAsync(getAllUsersSalesReport)
);

// Get specific user's sales report
router.get(
  "/sales/users/:userId",
  requireSuperAdmin,
  catchAsync(getUserSalesReport)
);

// Export specific user's sales report (Excel/PDF)
router.get(
  "/sales/users/:userId/export",
  requireSuperAdmin,
  catchAsync(exportUserSalesReport)
);

export default router;
