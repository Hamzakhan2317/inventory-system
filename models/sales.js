import mongoose from "mongoose";

const salesSchema = new mongoose.Schema({
  saleId: {
    type: String,
    unique: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productSnapshot: {
    name: String,
    productId: String,
    price: Number
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  customer: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    address: String
  },
  salesPerson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'cheque', 'online'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'completed'
  },
  transactionId: String,
  notes: String,
  saleDate: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Calculate amounts and generate sale ID
salesSchema.pre('save', function(next) {
  // Calculate total amount
  this.totalAmount = this.quantity * this.unitPrice;
  
  // Calculate final amount after discount
  this.finalAmount = this.totalAmount - this.discount;
  
  // Generate sale ID if not exists
  if (!this.saleId) {
    const timestamp = Date.now().toString().slice(-6);
    this.saleId = `SAL${timestamp}`;
  }
  
  next();
});

export const Sales = mongoose.model("Sales", salesSchema);
