import { User, Product, Sales } from "../models/index.js";
import mongoose from "mongoose";
import { uploadFilesToCloudinary, deleteFromCloudinary, deleteMultipleFromCloudinary } from "../middlewares/cloudinaryUpload.js";

// ============================================================================
// PRODUCT MANAGEMENT APIs
// ============================================================================

// Create a new product with optional single image upload
export const createProduct = async (req, res) => {
  // Handle file upload first
  const fields = [
    { name: "productImage", maxCount: 1 } // Allow single product image
  ];
  
  uploadFilesToCloudinary(fields)(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ 
        success: false,
        message: "Failed to upload image",
        error: err.message 
      });
    }

    try {
      const {
        name,
        description,
        price,
        stock
      } = req.body;

      // Validate required fields
      if (!name || !price) {
        // Clean up uploaded image if validation fails
        if (req.uploadedFiles?.productImage?.[0]) {
          await deleteFromCloudinary(req.uploadedFiles.productImage[0].publicId);
        }
        
        return res.status(400).json({
          success: false,
          message: "Name and price are required"
        });
      }


      // Get image URL if uploaded
      let image = null;
      if (req.uploadedFiles?.productImage?.[0]) {
        image = req.uploadedFiles.productImage[0].url;
      }

      const newProduct = new Product({
        name,
        description,
        price,
        stock: stock || 0,
        image,
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
      
      // Clean up uploaded image if there's an error
      if (req.uploadedFiles?.productImage?.[0]) {
        await deleteFromCloudinary(req.uploadedFiles.productImage[0].publicId);
      }
      
      res.status(500).json({
        success: false,
        message: "Failed to create product",
        error: error.message
      });
    }
  });
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
        { description: { $regex: search, $options: 'i' } }
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
      .select('quantity finalAmount saleDate customer.name salesPerson');

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

// Update product with optional single image upload
export const updateProduct = async (req, res) => {
  // Handle file upload first
  const fields = [
    { name: "productImage", maxCount: 1 } // Allow single product image
  ];
  
  uploadFilesToCloudinary(fields)(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ 
        success: false,
        message: "Failed to upload image",
        error: err.message 
      });
    }

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

      // Get old product data
      const oldProduct = await Product.findById(id);
      if (!oldProduct) {
        // Clean up uploaded image if product not found
        if (req.uploadedFiles?.productImage?.[0]) {
          await deleteFromCloudinary(req.uploadedFiles.productImage[0].publicId);
        }
        return res.status(404).json({
          success: false,
          message: "Product not found"
        });
      }


      // Handle image update
      let newImage = oldProduct.image;

      // If a new image is uploaded, replace the old one
      if (req.uploadedFiles?.productImage?.[0]) {
        // Delete old image from Cloudinary if it exists
        if (oldProduct.image) {
          await deleteFromCloudinary(oldProduct.image);
        }

        // Set new image URL
        newImage = req.uploadedFiles.productImage[0].url;
      }

      // Handle image removal if specified in updates
      if (updates.removeImage === true) {
        // Delete from Cloudinary
        if (oldProduct.image) {
          await deleteFromCloudinary(oldProduct.image);
        }
        newImage = null;
        delete updates.removeImage; // Don't include in database update
      }

      // Update the product
      const product = await Product.findByIdAndUpdate(
        id,
        { 
          ...updates, 
          image: newImage,
          updatedBy: req.user._id 
        },
        { new: true, runValidators: true }
      ).populate('createdBy updatedBy', 'name email');

      res.status(200).json({
        success: true,
        message: "Product updated successfully",
        data: product
      });

    } catch (error) {
      console.error('Error updating product:', error);
      
      // Clean up uploaded image if there's an error
      if (req.uploadedFiles?.productImage?.[0]) {
        await deleteFromCloudinary(req.uploadedFiles.productImage[0].publicId);
      }
      
      res.status(500).json({
        success: false,
        message: "Failed to update product",
        error: error.message
      });
    }
  });
};

// Update product without file upload (for basic field updates)
export const updateProductBasic = async (req, res) => {
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
    delete updates.image; // Don't allow updating image through this endpoint

    // Get old product data
    const oldProduct = await Product.findById(id);
    if (!oldProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
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

// Remove product image
export const removeProductImage = async (req, res) => {
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

    // Delete image from Cloudinary if it exists
    if (product.image) {
      await deleteFromCloudinary(product.image);
      
      // Remove image from product record
      product.image = null;
      product.updatedBy = req.user._id;
      await product.save();
    }

    const updatedProduct = await Product.findById(id)
      .populate('createdBy updatedBy', 'name email');

    res.status(200).json({
      success: true,
      message: "Product image removed successfully",
      data: updatedProduct
    });

  } catch (error) {
    console.error('Error removing product image:', error);
    res.status(500).json({
      success: false,
      message: "Failed to remove product image",
      error: error.message
    });
  }
};

// Delete product with file cleanup
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
      // Delete image from Cloudinary if it exists
      let deletedFiles = 0;
      if (product.image) {
        await deleteFromCloudinary(product.image);
        deletedFiles = 1;
      }

      // Delete product from database
      await Product.findByIdAndDelete(id);

      return res.status(200).json({
        success: true,
        message: "Product deleted successfully",
        data: {
          deletedFiles
        }
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
    // Since we removed category and brand from schema, return empty arrays
    res.status(200).json({
      success: true,
      data: {
        categories: [],
        brands: []
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
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get only essential product information for normal users
    const products = await Product.find(filter)
      .select('name description price stock isActive createdAt')
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

    pipeline.push(
      {
        $project: {
          productId: '$_id',
          productName: '$product.name',
          productCode: '$product._id',
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

    res.status(200).json({
      success: true,
      data: {
        reportType: 'product_performance',
        dateRange: {
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null
        },
        products: performanceData
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
