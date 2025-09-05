import { User, Product, Sales } from "../models/index.js";
import mongoose from "mongoose";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import "jspdf-autotable";

// ============================================================================
// OVERALL SALES REPORTING APIs (Super Admin Only)
// ============================================================================

// Get comprehensive sales overview
export const getOverallSalesReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      page = 1,
      limit = 50,
      sortBy = 'saleDate',
      sortOrder = 'desc',
      search
    } = req.query;

    // Build filter
    const filter = { status: 'active' };
    
    // Date range filter
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }

    // Search filter
    if (search) {
      filter.$or = [
        // { saleId: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } },
        { transactionId: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get sales data with populated references
    const sales = await Sales.find(filter)
      .populate('product', 'name productId')
      .populate('salesPerson', 'name email role')
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Sales.countDocuments(filter);

    // Get summary statistics
    const summaryPipeline = [
      { $match: filter },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          totalQuantity: { $sum: '$quantity' },
          avgSaleAmount: { $avg: '$finalAmount' },
          maxSaleAmount: { $max: '$finalAmount' },
          minSaleAmount: { $min: '$finalAmount' },
          uniqueCustomers: { $addToSet: '$customer.email' },
          uniqueProducts: { $addToSet: '$product' },
          uniqueSalesPeople: { $addToSet: '$salesPerson' }
        }
      }
    ];

    const summaryResult = await Sales.aggregate(summaryPipeline);
    const summary = summaryResult[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalQuantity: 0,
      avgSaleAmount: 0,
      maxSaleAmount: 0,
      minSaleAmount: 0,
      uniqueCustomers: [],
      uniqueProducts: [],
      uniqueSalesPeople: []
    };

    // Get top performing metrics
    const topProducts = await Sales.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$product',
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: '$finalAmount' },
          salesCount: { $sum: 1 }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          productName: '$product.name',
          productId: '$product.productId',
          totalQuantity: 1,
          totalRevenue: 1,
          salesCount: 1
        }
      }
    ]);

    const topSalesPeople = await Sales.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$salesPerson',
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          totalQuantity: { $sum: '$quantity' }
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
          userEmail: '$user.email',
          userRole: '$user.role',
          totalSales: 1,
          totalRevenue: 1,
          totalQuantity: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        sales,
        summary: {
          ...summary,
          uniqueCustomersCount: summary.uniqueCustomers.length,
          uniqueProductsCount: summary.uniqueProducts.length,
          uniqueSalesPeopleCount: summary.uniqueSalesPeople.length
        },
        topPerformers: {
          products: topProducts,
          salesPeople: topSalesPeople
        },
        dateRange: {
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null
        },
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          count: total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error generating overall sales report:', error);
    res.status(500).json({
      success: false,
      message: "Failed to generate sales report",
      error: error.message
    });
  }
};

// ============================================================================
// USER SALES REPORTING APIs (Super Admin Only)
// ============================================================================

// Get sales report by specific user
export const getUserSalesReport = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'saleDate',
      sortOrder = 'desc'
    } = req.query;

    // Validate user exists
    const user = await User.findById(userId).select('name email role isActive');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Build filter
    const filter = { 
      salesPerson: mongoose.Types.ObjectId(userId),
      status: 'active'
    };
    
    // Date range filter
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get user's sales
    const sales = await Sales.find(filter)
      .populate('product', 'name productId price')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Sales.countDocuments(filter);

    // Get user performance metrics
    const userStats = await Sales.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          totalQuantity: { $sum: '$quantity' },
          avgSaleAmount: { $avg: '$finalAmount' },
          maxSaleAmount: { $max: '$finalAmount' },
          minSaleAmount: { $min: '$finalAmount' },
          uniqueCustomers: { $addToSet: '$customer.email' },
          uniqueProducts: { $addToSet: '$product' },
          firstSaleDate: { $min: '$saleDate' },
          lastSaleDate: { $max: '$saleDate' }
        }
      }
    ]);

    const stats = userStats[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalQuantity: 0,
      avgSaleAmount: 0,
      maxSaleAmount: 0,
      minSaleAmount: 0,
      uniqueCustomers: [],
      uniqueProducts: [],
      firstSaleDate: null,
      lastSaleDate: null
    };

    // Get monthly performance trend (last 12 months)
    const monthlyTrend = await Sales.aggregate([
      {
        $match: {
          salesPerson: mongoose.Types.ObjectId(userId),
          status: 'active',
          saleDate: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 12)) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$saleDate' },
            month: { $month: '$saleDate' }
          },
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get user's top-selling products
    const topProducts = await Sales.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$product',
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: '$finalAmount' },
          salesCount: { $sum: 1 }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          productName: '$product.name',
          productId: '$product.productId',
          totalQuantity: 1,
          totalRevenue: 1,
          salesCount: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        user: {
          ...user.toObject(),
          stats: {
            ...stats,
            uniqueCustomersCount: stats.uniqueCustomers.length,
            uniqueProductsCount: stats.uniqueProducts.length
          }
        },
        sales,
        performance: {
          monthlyTrend,
          topProducts
        },
        dateRange: {
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null
        },
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          count: total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error generating user sales report:', error);
    res.status(500).json({
      success: false,
      message: "Failed to generate user sales report",
      error: error.message
    });
  }
};

// Get all users' sales performance summary
export const getAllUsersSalesReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      limit = 50,
      sortBy = 'totalRevenue',
      sortOrder = 'desc',
      role
    } = req.query;

    // Build date filter
    const dateFilter = { status: 'active' };
    if (startDate || endDate) {
      dateFilter.saleDate = {};
      if (startDate) dateFilter.saleDate.$gte = new Date(startDate);
      if (endDate) dateFilter.saleDate.$lte = new Date(endDate);
    }

    let pipeline = [
      { $match: dateFilter },
      {
        $group: {
          _id: '$salesPerson',
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          totalQuantity: { $sum: '$quantity' },
          avgSaleAmount: { $avg: '$finalAmount' },
          uniqueCustomers: { $addToSet: '$customer.email' },
          firstSaleDate: { $min: '$saleDate' },
          lastSaleDate: { $max: '$saleDate' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' }
    ];

    // Add role filter if specified
    if (role) {
      pipeline.push({ $match: { 'user.role': role } });
    }

    pipeline.push(
      {
        $project: {
          userId: '$_id',
          userName: '$user.name',
          userEmail: '$user.email',
          userRole: '$user.role',
          isActive: '$user.isActive',
          totalSales: 1,
          totalRevenue: 1,
          totalQuantity: 1,
          avgSaleAmount: 1,
          uniqueCustomersCount: { $size: '$uniqueCustomers' },
          firstSaleDate: 1,
          lastSaleDate: 1,
          efficiency: {
            $divide: ['$totalRevenue', '$totalSales']
          }
        }
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
      { $limit: parseInt(limit) }
    );

    const usersPerformance = await Sales.aggregate(pipeline);

    // Get overall summary
    const overallSummary = await Sales.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          totalSalespeople: { $addToSet: '$salesPerson' },
          avgRevenuePerSale: { $avg: '$finalAmount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        usersPerformance,
        summary: overallSummary[0] || {
          totalSales: 0,
          totalRevenue: 0,
          totalSalespeople: [],
          avgRevenuePerSale: 0
        },
        dateRange: {
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null
        }
      }
    });

  } catch (error) {
    console.error('Error generating all users sales report:', error);
    res.status(500).json({
      success: false,
      message: "Failed to generate users sales report",
      error: error.message
    });
  }
};

// ============================================================================
// EXPORT FUNCTIONALITY (Excel/PDF)
// ============================================================================

// Export overall sales report
export const exportOverallSalesReport = async (req, res) => {
  try {
    const { format = 'excel', ...filterParams } = req.query;
    
    // Get sales data
    const filter = { status: 'active' };
    
    if (filterParams.startDate || filterParams.endDate) {
      filter.saleDate = {};
      if (filterParams.startDate) filter.saleDate.$gte = new Date(filterParams.startDate);
      if (filterParams.endDate) filter.saleDate.$lte = new Date(filterParams.endDate);
    }

    const salesData = await Sales.find(filter)
      .populate('product', 'name productId')
      .populate('salesPerson', 'name email')
      .sort({ saleDate: -1 })
      .limit(1000); // Limit for performance

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sales Report');

      // Define columns
      worksheet.columns = [
        { header: 'Sale ID', key: 'saleId', width: 15 },
        { header: 'Date', key: 'saleDate', width: 12 },
        { header: 'Product Name', key: 'productName', width: 20 },
        { header: 'Product ID', key: 'productId', width: 15 },
        { header: 'Quantity', key: 'quantity', width: 10 },
        { header: 'Unit Price', key: 'unitPrice', width: 12 },
        { header: 'Total Amount', key: 'totalAmount', width: 12 },
        { header: 'Discount', key: 'discount', width: 10 },
        { header: 'Final Amount', key: 'finalAmount', width: 12 },
        { header: 'Customer Name', key: 'customerName', width: 20 },
        { header: 'Customer Email', key: 'customerEmail', width: 25 },
        { header: 'Customer Phone', key: 'customerPhone', width: 15 },
        { header: 'Sales Person', key: 'salesPersonName', width: 20 },
        { header: 'Payment Method', key: 'paymentMethod', width: 15 },
        { header: 'Payment Status', key: 'paymentStatus', width: 15 }
      ];

      // Style header row
      worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
      });

      // Add data rows
      salesData.forEach((sale) => {
        worksheet.addRow({
          // saleId: sale.saleId,
          saleDate: sale.saleDate.toISOString().split('T')[0],
          productName: sale.product?.name || 'N/A',
          productId: sale.product?.productId || 'N/A',
          quantity: sale.quantity,
          unitPrice: sale.unitPrice,
          totalAmount: sale.totalAmount,
          discount: sale.discount,
          finalAmount: sale.finalAmount,
          customerName: sale.customer.name,
          customerEmail: sale.customer.email || 'N/A',
          customerPhone: sale.customer.phone || 'N/A',
          salesPersonName: sale.salesPerson?.name || 'N/A',
          paymentMethod: sale.paymentMethod,
          paymentStatus: sale.paymentStatus
        });
      });

      // Set response headers for Excel
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');
      
      // Write to response
      await workbook.xlsx.write(res);
      res.end();

    } else if (format === 'pdf') {
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(20);
      doc.text('Sales Report', 20, 20);
      
      // Add date range
      const startDate = filterParams.startDate ? new Date(filterParams.startDate).toLocaleDateString() : 'All time';
      const endDate = filterParams.endDate ? new Date(filterParams.endDate).toLocaleDateString() : 'Present';
      doc.setFontSize(12);
      doc.text(`Period: ${startDate} - ${endDate}`, 20, 30);
      
      // Prepare table data
      const tableData = salesData.map(sale => [
        // sale.saleId,
        sale.saleDate.toLocaleDateString(),
        sale.product?.name || 'N/A',
        sale.quantity,
        `$${sale.finalAmount.toFixed(2)}`,
        sale.customer.name,
        sale.salesPerson?.name || 'N/A'
      ]);

      // Add table
      doc.autoTable({
        head: [['Sale ID', 'Date', 'Product', 'Qty', 'Amount', 'Customer', 'Sales Person']],
        body: tableData,
        startY: 40,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 220, 220] }
      });

      // Set response headers for PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
      
      // Send PDF
      res.send(doc.output());

    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Use "excel" or "pdf"'
      });
    }

  } catch (error) {
    console.error('Error exporting sales report:', error);
    res.status(500).json({
      success: false,
      message: "Failed to export sales report",
      error: error.message
    });
  }
};

// Export user sales report
export const exportUserSalesReport = async (req, res) => {
  try {
    const { userId } = req.params;
    const { format = 'excel', ...filterParams } = req.query;
    
    // Validate user
    const user = await User.findById(userId).select('name email role');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get user's sales data
    const filter = { 
      salesPerson: mongoose.Types.ObjectId(userId),
      status: 'active'
    };
    
    if (filterParams.startDate || filterParams.endDate) {
      filter.saleDate = {};
      if (filterParams.startDate) filter.saleDate.$gte = new Date(filterParams.startDate);
      if (filterParams.endDate) filter.saleDate.$lte = new Date(filterParams.endDate);
    }

    const salesData = await Sales.find(filter)
      .populate('product', 'name productId')
      .sort({ saleDate: -1 });

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`${user.name} Sales Report`);

      // User info section
      worksheet.addRow(['Sales Report for:', user.name]);
      worksheet.addRow(['Email:', user.email]);
      worksheet.addRow(['Role:', user.role]);
      worksheet.addRow(['Report Date:', new Date().toLocaleDateString()]);
      worksheet.addRow([]); // Empty row

      // Define columns
      worksheet.addRow(['Sale ID', 'Date', 'Product Name', 'Product ID', 'Quantity', 'Unit Price', 'Final Amount', 'Customer Name', 'Payment Method']);
      
      // Style header row
      const headerRow = worksheet.lastRow;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
      });

      // Add data rows
      salesData.forEach((sale) => {
        worksheet.addRow([
          // sale.saleId,
          sale.saleDate.toISOString().split('T')[0],
          sale.product?.name || 'N/A',
          sale.product?.productId || 'N/A',
          sale.quantity,
          sale.unitPrice,
          sale.finalAmount,
          sale.customer.name,
          sale.paymentMethod
        ]);
      });

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${user.name.replace(/\s+/g, '_')}_sales_report.xlsx`);
      
      await workbook.xlsx.write(res);
      res.end();

    } else if (format === 'pdf') {
      const doc = new jsPDF();
      
      // Add title and user info
      doc.setFontSize(18);
      doc.text(`Sales Report - ${user.name}`, 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Email: ${user.email}`, 20, 30);
      doc.text(`Role: ${user.role}`, 20, 40);
      doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 20, 50);
      
      // Prepare table data
      const tableData = salesData.map(sale => [
        // sale.saleId,
        sale.saleDate.toLocaleDateString(),
        sale.product?.name || 'N/A',
        sale.quantity,
        `$${sale.finalAmount.toFixed(2)}`,
        sale.customer.name
      ]);

      // Add table
      doc.autoTable({
        head: [['Sale ID', 'Date', 'Product', 'Qty', 'Amount', 'Customer']],
        body: tableData,
        startY: 60,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [220, 220, 220] }
      });

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${user.name.replace(/\s+/g, '_')}_sales_report.pdf`);
      
      res.send(doc.output());

    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Use "excel" or "pdf"'
      });
    }

  } catch (error) {
    console.error('Error exporting user sales report:', error);
    res.status(500).json({
      success: false,
      message: "Failed to export user sales report",
      error: error.message
    });
  }
};
