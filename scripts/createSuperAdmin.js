import mongoose from 'mongoose';
import { User } from '../models/index.js';
import { connectDB } from '../database/db.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const createSuperAdmin = async () => {
  try {
    // Check if MONGO_URI is available
    if (!process.env.MONGO_URI) {
      console.log('❌ Database connection error: MONGO_URI not found');
      console.log('');
      console.log('🔧 To fix this, create a .env file in your project root with:');
      console.log('   MONGO_URI=mongodb://localhost:27017/inventory_db');
      console.log('');
      console.log('   Or replace with your MongoDB connection string.');
      console.log('');
      console.log('💡 Example .env file content:');
      console.log('   MONGO_URI=mongodb://localhost:27017/inventory_db');
      console.log('   PORT=5000');
      console.log('   JWT_SECRET=your-secret-key');
      process.exit(1);
    }

    // Connect to database
    await connectDB();
    console.log('✅ Connected to database');

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
    if (existingSuperAdmin) {
      console.log('⚠️  Super admin already exists:');
      console.log(`   Name: ${existingSuperAdmin.name}`);
      console.log(`   Email: ${existingSuperAdmin.email}`);
      console.log(`   Role: ${existingSuperAdmin.role}`);
      console.log('   Use this account or delete it first to create a new one.');
      process.exit(0);
    }

    // Super admin user data
    const superAdminData = {
      name: 'Super Administrator',
      email: 'admin@inventory.com',
      password: 'Admin@123',
      role: 'super_admin',
      permissions: {
        canManageUsers: true,
        canManageProducts: true,
        canViewReports: true,
        canRecordSales: true
      },
      isActive: true,
      isVerified: true,
      isLoggedIn: false
    };

    // Create super admin user
    const superAdmin = new User(superAdminData);
    await superAdmin.save();

    console.log('🎉 Super Admin created successfully!');
    console.log('');
    console.log('📋 Login Credentials:');
    console.log(`   Email: ${superAdminData.email}`);
    console.log(`   Password: ${superAdminData.password}`);
    console.log(`   Role: ${superAdminData.role}`);
    console.log('');
    console.log('⚠️  IMPORTANT: Change the password after first login!');
    console.log('');
    console.log('✅ You can now start your application and login with these credentials.');

  } catch (error) {
    console.error('❌ Error creating super admin:', error.message);
    console.error('🔍 Full error details:', error);
    
    if (error.code === 11000) {
      console.log('💡 A user with this email already exists. Try with a different email or delete the existing user.');
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
      console.log('💡 MongoDB connection failed. Please ensure:');
      console.log('   1. MongoDB is running on your system');
      console.log('   2. The connection string in .env is correct');
      console.log('   3. The database server is accessible');
    }
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔐 Database connection closed');
    process.exit(0);
  }
};

// Handle script arguments for custom data
const args = process.argv.slice(2);
const customEmail = args.find(arg => arg.startsWith('--email='))?.split('=')[1];
const customPassword = args.find(arg => arg.startsWith('--password='))?.split('=')[1];
const customName = args.find(arg => arg.startsWith('--name='))?.split('=')[1];

if (customEmail || customPassword || customName) {
  console.log('🔧 Using custom super admin data...');
}

// Run the script
createSuperAdmin();
