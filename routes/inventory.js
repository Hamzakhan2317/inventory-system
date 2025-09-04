import { Router } from "express";
import {
  // User Management APIs
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  toggleUserStatus,
  deleteUser,
  getUserActivity,
  
  // Sales Recording APIs
  getAllSales,
  
  // Reporting APIs
  getSalesReport,
  getUserPerformanceReport,
  getInventoryReport,
  getAuditTrail,
  exportReport
} from "../controllers/inventory.js";

import {
  requireSuperAdmin,
  requireUserManagement,
  requireProductManagement,
  requireReportAccess,
  requireSalesAccess,
  requireOwnershipOrAdmin,
  catchAsync
} from "../middlewares/index.js";

const router = Router();

// ============================================================================
// USER MANAGEMENT ROUTES (Super Admin Only)
// ============================================================================

// Create a new user
router.post("/users", requireUserManagement, catchAsync(createUser));

// Get all users with filtering and pagination
router.get("/users", requireUserManagement, catchAsync(getAllUsers));

// Get user by ID
router.get("/users/:id", requireOwnershipOrAdmin, catchAsync(getUserById));

// Update user
router.put("/users/:id", requireUserManagement, catchAsync(updateUser));

// Activate/Deactivate user
router.patch("/users/:id/status", requireUserManagement, catchAsync(toggleUserStatus));

// Delete user
router.delete("/users/:id", requireUserManagement, catchAsync(deleteUser));

// Get user activity/sales history
router.get("/users/:id/activity", requireOwnershipOrAdmin, catchAsync(getUserActivity));

// ============================================================================
// SALES RECORDING ROUTES
// ============================================================================

// Create a new sale
// Legacy sales routes (kept for admin/super admin backward compatibility)
// Note: Normal users should use /api/sales endpoints for sales recording

// Get all sales with filtering and pagination (Admin/Super Admin can see all, Normal users see only their own)
router.get("/sales", requireSalesAccess, catchAsync(getAllSales));

// ============================================================================
// REPORTING AND ANALYTICS ROUTES (Admin Access Required)
// ============================================================================

// Get comprehensive sales reports
router.get("/reports/sales", requireReportAccess, catchAsync(getSalesReport));

// Get user performance report
router.get("/reports/users", requireReportAccess, catchAsync(getUserPerformanceReport));

// Get product performance report
// Product performance report moved to /api/products/reports/performance

// Get inventory status report
router.get("/reports/inventory", requireReportAccess, catchAsync(getInventoryReport));

// Get audit trail
router.get("/reports/audit", requireReportAccess, catchAsync(getAuditTrail));

// Export reports in different formats
router.get("/reports/export", requireReportAccess, catchAsync(exportReport));

// ============================================================================
// DASHBOARD ROUTES
// ============================================================================

// Dashboard summary for different user roles
router.get("/dashboard", catchAsync(async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user._id;
    
    if (userRole === 'normal_user') {
      // Normal user dashboard - only their sales data
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const { Sales, Product } = await import("../models/index.js");
      
      // Get user's sales for today
      const todaySales = await Sales.countDocuments({
        salesPerson: userId,
        saleDate: { $gte: today, $lt: tomorrow },
        status: 'active'
      });
      
      const todayRevenue = await Sales.aggregate([
        {
          $match: {
            salesPerson: userId,
            saleDate: { $gte: today, $lt: tomorrow },
            status: 'active'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$finalAmount' }
          }
        }
      ]);
      
      // Get recent sales
      const recentSales = await Sales.find({
        salesPerson: userId
      })
        .populate('product', 'name productId')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('saleId quantity finalAmount saleDate customer.name product');
      
      // Get available products count
      const availableProducts = await Product.countDocuments({ isActive: true });
      
      return res.status(200).json({
        success: true,
        data: {
          userRole,
          stats: {
            todaySales,
            todayRevenue: todayRevenue[0]?.total || 0,
            availableProducts,
            recentSales
          }
        }
      });
    } else {
      // Admin dashboard - comprehensive overview
      const { Sales, Product, User } = await import("../models/index.js");
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Get overall stats
      const [
        totalProducts,
        activeProducts,
        lowStockProducts,
        totalUsers,
        activeUsers,
        todaySales,
        todayRevenue,
        totalRevenue
      ] = await Promise.all([
        Product.countDocuments(),
        Product.countDocuments({ isActive: true }),
        Product.countDocuments({
          $expr: { $lte: ['$stock', '$lowStockThreshold'] }
        }),
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        Sales.countDocuments({
          saleDate: { $gte: today, $lt: tomorrow },
          status: 'active'
        }),
        Sales.aggregate([
          {
            $match: {
              saleDate: { $gte: today, $lt: tomorrow },
              status: 'active'
            }
          },
          { $group: { _id: null, total: { $sum: '$finalAmount' } } }
        ]),
        Sales.aggregate([
          { $match: { status: 'active' } },
          { $group: { _id: null, total: { $sum: '$finalAmount' } } }
        ])
      ]);
      
      // Get top performing users (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const topUsers = await Sales.aggregate([
        {
          $match: {
            saleDate: { $gte: thirtyDaysAgo },
            status: 'active'
          }
        },
        {
          $group: {
            _id: '$salesPerson',
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: '$finalAmount' }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $project: {
            userName: '$user.name',
            totalSales: 1,
            totalRevenue: 1
          }
        }
      ]);
      
      return res.status(200).json({
        success: true,
        data: {
          userRole,
          stats: {
            products: {
              total: totalProducts,
              active: activeProducts,
              lowStock: lowStockProducts
            },
            users: {
              total: totalUsers,
              active: activeUsers
            },
            sales: {
              today: todaySales,
              todayRevenue: todayRevenue[0]?.total || 0,
              totalRevenue: totalRevenue[0]?.total || 0
            },
            topUsers
          }
        }
      });
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data",
      error: error.message
    });
  }
}));

// Health check route
router.get("/health", catchAsync((req, res) => {
  res.status(200).json({
    success: true,
    message: "Inventory Management System API is running",
    timestamp: new Date().toISOString()
  });
}));

export default router;
