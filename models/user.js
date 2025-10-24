import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  businessName: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'manager', 'employee', 'business_customer'],
  },
  subRole: {
    type: String,
    enum: ['individual', 'wholesale', 'store_owner'],
  },
  permissions: {
    canManageUsers: { type: Boolean, default: false },
    canManageProducts: { type: Boolean, default: false },
    canViewReports: { type: Boolean, default: false },
    canRecordSales: { type: Boolean, default: true }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isLoggedIn: {
    type: Boolean,
    default: false
  },
  profileImage: String,
  lastLogin: Date,
  fcmToken:  {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Direct password comparison method
userSchema.methods.comparePassword = function(candidatePassword) {
  return this.password === candidatePassword;
};

export const User = mongoose.model("User", userSchema);
