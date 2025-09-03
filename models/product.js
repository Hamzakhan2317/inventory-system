import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  productId: {
    type: String,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Auto-generate productId if not provided
productSchema.pre('save', async function(next) {
  if (!this.productId && this.isNew) {
    // Generate a unique productId
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!isUnique && attempts < maxAttempts) {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      this.productId = `PRD${timestamp}${random}`;
      
      // Check if this productId already exists
      const existingProduct = await this.constructor.findOne({ productId: this.productId });
      if (!existingProduct) {
        isUnique = true;
      }
      attempts++;
    }
    
    if (!isUnique) {
      return next(new Error('Unable to generate unique productId after multiple attempts'));
    }
  }
  next();
});

export const Product = mongoose.model("Product", productSchema);
