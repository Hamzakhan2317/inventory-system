import { ProductType, Product } from "../models/index.js";
import mongoose from "mongoose";

// ============================================================================
// PRODUCT TYPE MANAGEMENT APIs
// ============================================================================

// Create a new product type
export const createProductType = async (req, res) => {
  try {
    const { name } = req.body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product type name is required"
      });
    }

    // Check if product type already exists (since unique constraint was removed from model)
    const existingProductType = await ProductType.findOne({ 
      name: name.trim() 
    });

    if (existingProductType) {
      return res.status(400).json({
        success: false,
        message: "Product type with this name already exists"
      });
    }

    const newProductType = new ProductType({
      name: name.trim()
    });

    await newProductType.save();

    res.status(201).json({
      success: true,
      message: "Product type created successfully",
      data: newProductType
    });

  } catch (error) {
    console.error('Error creating product type:', error);
    res.status(500).json({
      success: false,
      message: "Failed to create product type",
      error: error.message
    });
  }
};

// Get all product types
export const getAllProductTypes = async (req, res) => {
  try {
    const productTypes = await ProductType.find()
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: productTypes
    });

  } catch (error) {
    console.error('Error fetching product types:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product types",
      error: error.message
    });
  }
};

// Get product type by ID
export const getProductTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product type ID"
      });
    }

    const productType = await ProductType.findById(id);

    if (!productType) {
      return res.status(404).json({
        success: false,
        message: "Product type not found"
      });
    }

    // Get products in this product type
    const products = await Product.find({ productType: productType._id })
      .select('name price stock isActive createdAt')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        productType,
        products: {
          count: products.length,
          items: products
        }
      }
    });

  } catch (error) {
    console.error('Error fetching product type:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product type",
      error: error.message
    });
  }
};

// Update product type
export const updateProductType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product type ID"
      });
    }

    const productType = await ProductType.findById(id);
    if (!productType) {
      return res.status(404).json({
        success: false,
        message: "Product type not found"
      });
    }

    // Check if new name already exists (if name is being changed)
    if (name && name.trim() !== productType.name) {
      const existingProductType = await ProductType.findOne({ 
        name: name.trim(),
        _id: { $ne: id }
      });

      if (existingProductType) {
        return res.status(400).json({
          success: false,
          message: "Product type with this name already exists"
        });
      }
    }

    const updatedProductType = await ProductType.findByIdAndUpdate(
      id,
      { name: name.trim() },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Product type updated successfully",
      data: updatedProductType
    });

  } catch (error) {
    console.error('Error updating product type:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update product type",
      error: error.message
    });
  }
};

// Delete product type
export const deleteProductType = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product type ID"
      });
    }

    const productType = await ProductType.findById(id);
    if (!productType) {
      return res.status(404).json({
        success: false,
        message: "Product type not found"
      });
    }

    // Check if any products are using this product type
    const productsCount = await Product.countDocuments({ productType: productType._id });
    
    if (productsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete product type. ${productsCount} product(s) are using this product type. Please reassign or delete those products first.`
      });
    }

    await ProductType.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Product type deleted successfully"
    });

  } catch (error) {
    console.error('Error deleting product type:', error);
    res.status(500).json({
      success: false,
      message: "Failed to delete product type",
      error: error.message
    });
  }
};

// Get all product types for dropdowns
export const getAllProductTypesForDropdown = async (req, res) => {
  try {
    const productTypes = await ProductType.find()
      .select('name')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: productTypes
    });

  } catch (error) {
    console.error('Error fetching product types:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product types",
      error: error.message
    });
  }
};
