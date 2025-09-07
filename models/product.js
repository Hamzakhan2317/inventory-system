import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
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
  // Single image field (URL string like user profileImage)
  image: String,
  // Category array with name, quantity, and price (optional)
  category: [{
    name: {
      type: String,
      trim: true
    },
    quantity: {
      type: Number,
      min: 0
    },
    price: {
      type: Number,
      min: 0
    }
  }],
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


export const Product = mongoose.model("Product", productSchema);
