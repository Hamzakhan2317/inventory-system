import { Customer } from '../models/index.js';
import mongoose from 'mongoose';

// Create a new customer
export const createCustomer = async (req, res) => {
  try {
    const { name, businessName, email, phone, address } = req.body;
    const createdBy = req.user?.id || null;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required"
      });
    }

    // Check for duplicate email if provided
    if (email && email.trim()) {
      const existingCustomer = await Customer.findOne({ 
        email: email.toLowerCase().trim() 
      });
      
      if (existingCustomer) {
        return res.status(400).json({
          success: false,
          message: "Customer with this email already exists"
        });
      }
    }

    // Create customer
    const customer = new Customer({
      name: name.trim(),
      businessName: businessName?.trim() || null,
      email: email?.trim() ? email.toLowerCase().trim() : null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      createdBy
    });

    await customer.save();

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: customer
    });

  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({
      success: false,
      message: "Failed to create customer",
      error: error.message
    });
  }
};

// Get all customers with search
export const getAllCustomers = async (req, res) => {
  try {
    const {
      search,
      isActive = 'true',
      includeDeleted = 'false'
    } = req.query;

    // Build filter object
    const filter = {};
    
    // Filter by active status
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // Include deleted customers if requested
    if (includeDeleted === 'true') {
      // Show all customers regardless of isActive status
      delete filter.isActive;
    }

    // Add search functionality
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { businessName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    // Get all customers
    const customers = await Customer.find(filter)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: customers
    });

  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: error.message
    });
  }
};

// Get customer by ID
export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID"
      });
    }

    const customer = await Customer.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    res.status(200).json({
      success: true,
      data: customer
    });

  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer",
      error: error.message
    });
  }
};

// Update customer
export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, businessName, email, phone, address, isActive } = req.body;
    const updatedBy = req.user?.id || null;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID"
      });
    }

    // Check if customer exists
    const existingCustomer = await Customer.findById(id);
    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    // Check for duplicate email if provided and different from current
    if (email && email.trim() && email.toLowerCase().trim() !== existingCustomer.email) {
      const duplicateCustomer = await Customer.findOne({ 
        email: email.toLowerCase().trim(),
        _id: { $ne: id }
      });
      
      if (duplicateCustomer) {
        return res.status(400).json({
          success: false,
          message: "Customer with this email already exists"
        });
      }
    }

    // Prepare update object
    const updateData = {
      updatedBy
    };

    if (name !== undefined) updateData.name = name.trim();
    if (businessName !== undefined) updateData.businessName = businessName?.trim() || null;
    if (email !== undefined) updateData.email = email?.trim() ? email.toLowerCase().trim() : null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update customer
    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email')
     .populate('updatedBy', 'name email');

    res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: updatedCustomer
    });

  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update customer",
      error: error.message
    });
  }
};

// Delete customer (soft delete by setting isActive to false)
export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID"
      });
    }

    // Check if customer exists and is not already deleted
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    // Check if customer is already soft deleted
    if (!customer.isActive) {
      return res.status(400).json({
        success: false,
        message: "Customer is already deleted"
      });
    }

    // Soft delete by setting isActive to false and adding deletedAt timestamp
    const deletedCustomer = await Customer.findByIdAndUpdate(
      id, 
      { 
        isActive: false,
        deletedAt: new Date(),
        updatedBy: req.user?.id || null
      },
      { new: true }
    ).populate('createdBy', 'name email')
     .populate('updatedBy', 'name email');

    res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
      data: {
        id: deletedCustomer._id,
        name: deletedCustomer.name,
        deletedAt: deletedCustomer.deletedAt
      }
    });

  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({
      success: false,
      message: "Failed to delete customer",
      error: error.message
    });
  }
};

// Get customers for dropdown (active customers only)
export const getCustomersForDropdown = async (req, res) => {
  try {
    const customers = await Customer.find({ isActive: true })
      .select('name businessName email phone')
      .sort({ name: 1 });

    const formattedCustomers = customers.map(customer => ({
      id: customer._id,
      name: customer.name,
      businessName: customer.businessName,
      email: customer.email,
      phone: customer.phone,
      displayName: customer.businessName 
        ? `${customer.name} (${customer.businessName})` 
        : customer.name
    }));

    res.status(200).json({
      success: true,
      data: formattedCustomers
    });

  } catch (error) {
    console.error('Error fetching customers for dropdown:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: error.message
    });
  }
};

// Get deleted customers only
export const getDeletedCustomers = async (req, res) => {
  try {
    const { search } = req.query;

    // Build filter for deleted customers
    const filter = {
      isActive: false,
      deletedAt: { $ne: null }
    };

    // Add search functionality
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { businessName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    // Get all deleted customers
    const customers = await Customer.find(filter)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ deletedAt: -1 });

    res.status(200).json({
      success: true,
      data: customers
    });

  } catch (error) {
    console.error('Error fetching deleted customers:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch deleted customers",
      error: error.message
    });
  }
};

// Restore customer (set isActive to true)
export const restoreCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID"
      });
    }

    // Check if customer exists
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    // Check if customer is already active
    if (customer.isActive) {
      return res.status(400).json({
        success: false,
        message: "Customer is already active"
      });
    }

    // Restore customer by setting isActive to true and clearing deletedAt
    const restoredCustomer = await Customer.findByIdAndUpdate(
      id, 
      { 
        isActive: true,
        deletedAt: null,
        updatedBy: req.user?.id || null
      },
      { new: true }
    ).populate('createdBy', 'name email')
     .populate('updatedBy', 'name email');

    res.status(200).json({
      success: true,
      message: "Customer restored successfully",
      data: restoredCustomer
    });

  } catch (error) {
    console.error('Error restoring customer:', error);
    res.status(500).json({
      success: false,
      message: "Failed to restore customer",
      error: error.message
    });
  }
};
