import { User, Product, Sales } from "../models/index.js";
import { logIn } from "../middlewares/index.js";
import mongoose from "mongoose";

// ============================================================================
// USER MANAGEMENT APIs (Super Admin Only) 
// ============================================================================

// Create a new user
export const createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role, permissions } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required"
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    // Set default permissions based on role
    let userPermissions = {
      canManageUsers: false,
      canManageProducts: false,
      canViewReports: false,
      canRecordSales: true
    };

    if (role === 'super_admin' || role === 'admin') {
      userPermissions = {
        canManageUsers: true,
        canManageProducts: true,
        canViewReports: true,
        canRecordSales: true
      };
    }

    // Override with custom permissions if provided
    if (permissions) {
      userPermissions = { ...userPermissions, ...permissions };
    }

    const newUser = new User({
      name,
      email,
      phone,
      password,
      role: role || 'normal_user',
      permissions: userPermissions,
      createdBy: req.user._id,
      isVerified: true // Auto-verify admin created users
    });

    await newUser.save();



    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: userResponse
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: "Failed to create user",
      error: error.message
    });
  }
};

// Get all users with filtering and pagination
export const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      isActive,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(filter)
      .select('-password') // Exclude password field
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    // Get user activity stats
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const salesCount = await Sales.countDocuments({ 
          salesPerson: user._id,
          status: 'active'
        });
        
        const totalSales = await Sales.aggregate([
          { $match: { salesPerson: user._id, status: 'active' } },
          { $group: { _id: null, total: { $sum: '$finalAmount' } } }
        ]);

        return {
          ...user.toObject(),
          stats: {
            totalSales: salesCount,
            totalRevenue: totalSales[0]?.total || 0
          }
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          count: total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message
    });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const user = await User.findById(id)
      .select('-password')
      .populate('createdBy', 'name email');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get user activity stats
    const salesCount = await Sales.countDocuments({ 
      salesPerson: user._id,
      status: 'active'
    });
    
    const totalSales = await Sales.aggregate([
      { $match: { salesPerson: user._id, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } }
    ]);

    const recentSales = await Sales.find({ salesPerson: user._id })
      .populate('product', 'name productId')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('saleId quantity finalAmount saleDate customer.name product');

    res.status(200).json({
      success: true,
      data: {
        user: user.toObject(),
        stats: {
          totalSales: salesCount,
          totalRevenue: totalSales[0]?.total || 0,
          recentSales
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
      error: error.message
    });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Don't allow updating certain fields
    delete updates._id;
    delete updates.createdBy;
    delete updates.createdAt;
    delete updates.updatedAt;

    // Get old values for audit log
    const oldUser = await User.findById(id);
    if (!oldUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Update the user
    const user = await User.findByIdAndUpdate(
      id,
      { ...updates, updatedBy: req.user._id },
      { new: true, runValidators: true }
    ).select('-password').populate('createdBy updatedBy', 'name email');

 

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message
    });
  }
};

// Activate/Deactivate user
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Prevent deactivating yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account"
      });
    }

    user.isActive = isActive;
    user.updatedBy = req.user._id;
    await user.save();


    res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { userId: user._id, isActive: user.isActive }
    });

  } catch (error) {
    console.error('Error toggling user status:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update user status",
      error: error.message
    });
  }
};

// Delete user (soft delete - just deactivate)
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account"
      });
    }

    // Check if user has sales records
    const salesCount = await Sales.countDocuments({ salesPerson: user._id });
    
    if (salesCount > 0) {
      // Soft delete - just deactivate
      user.isActive = false;
      user.updatedBy = req.user._id;
      await user.save();

  

      return res.status(200).json({
        success: true,
        message: "User deactivated successfully (has sales records, cannot delete permanently)",
        data: { userId: user._id, isActive: false }
      });
    } else {
      // Hard delete if no sales records
      await User.findByIdAndDelete(id);

   

      return res.status(200).json({
        success: true,
        message: "User deleted successfully"
      });
    }

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message
    });
  }
};

// Get user activity/sales history
export const getUserActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      startDate, 
      endDate,
      type = 'sales' // 'sales' or 'all'
    } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let activities = [];
    let total = 0;

    if (type === 'sales' || type === 'all') {
      // Build date filter
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);

      const salesFilter = { salesPerson: id };
      if (startDate || endDate) {
        salesFilter.saleDate = dateFilter;
      }

      const sales = await Sales.find(salesFilter)
        .populate('product', 'name productId')
        .sort({ saleDate: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      total = await Sales.countDocuments(salesFilter);

      activities = sales.map(sale => ({
        type: 'sale',
        id: sale._id,
        saleId: sale.saleId,
        date: sale.saleDate,
        details: {
          product: sale.product,
          quantity: sale.quantity,
          amount: sale.finalAmount,
          customer: sale.customer.name
        }
      }));
    }

    // If type is 'all', we can add other activities from audit logs
    if (type === 'all') {
      const auditFilter = { user: id };
      if (startDate || endDate) {
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);
        auditFilter.timestamp = dateFilter;
      }

      // Audit logs removed
      // Audit functionality removed - no additional activities to add
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        activities,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          count: total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user activity",
      error: error.message
    });
  }
};

// ============================================================================
// PRODUCT MANAGEMENT APIs
// ============================================================================

// Create a new product
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      productId,
      description,
      price,
      stock
    } = req.body;

    // Validate required fields
    if (!name || !price) {
      return res.status(400).json({
        success: false,
        message: "Name and price are required"
      });
    }

    // Check if productId already exists (if provided)
    if (productId) {
      const existingProduct = await Product.findOne({ productId });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: "Product with this ID already exists"
        });
      }
    }

    const newProduct = new Product({
      name,
      productId,
      description,
      price,
      stock: stock || 0,
      createdBy: req.user._id
    });

    await newProduct.save();



    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: newProduct
    });

  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: "Failed to create product",
      error: error.message
    });
  }
};

// Get all products with filtering and pagination
export const getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      brand,
      isActive,
      lowStock,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      minPrice,
      maxPrice
    } = req.query;

    // Build filter object
    const filter = {};
    
    // For normal users, only show active products
    if (req.user.role === 'normal_user') {
      filter.isActive = true;
    } else if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // Simplified filtering - category and brand removed from schema
    if (lowStock === 'true') {
      filter.stock = { $lte: 10 }; // Using fixed low stock threshold
    }
    
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { productId: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Product.find(filter)
      .populate('createdBy updatedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(filter);

    // Get additional stats for admin users
    let stats = {};
    if (req.user.role === 'super_admin' || req.user.role === 'admin') {
      stats = {
        totalProducts: await Product.countDocuments(),
        activeProducts: await Product.countDocuments({ isActive: true }),
        lowStockProducts: await Product.countDocuments({ stock: { $lte: 10 } }),
        totalValue: await Product.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: null, total: { $sum: { $multiply: ['$price', '$stock'] } } } }
        ])
      };
      stats.totalValue = stats.totalValue[0]?.total || 0;
    }

    res.status(200).json({
      success: true,
      data: {
        products,
        stats,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          count: total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message
    });
  }
};

// Get product by ID
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID"
      });
    }

    const product = await Product.findById(id)
      .populate('createdBy updatedBy', 'name email');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // For normal users, only show active products
    if (req.user.role === 'normal_user' && !product.isActive) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Get sales statistics for this product
    const salesStats = await Sales.aggregate([
      { $match: { product: product._id, status: 'active' } },
      {
        $group: {
          _id: null,
          totalSold: { $sum: '$quantity' },
          totalRevenue: { $sum: '$finalAmount' },
          salesCount: { $sum: 1 }
        }
      }
    ]);

    const recentSales = await Sales.find({ product: product._id })
      .populate('salesPerson', 'name email')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('saleId quantity finalAmount saleDate customer.name salesPerson');

    res.status(200).json({
      success: true,
      data: {
        product,
        stats: {
          totalSold: salesStats[0]?.totalSold || 0,
          totalRevenue: salesStats[0]?.totalRevenue || 0,
          salesCount: salesStats[0]?.salesCount || 0,
          recentSales
        }
      }
    });

  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      error: error.message
    });
  }
};

// Update product
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID"
      });
    }

    // Don't allow updating certain fields
    delete updates._id;
    delete updates.createdBy;
    delete updates.createdAt;
    delete updates.updatedAt;

    // Get old values for audit log
    const oldProduct = await Product.findById(id);
    if (!oldProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Check if productId is being changed and if it already exists
    if (updates.productId && updates.productId !== oldProduct.productId) {
      const existingProduct = await Product.findOne({ productId: updates.productId });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: "Product with this ID already exists"
        });
      }
    }

    // Update the product
    const product = await Product.findByIdAndUpdate(
      id,
      { ...updates, updatedBy: req.user._id },
      { new: true, runValidators: true }
    ).populate('createdBy updatedBy', 'name email');

  

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product
    });

  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: error.message
    });
  }
};

// Update product stock
export const updateProductStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock, operation = 'set' } = req.body; // operation can be 'set', 'add', 'subtract'

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID"
      });
    }

    if (stock === undefined || stock < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid stock quantity is required"
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    const oldStock = product.stock;
    let newStock;

    switch (operation) {
      case 'add':
        newStock = oldStock + parseInt(stock);
        break;
      case 'subtract':
        newStock = Math.max(0, oldStock - parseInt(stock));
        break;
      default:
        newStock = parseInt(stock);
    }

    product.stock = newStock;
    product.updatedBy = req.user._id;
    await product.save();

  

    res.status(200).json({
      success: true,
      message: "Product stock updated successfully",
      data: {
        productId: product._id,
        productName: product.name,
        oldStock,
        newStock,
        operation
      }
    });

  } catch (error) {
    console.error('Error updating product stock:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update product stock",
      error: error.message
    });
  }
};

// Activate/Deactivate product
export const toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID"
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    product.isActive = isActive;
    product.updatedBy = req.user._id;
    await product.save();

 

    res.status(200).json({
      success: true,
      message: `Product ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { productId: product._id, isActive: product.isActive }
    });

  } catch (error) {
    console.error('Error toggling product status:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update product status",
      error: error.message
    });
  }
};

// Delete product
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID"
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Check if product has sales records
    const salesCount = await Sales.countDocuments({ product: product._id });
    
    if (salesCount > 0) {
      // Soft delete - just deactivate
      product.isActive = false;
      product.updatedBy = req.user._id;
      await product.save();

   

      return res.status(200).json({
        success: true,
        message: "Product deactivated successfully (has sales records, cannot delete permanently)",
        data: { productId: product._id, isActive: false }
      });
    } else {
      // Hard delete if no sales records
      await Product.findByIdAndDelete(id);

   

      return res.status(200).json({
        success: true,
        message: "Product deleted successfully"
      });
    }

  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: "Failed to delete product",
      error: error.message
    });
  }
};

// Get product categories and brands for filtering
export const getProductFilters = async (req, res) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    const brands = await Product.distinct('brand', { isActive: true });

    res.status(200).json({
      success: true,
      data: {
        categories: categories.filter(cat => cat),
        brands: brands.filter(brand => brand)
      }
    });

  } catch (error) {
    console.error('Error fetching product filters:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product filters",
      error: error.message
    });
  }
};

// Get available products for normal users (active products only)
export const getAvailableProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'name',
      sortOrder = 'asc',
      minPrice,
      maxPrice
    } = req.query;

    // Build filter object - only active products
    const filter = { isActive: true };
    
    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { productId: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get only essential product information for normal users
    const products = await Product.find(filter)
      .select('name productId description price stock isActive createdAt')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(filter);

    // Get basic statistics
    const stats = {
      totalAvailableProducts: await Product.countDocuments({ isActive: true }),
      inStockProducts: await Product.countDocuments({ 
        isActive: true, 
        stock: { $gt: 0 } 
      }),
      outOfStockProducts: await Product.countDocuments({ 
        isActive: true, 
        stock: { $eq: 0 } 
      })
    };

    res.status(200).json({
      success: true,
      data: {
        products,
        stats,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          count: total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching available products:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch available products",
      error: error.message
    });
  }
};

// ============================================================================
// SALES RECORDING APIs
// ============================================================================

// Create a new sale
export const createSale = async (req, res) => {
  try {
    const {
      productId,
      quantity,
      customer,
      discount = 0,
      paymentMethod = 'cash',
      paymentStatus = 'completed',
      transactionId,
      notes,
      saleDate
    } = req.body;

    // Validate required fields
    if (!productId || !quantity || !customer?.name) {
      return res.status(400).json({
        success: false,
        message: "Product ID, quantity, and customer name are required"
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
        message: "Product is not active"
      });
    }

    // Check stock availability
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`
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
      quantity,
      unitPrice: product.price,
      discount,
      customer: {
        name: customer.name.trim(),
        email: customer.email?.toLowerCase()?.trim(),
        phone: customer.phone?.trim(),
        address: customer.address
      },
      salesPerson: req.user._id,
      paymentMethod,
      paymentStatus,
      transactionId,
      notes,
      saleDate: saleDate ? new Date(saleDate) : new Date(),
      createdBy: req.user._id
    });

    await newSale.save();

    // Update product stock
    product.stock -= quantity;
    product.updatedBy = req.user._id;
    await product.save();

   

    // Populate the created sale for response
    const populatedSale = await Sales.findById(newSale._id)
      .populate('product', 'name productId image')
      .populate('salesPerson', 'name email');

    res.status(201).json({
      success: true,
      message: "Sale recorded successfully",
      data: populatedSale
    });

  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({
      success: false,
      message: "Failed to record sale",
      error: error.message
    });
  }
};

// Get all sales with filtering and pagination
export const getAllSales = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      salesPerson,
      product,
      customer,
      startDate,
      endDate,
      status,
      paymentStatus,
      paymentMethod,
      search,
      sortBy = 'saleDate',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    // For normal users, only show their own sales
    if (req.user.role === 'normal_user') {
      filter.salesPerson = req.user._id;
    } else if (salesPerson) {
      filter.salesPerson = salesPerson;
    }

    if (product) filter.product = product;
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    // Date range filter
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }

    // Customer search
    if (customer) {
      filter.$or = [
        { 'customer.name': { $regex: customer, $options: 'i' } },
        { 'customer.email': { $regex: customer, $options: 'i' } },
        { 'customer.phone': { $regex: customer, $options: 'i' } }
      ];
    }

    // General search
    if (search) {
      filter.$or = [
        { saleId: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } },
        { transactionId: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const sales = await Sales.find(filter)
      .populate('product', 'name productId')
      .populate('salesPerson', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Sales.countDocuments(filter);

    // Get summary statistics for admin users
    let summary = {};
    if (req.user.role === 'super_admin' || req.user.role === 'admin') {
      const summaryData = await Sales.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: '$finalAmount' },
            totalQuantity: { $sum: '$quantity' },
            avgSaleAmount: { $avg: '$finalAmount' }
          }
        }
      ]);
      
      summary = summaryData[0] || {
        totalSales: 0,
        totalRevenue: 0,
        totalQuantity: 0,
        avgSaleAmount: 0
      };
    }

    res.status(200).json({
      success: true,
      data: {
        sales,
        summary,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          count: total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales",
      error: error.message
    });
  }
};

// Get sale by ID
export const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale ID"
      });
    }

    const sale = await Sales.findById(id)
      .populate('product', 'name productId')
      .populate('salesPerson', 'name email')
      .populate('createdBy updatedBy', 'name email');

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found"
      });
    }

    // Check access permissions
    if (req.user.role === 'normal_user' && 
        sale.salesPerson._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied - can only view your own sales"
      });
    }

    res.status(200).json({
      success: true,
      data: sale
    });

  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sale",
      error: error.message
    });
  }
};

// Update sale
export const updateSale = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale ID"
      });
    }

    // Get the existing sale
    const existingSale = await Sales.findById(id);
    if (!existingSale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found"
      });
    }

    // Check access permissions
    if (req.user.role === 'normal_user') {
      if (existingSale.salesPerson.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied - can only update your own sales"
        });
      }
      
      // Restrict what normal users can update
      const allowedUpdates = ['customer', 'notes'];
      const updateKeys = Object.keys(updates);
      const invalidUpdates = updateKeys.filter(key => !allowedUpdates.includes(key));
      
      if (invalidUpdates.length > 0) {
        return res.status(403).json({
          success: false,
          message: `Normal users can only update: ${allowedUpdates.join(', ')}`
        });
      }
    }

    // Don't allow updating certain fields
    delete updates._id;
    delete updates.saleId;
    delete updates.product;
    delete updates.salesPerson;
    delete updates.createdBy;
    delete updates.createdAt;
    delete updates.updatedAt;

    // If quantity is being updated, handle stock changes
    if (updates.quantity && updates.quantity !== existingSale.quantity) {
      const product = await Product.findById(existingSale.product);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Associated product not found"
        });
      }

      const quantityDifference = updates.quantity - existingSale.quantity;
      
      // Check if we have enough stock for increase
      if (quantityDifference > 0 && product.stock < quantityDifference) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for quantity increase. Available: ${product.stock}`
        });
      }

      // Update product stock
      product.stock -= quantityDifference;
      product.updatedBy = req.user._id;
      await product.save();

      // Recalculate amounts if quantity changed
      updates.totalAmount = updates.quantity * existingSale.unitPrice;
      updates.finalAmount = updates.totalAmount - (existingSale.discount || 0);
    }

    // Update the sale
    const sale = await Sales.findByIdAndUpdate(
      id,
      { ...updates, updatedBy: req.user._id },
      { new: true, runValidators: true }
    ).populate('product salesPerson createdBy updatedBy', 'name email');

 

    res.status(200).json({
      success: true,
      message: "Sale updated successfully",
      data: sale
    });

  } catch (error) {
    console.error('Error updating sale:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update sale",
      error: error.message
    });
  }
};

// Cancel/Return sale
export const cancelSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, status = 'cancelled' } = req.body; // status can be 'cancelled' or 'returned'

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale ID"
      });
    }

    if (!['cancelled', 'returned'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'cancelled' or 'returned'"
      });
    }

    const sale = await Sales.findById(id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found"
      });
    }

    // Check access permissions
    if (req.user.role === 'normal_user' && 
        sale.salesPerson.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied - can only cancel your own sales"
      });
    }

    if (sale.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Sale is already ${sale.status}`
      });
    }

    // Restore product stock
    const product = await Product.findById(sale.product);
    if (product) {
      product.stock += sale.quantity;
      product.updatedBy = req.user._id;
      await product.save();
    }

    // Update sale status
    sale.status = status;
    sale.notes = sale.notes ? `${sale.notes}\n\n${status.toUpperCase()}: ${reason || 'No reason provided'}` : 
                              `${status.toUpperCase()}: ${reason || 'No reason provided'}`;
    sale.updatedBy = req.user._id;
    await sale.save();



    res.status(200).json({
      success: true,
      message: `Sale ${status} successfully`,
      data: {
        saleId: sale._id,
        status: sale.status,
        quantityRestored: sale.quantity
      }
    });

  } catch (error) {
    console.error('Error cancelling sale:', error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel sale",
      error: error.message
    });
  }
};

// Get sales summary for dashboard
export const getSalesSummary = async (req, res) => {
  try {
    const { period = 'today', salesPerson } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate, endDate;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = new Date(weekAgo.getFullYear(), weekAgo.getMonth(), weekAgo.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear() + 1, 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }

    // Build filter
    const filter = {
      saleDate: { $gte: startDate, $lt: endDate },
      status: 'active'
    };

    // For normal users, only show their own sales
    if (req.user.role === 'normal_user') {
      filter.salesPerson = req.user._id;
    } else if (salesPerson) {
      filter.salesPerson = salesPerson;
    }

    // Get overall summary
    const summary = await Sales.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          totalQuantity: { $sum: '$quantity' },
          avgSaleAmount: { $avg: '$finalAmount' }
        }
      }
    ]);

    // Get top products
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

    // Get daily sales for charts (last 7 days)
    const dailySales = await Sales.aggregate([
      {
        $match: {
          saleDate: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
          status: 'active',
          ...(req.user.role === 'normal_user' ? { salesPerson: req.user._id } : 
             salesPerson ? { salesPerson: mongoose.Types.ObjectId(salesPerson) } : {})
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$saleDate' },
            month: { $month: '$saleDate' },
            day: { $dayOfMonth: '$saleDate' }
          },
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        period,
        summary: summary[0] || {
          totalSales: 0,
          totalRevenue: 0,
          totalQuantity: 0,
          avgSaleAmount: 0
        },
        topProducts,
        dailySales,
        dateRange: {
          startDate,
          endDate: new Date(endDate.getTime() - 1) // Subtract 1ms to show actual end date
        }
      }
    });

  } catch (error) {
    console.error('Error fetching sales summary:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales summary",
      error: error.message
    });
  }
};

// ============================================================================
// REPORTING AND ANALYTICS APIs (Super Admin Only)
// ============================================================================

// Get comprehensive sales reports
export const getSalesReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      groupBy = 'day', // day, week, month, year
      salesPerson,
      product,
      category,
      format = 'json' // json, csv
    } = req.query;

    // Build base filter
    const filter = { status: 'active' };
    
    // Date range filter
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }

    if (salesPerson) filter.salesPerson = mongoose.Types.ObjectId(salesPerson);
    if (product) filter.product = mongoose.Types.ObjectId(product);

    // Build aggregation pipeline
    let pipeline = [{ $match: filter }];

    // Add product lookup for category filtering
    if (category) {
      pipeline.push(
        {
          $lookup: {
            from: 'products',
            localField: 'product',
            foreignField: '_id',
            as: 'productInfo'
          }
        },
        { $unwind: '$productInfo' },
        { $match: { 'productInfo.category': category } }
      );
    }

    // Group by time period
    const groupByMap = {
      day: {
        year: { $year: '$saleDate' },
        month: { $month: '$saleDate' },
        day: { $dayOfMonth: '$saleDate' }
      },
      week: {
        year: { $year: '$saleDate' },
        week: { $week: '$saleDate' }
      },
      month: {
        year: { $year: '$saleDate' },
        month: { $month: '$saleDate' }
      },
      year: {
        year: { $year: '$saleDate' }
      }
    };

    pipeline.push(
      {
        $group: {
          _id: groupByMap[groupBy],
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          totalQuantity: { $sum: '$quantity' },
          avgSaleAmount: { $avg: '$finalAmount' },
          maxSaleAmount: { $max: '$finalAmount' },
          minSaleAmount: { $min: '$finalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
    );

    const reportData = await Sales.aggregate(pipeline);

    // Get summary statistics
    const summaryPipeline = [{ $match: filter }];
    if (category) {
      summaryPipeline.push(
        {
          $lookup: {
            from: 'products',
            localField: 'product',
            foreignField: '_id',
            as: 'productInfo'
          }
        },
        { $unwind: '$productInfo' },
        { $match: { 'productInfo.category': category } }
      );
    }

    summaryPipeline.push({
      $group: {
        _id: null,
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: '$finalAmount' },
        totalQuantity: { $sum: '$quantity' },
        avgSaleAmount: { $avg: '$finalAmount' },
        uniqueCustomers: { $addToSet: '$customer.email' }
      }
    });

    const summary = await Sales.aggregate(summaryPipeline);
    
 

    const response = {
      success: true,
      data: {
        reportType: 'sales',
        groupBy,
        dateRange: {
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null
        },
        summary: summary[0] || {
          totalSales: 0,
          totalRevenue: 0,
          totalQuantity: 0,
          avgSaleAmount: 0,
          uniqueCustomers: []
        },
        data: reportData,
        filters: { salesPerson, product, category }
      }
    };

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = 'Period,Total Sales,Total Revenue,Total Quantity,Avg Sale Amount\n';
      const csvData = reportData.map(row => {
        const period = groupBy === 'day' ? 
          `${row._id.year}-${String(row._id.month).padStart(2, '0')}-${String(row._id.day).padStart(2, '0')}` :
          groupBy === 'week' ? 
          `${row._id.year}-W${String(row._id.week).padStart(2, '0')}` :
          groupBy === 'month' ?
          `${row._id.year}-${String(row._id.month).padStart(2, '0')}` :
          `${row._id.year}`;
        
        return `${period},${row.totalSales},${row.totalRevenue},${row.totalQuantity},${row.avgSaleAmount.toFixed(2)}`;
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=sales-report.csv');
      return res.send(csvHeaders + csvData);
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({
      success: false,
      message: "Failed to generate sales report",
      error: error.message
    });
  }
};

// Get user performance report
export const getUserPerformanceReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      limit = 10,
      sortBy = 'totalRevenue',
      sortOrder = 'desc'
    } = req.query;

    // Build date filter
    const dateFilter = { status: 'active' };
    if (startDate || endDate) {
      dateFilter.saleDate = {};
      if (startDate) dateFilter.saleDate.$gte = new Date(startDate);
      if (endDate) dateFilter.saleDate.$lte = new Date(endDate);
    }

    const pipeline = [
      { $match: dateFilter },
      {
        $group: {
          _id: '$salesPerson',
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          totalQuantity: { $sum: '$quantity' },
          avgSaleAmount: { $avg: '$finalAmount' },
          uniqueCustomers: { $addToSet: '$customer.email' },
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
      { $unwind: '$user' },
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
          lastSaleDate: 1,
          efficiency: {
            $divide: ['$totalRevenue', '$totalSales']
          }
        }
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
      { $limit: parseInt(limit) }
    ];

    const performanceData = await Sales.aggregate(pipeline);

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
        reportType: 'user_performance',
        dateRange: {
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null
        },
        summary: overallSummary[0] || {
          totalSales: 0,
          totalRevenue: 0,
          totalSalespeople: [],
          avgRevenuePerSale: 0
        },
        users: performanceData
      }
    });

  } catch (error) {
    console.error('Error generating user performance report:', error);
    res.status(500).json({
      success: false,
      message: "Failed to generate user performance report",
      error: error.message
    });
  }
};

// Get product performance report
export const getProductPerformanceReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      limit = 10,
      sortBy = 'totalRevenue',
      sortOrder = 'desc',
      category
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
          _id: '$product',
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          totalQuantitySold: { $sum: '$quantity' },
          avgSaleAmount: { $avg: '$finalAmount' },
          lastSaleDate: { $max: '$saleDate' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' }
    ];

    // Add category filter if specified
    if (category) {
      pipeline.push({ $match: { 'product.category': category } });
    }

    pipeline.push(
      {
        $project: {
          productId: '$_id',
          productName: '$product.name',
          productCode: '$product.productId',
          category: '$product.category',
          brand: '$product.brand',
          currentStock: '$product.stock',
          isActive: '$product.isActive',
          totalSales: 1,
          totalRevenue: 1,
          totalQuantitySold: 1,
          avgSaleAmount: 1,
          lastSaleDate: 1,
          profitability: {
            $divide: ['$totalRevenue', '$totalSales']
          }
        }
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
      { $limit: parseInt(limit) }
    );

    const performanceData = await Sales.aggregate(pipeline);

    // Get category summary if no specific category filter
    let categorySummary = [];
    if (!category) {
      categorySummary = await Sales.aggregate([
        { $match: dateFilter },
        {
          $lookup: {
            from: 'products',
            localField: 'product',
            foreignField: '_id',
            as: 'productInfo'
          }
        },
        { $unwind: '$productInfo' },
        {
          $group: {
            _id: '$productInfo.category',
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: '$finalAmount' },
            totalQuantity: { $sum: '$quantity' }
          }
        },
        { $sort: { totalRevenue: -1 } }
      ]);
    }



    res.status(200).json({
      success: true,
      data: {
        reportType: 'product_performance',
        dateRange: {
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null
        },
        products: performanceData,
        categoryBreakdown: categorySummary
      }
    });

  } catch (error) {
    console.error('Error generating product performance report:', error);
    res.status(500).json({
      success: false,
      message: "Failed to generate product performance report",
      error: error.message
    });
  }
};

// Get inventory status report
export const getInventoryReport = async (req, res) => {
  try {
    const {
      lowStockOnly = false,
      category,
      brand,
      sortBy = 'stock',
      sortOrder = 'asc'
    } = req.query;

    // Build filter
    const filter = {};
    if (lowStockOnly === 'true') {
      filter.$expr = { $lte: ['$stock', '$lowStockThreshold'] };
    }
    if (category) filter.category = category;
    if (brand) filter.brand = brand;

    // Get product inventory data
    const inventoryData = await Product.find(filter)
      .select('name productId category brand stock lowStockThreshold price isActive createdAt')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 });

    // Calculate inventory summary
    const summary = await Product.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStockValue: { $sum: { $multiply: ['$stock', '$price'] } },
          totalStockQuantity: { $sum: '$stock' },
          lowStockProducts: {
            $sum: {
              $cond: [{ $lte: ['$stock', '$lowStockThreshold'] }, 1, 0]
            }
          },
          outOfStockProducts: {
            $sum: {
              $cond: [{ $eq: ['$stock', 0] }, 1, 0]
            }
          },
          avgStockLevel: { $avg: '$stock' }
        }
      }
    ]);

    // Get category breakdown
    const categoryBreakdown = await Product.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$category',
          productCount: { $sum: 1 },
          totalStock: { $sum: '$stock' },
          totalValue: { $sum: { $multiply: ['$stock', '$price'] } },
          lowStockCount: {
            $sum: {
              $cond: [{ $lte: ['$stock', '$lowStockThreshold'] }, 1, 0]
            }
          }
        }
      },
      { $sort: { totalValue: -1 } }
    ]);

 
    res.status(200).json({
      success: true,
      data: {
        reportType: 'inventory',
        filters: { lowStockOnly, category, brand },
        summary: summary[0] || {
          totalProducts: 0,
          totalStockValue: 0,
          totalStockQuantity: 0,
          lowStockProducts: 0,
          outOfStockProducts: 0,
          avgStockLevel: 0
        },
        products: inventoryData,
        categoryBreakdown
      }
    });

  } catch (error) {
    console.error('Error generating inventory report:', error);
    res.status(500).json({
      success: false,
      message: "Failed to generate inventory report",
      error: error.message
    });
  }
};

// Get audit trail
export const getAuditTrail = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      user,
      action,
      entity,
      startDate,
      endDate,
      entityId
    } = req.query;

    // Build filter
    const filter = {};
    if (user) filter.user = mongoose.Types.ObjectId(user);
    if (action) filter.action = action;
    if (entity) filter.entity = entity;
    if (entityId) filter.entityId = mongoose.Types.ObjectId(entityId);

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Audit functionality completely removed
    const auditLogs = [];
    const total = 0;
    const actionSummary = [];

    res.status(200).json({
      success: true,
      data: {
        auditLogs,
        actionSummary,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          count: total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch audit trail",
      error: error.message
    });
  }
};

// Export reports in different formats
export const exportReport = async (req, res) => {
  try {
    const { reportType, format = 'csv', ...filterParams } = req.query;

    let reportData;
    let headers;
    let filename;

    switch (reportType) {
      case 'sales':
        const salesData = await getSalesReportData(filterParams);
        reportData = salesData.data;
        headers = 'Date,Sale ID,Product,Customer,Quantity,Amount,Sales Person\n';
        filename = 'sales-export.csv';
        break;

      case 'products':
        const productData = await Product.find({})
          .populate('createdBy', 'name')
          .select('name productId category brand stock price isActive createdAt');
        reportData = productData;
        headers = 'Product ID,Name,Category,Brand,Stock,Price,Status,Created Date\n';
        filename = 'products-export.csv';
        break;

      case 'users':
        const userData = await User.find({})
          .select('name email role isActive createdAt')
          .populate('createdBy', 'name');
        reportData = userData;
        headers = 'Name,Email,Role,Status,Created Date,Created By\n';
        filename = 'users-export.csv';
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type'
        });
    }

 

    if (format === 'csv') {
      let csvContent = headers;
      
      reportData.forEach(row => {
        let csvRow;
        switch (reportType) {
          case 'sales':
            csvRow = `${row.saleDate},${row.saleId},${row.productSnapshot?.name},${row.customer?.name},${row.quantity},${row.finalAmount},${row.salesPerson?.name}`;
            break;
          case 'products':
            csvRow = `${row.productId},"${row.name}",${row.category},${row.brand},${row.stock},${row.price},${row.isActive ? 'Active' : 'Inactive'},${row.createdAt}`;
            break;
          case 'users':
            csvRow = `"${row.name}",${row.email},${row.role},${row.isActive ? 'Active' : 'Inactive'},${row.createdAt},${row.createdBy?.name || ''}`;
            break;
        }
        csvContent += csvRow + '\n';
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      return res.send(csvContent);
    }

    res.status(200).json({
      success: true,
      data: reportData
    });

  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({
      success: false,
      message: "Failed to export report",
      error: error.message
    });
  }
};

// Helper function to get sales report data
async function getSalesReportData(filters) {
  const filter = { status: 'active' };
  
  if (filters.startDate || filters.endDate) {
    filter.saleDate = {};
    if (filters.startDate) filter.saleDate.$gte = new Date(filters.startDate);
    if (filters.endDate) filter.saleDate.$lte = new Date(filters.endDate);
  }

  const data = await Sales.find(filter)
    .populate('product', 'name productId')
    .populate('salesPerson', 'name email')
    .sort({ saleDate: -1 });

  return { data };
}
