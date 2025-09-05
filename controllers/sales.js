import { User, Product, Sales } from "../models/index.js";
import mongoose from "mongoose";

// ============================================================================
// SALES RECORDING APIs FOR NORMAL USERS
// ============================================================================

// Create a new sales record
export const createSalesRecord = async (req, res) => {
  console.log("createSalesRecord>>>>>>>>>>>>>>>>>>>"); 
  try {
    const {
      productId,
      quantity,
      customer,
      saleDate,
      notes
    } = req.body;

    // Validate required fields
    if (!productId || !quantity || !customer?.name) {
      return res.status(400).json({
        success: false,
        message: "Product ID, quantity, and customer name are required"
      });
    }

    // Validate quantity
    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0"
      });
    }

    // Validate product exists and is active
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    if (!product.isActive) {
      return res.status(400).json({
        success: false,
        message: "Product is not available for sale"
      });
    }

    // Check stock availability
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`
      });
    }

    // Validate customer information
    if (!customer.name || customer.name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Customer name must be at least 2 characters long"
      });
    }

    // Create sale record with product snapshot
    const newSale = new Sales({
      product: product._id,
      productSnapshot: {
        name: product.name,
        productId: product.productId,
        price: product.price,
        image: product.image
      },
      quantity: parseInt(quantity),
      unitPrice: product.price,
      totalAmount: parseInt(quantity) * product.price,
      finalAmount: parseInt(quantity) * product.price,
      discount: 0, // Normal users can't apply discounts
      customer: {
        name: customer.name.trim(),
        email: customer.email?.toLowerCase()?.trim() || null,
        phone: customer.phone?.trim() || null,
        address: customer.address?.trim() || null
      },
      salesPerson: req.user._id,
      paymentMethod: 'cash', // Default for normal users
      paymentStatus: 'completed', // Assume completed for normal users
      transactionId: null,
      notes: notes?.trim() || null,
      saleDate: saleDate ? new Date(saleDate) : new Date(),
      createdBy: req.user._id
    });

    await newSale.save();

    // Update product stock
    product.stock -= parseInt(quantity);
    product.updatedBy = req.user._id;
    await product.save();

    // Populate the created sale for response
    const populatedSale = await Sales.findById(newSale._id)
      .populate('product', 'name productId price image')
      .populate('salesPerson', 'name email');

    res.status(201).json({
      success: true,
      message: "Sales record created successfully",
      data: {
        sale: populatedSale,
        productStockAfterSale: product.stock
      }
    });

  } catch (error) {
    console.error('Error creating sales record:', error);
    res.status(500).json({
      success: false,
      message: "Failed to create sales record",
      error: error.message
    });
  }
};

// Get user's sales records
export const getMySalesRecords = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      search,
      sortBy = 'saleDate',
      sortOrder = 'desc'
    } = req.query;

    // Build filter for current user's sales only
    const filter = { 
      salesPerson: req.user._id
    };

    // Date range filter
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }

    // Search filter
    if (search) {
      filter.$or = [
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } },
        { 'productSnapshot.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get user's sales records
    const sales = await Sales.find(filter)
      .populate('product', 'name productId price stock image')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Sales.countDocuments(filter);

    // Get user's sales statistics
    const stats = await Sales.aggregate([
      { $match: { salesPerson: req.user._id } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          totalQuantitySold: { $sum: '$quantity' },
          avgSaleAmount: { $avg: '$finalAmount' }
        }
      }
    ]);

    // Get today's sales
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStats = await Sales.aggregate([
      { 
        $match: { 
          salesPerson: req.user._id, 
          saleDate: { $gte: today, $lt: tomorrow }
        } 
      },
      {
        $group: {
          _id: null,
          todaySales: { $sum: 1 },
          todayRevenue: { $sum: '$finalAmount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        sales,
        statistics: {
          overall: stats[0] || {
            totalSales: 0,
            totalRevenue: 0,
            totalQuantitySold: 0,
            avgSaleAmount: 0
          },
          today: todayStats[0] || {
            todaySales: 0,
            todayRevenue: 0
          }
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
    console.error('Error fetching sales records:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales records",
      error: error.message
    });
  }
};

// Get a specific sales record by ID
export const getSalesRecordById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sales record ID"
      });
    }

    const sale = await Sales.findById(id)
      .populate('product', 'name productId price stock image')
      .populate('salesPerson', 'name email')
      .populate('createdBy', 'name email');

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sales record not found"
      });
    }

    // Check if the sale belongs to the current user
    if (sale.salesPerson._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied - you can only view your own sales records"
      });
    }

    res.status(200).json({
      success: true,
      data: sale
    });

  } catch (error) {
    console.error('Error fetching sales record:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales record",
      error: error.message
    });
  }
};

// Update a sales record (limited fields for normal users)
export const updateSalesRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { customer, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sales record ID"
      });
    }

    // Get the existing sale
    const existingSale = await Sales.findById(id);
    if (!existingSale) {
      return res.status(404).json({
        success: false,
        message: "Sales record not found"
      });
    }

    // Check if the sale belongs to the current user
    if (existingSale.salesPerson.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied - you can only update your own sales records"
      });
    }

    // Normal users can only update customer info and notes
    const updates = {};
    
    if (customer) {
      // Validate customer name if provided
      if (customer.name && customer.name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "Customer name must be at least 2 characters long"
        });
      }
      
      updates.customer = {
        name: customer.name?.trim() || existingSale.customer.name,
        email: customer.email?.toLowerCase()?.trim() || existingSale.customer.email,
        phone: customer.phone?.trim() || existingSale.customer.phone,
        address: customer.address?.trim() || existingSale.customer.address
      };
    }

    if (notes !== undefined) {
      updates.notes = notes?.trim() || null;
    }

    updates.updatedBy = req.user._id;

    // Update the sale
    const updatedSale = await Sales.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('product', 'name productId price image')
     .populate('salesPerson', 'name email');

    res.status(200).json({
      success: true,
      message: "Sales record updated successfully",
      data: updatedSale
    });

  } catch (error) {
    console.error('Error updating sales record:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update sales record",
      error: error.message
    });
  }
};

// Get sales dashboard for normal user
export const getSalesDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get various statistics
    const [
      todayStats,
      weekStats,
      monthStats,
      totalStats,
      recentSales,
      topProducts
    ] = await Promise.all([
      // Today's stats
      Sales.aggregate([
        { 
          $match: { 
            salesPerson: userId, 
            saleDate: { $gte: today, $lt: tomorrow }
          } 
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            revenue: { $sum: '$finalAmount' },
            quantity: { $sum: '$quantity' }
          }
        }
      ]),
      
      // This week's stats
      Sales.aggregate([
        { 
          $match: { 
            salesPerson: userId, 
            saleDate: { $gte: thisWeekStart, $lt: tomorrow }
          } 
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            revenue: { $sum: '$finalAmount' }
          }
        }
      ]),
      
      // This month's stats
      Sales.aggregate([
        { 
          $match: { 
            salesPerson: userId, 
            saleDate: { $gte: thisMonthStart, $lt: tomorrow }
          } 
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            revenue: { $sum: '$finalAmount' }
          }
        }
      ]),
      
      // Total stats
      Sales.aggregate([
        { $match: { salesPerson: userId } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            revenue: { $sum: '$finalAmount' },
            quantity: { $sum: '$quantity' }
          }
        }
      ]),
      
      // Recent sales (last 10)
      Sales.find({ salesPerson: userId })
        .populate('product', 'name productId image')
        .sort({ createdAt: -1 })
        .limit(10)
        .select('_id productSnapshot quantity finalAmount saleDate customer.name'),
      
      // Top products by user
      Sales.aggregate([
        { $match: { salesPerson: userId } },
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
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        statistics: {
          today: todayStats[0] || { count: 0, revenue: 0, quantity: 0 },
          thisWeek: weekStats[0] || { count: 0, revenue: 0 },
          thisMonth: monthStats[0] || { count: 0, revenue: 0 },
          total: totalStats[0] || { count: 0, revenue: 0, quantity: 0 }
        },
        recentSales,
        topProducts,
        user: {
          name: req.user.name,
          email: req.user.email,
          role: req.user.role
        }
      }
    });

  } catch (error) {
    console.error('Error fetching sales dashboard:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales dashboard",
      error: error.message
    });
  }
};

// Get available products for sales (quick access)
export const getProductsForSale = async (req, res) => {
  try {
    const { search, limit = 50 } = req.query;

    // Build filter for active products with stock
    const filter = { 
      isActive: true,
      stock: { $gt: 0 }
    };

    // Add search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { productId: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(filter)
      .select('name productId price stock description')
      .sort({ name: 1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        products,
        count: products.length
      }
    });

  } catch (error) {
    console.error('Error fetching products for sale:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products for sale",
      error: error.message
    });
  }
};

// Get recent sales history with user and product details
export const getRecentSalesHistory = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 5000, 
      startDate, 
      endDate,
      userId
    } = req.query;

    // Build filter for sales
    const filter = {};

    // Date range filter
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }

    // User filter (if specified)
    if (userId) {
      filter.salesPerson = userId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get recent sales with populated user and product details
    const salesHistory = await Sales.find(filter)
      .populate({
        path: 'salesPerson',
        select: 'name email role profileImage'
      })
      .populate({
        path: 'product',
        select: 'name productId price stock description image'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

      console.log("salesHistory>>>>>>>>>>>>>>>>>>>", salesHistory);

    const total = await Sales.countDocuments(filter);

    // Format the response to include the required information
    const formattedHistory = salesHistory.map(sale => ({
      id: sale._id,
      saleDate: sale.saleDate,
      user: {
        id: sale.salesPerson._id,
        name: sale.salesPerson.name,
        email: sale.salesPerson.email,
        role: sale.salesPerson.role,
        profileImage: sale.salesPerson.profileImage
      },
      product: {
        id: sale.product?._id,
        name: sale.product?.name,
        productId: sale.product?.productId,
        unitPrice: sale.unitPrice,
        currentStock: sale.product?.stock, // Remaining stock
        description: sale.product?.description,
        image: sale.product?.image
      },
      sale: {
        quantity: sale.quantity,
        totalAmount: sale.finalAmount,
        discount: sale.discount,
        paymentMethod: sale.paymentMethod,
        paymentStatus: sale.paymentStatus
      },
      customer: {
        name: sale.customer.name,
        email: sale.customer.email,
        phone: sale.customer.phone
      },
      notes: sale.notes,
      createdAt: sale.createdAt
    }));

    res.status(200).json({
      success: true,
      data: {
        salesHistory: formattedHistory,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          count: total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching recent sales history:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent sales history",
      error: error.message
    });
  }
};
