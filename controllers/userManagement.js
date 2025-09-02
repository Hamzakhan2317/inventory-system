import { User, Sales } from "../models/index.js";
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
    console.log(req.user)
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

      // Audit logging removed
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
