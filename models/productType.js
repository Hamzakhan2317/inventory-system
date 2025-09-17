import mongoose from "mongoose";

const productTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100
  }
}, {
  timestamps: true
});

// Index for better performance
productTypeSchema.index({ name: 1 });

export const ProductType = mongoose.model("ProductType", productTypeSchema);
