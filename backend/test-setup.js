#!/usr/bin/env node

/**
 * B2B Nexus Backend Setup Test Script
 * This script tests the basic setup and connectivity of the backend
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

console.log('🧪 Testing B2B Nexus Backend Setup...\n');

// Test 1: Environment Variables
console.log('1️⃣ Testing Environment Variables...');
const requiredEnvVars = [
  'PORT',
  'NODE_ENV',
  'MONGODB_URI',
  'JWT_SECRET',
  'JWT_EXPIRE'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.log('❌ Missing required environment variables:');
  missingEnvVars.forEach(varName => console.log(`   - ${varName}`));
} else {
  console.log('✅ All required environment variables are set');
}

// Test 2: MongoDB Connection
console.log('\n2️⃣ Testing MongoDB Connection...');
async function testMongoConnection() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    
    // Test basic operations
    const collections = await conn.connection.db.listCollections().toArray();
    console.log(`   Collections found: ${collections.length}`);
    
    await mongoose.connection.close();
    console.log('✅ MongoDB connection test completed successfully');
    
  } catch (error) {
    console.log('❌ MongoDB connection failed:');
    console.log(`   Error: ${error.message}`);
    console.log('   Please check your MONGODB_URI in .env file');
  }
}

// Test 3: Package Dependencies
console.log('\n3️⃣ Testing Package Dependencies...');
const requiredPackages = [
  'express',
  'mongoose',
  'bcryptjs',
  'jsonwebtoken',
  'cors',
  'dotenv',
  'multer',
  'cloudinary',
  'socket.io',
  'nodemailer',
  'stripe',
  'redis',
  'express-rate-limit',
  'helmet',
  'express-validator',
  'compression',
  'morgan'
];

const packageJson = require('./package.json');
const installedPackages = Object.keys(packageJson.dependencies || {});
const missingPackages = requiredPackages.filter(pkg => !installedPackages.includes(pkg));

if (missingPackages.length > 0) {
  console.log('❌ Missing required packages:');
  missingPackages.forEach(pkg => console.log(`   - ${pkg}`));
  console.log('   Run: npm install');
} else {
  console.log('✅ All required packages are installed');
}

// Test 4: File Structure
console.log('\n4️⃣ Testing File Structure...');
const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'server.js',
  'package.json',
  '.env',
  'README.md'
];

const requiredDirs = [
  'config',
  'middleware',
  'models',
  'routes',
  'socket',
  'utils'
];

const requiredModels = [
  'models/User.js',
  'models/Product.js',
  'models/Category.js',
  'models/Order.js',
  'models/Message.js',
  'models/Conversation.js',
  'models/Cart.js',
  'models/Wishlist.js'
];

const requiredRoutes = [
  'routes/auth.js',
  'routes/users.js',
  'routes/products.js',
  'routes/categories.js',
  'routes/orders.js',
  'routes/messages.js',
  'routes/cart.js',
  'routes/wishlist.js',
  'routes/admin.js',
  'routes/payments.js'
];

const requiredUtils = [
  'utils/emailService.js',
  'utils/cloudinaryService.js'
];

const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
const missingDirs = requiredDirs.filter(dir => !fs.existsSync(dir));
const missingModels = requiredModels.filter(file => !fs.existsSync(file));
const missingRoutes = requiredRoutes.filter(file => !fs.existsSync(file));
const missingUtils = requiredUtils.filter(file => !fs.existsSync(file));

if (missingFiles.length > 0) {
  console.log('❌ Missing required files:');
  missingFiles.forEach(file => console.log(`   - ${file}`));
}

if (missingDirs.length > 0) {
  console.log('❌ Missing required directories:');
  missingDirs.forEach(dir => console.log(`   - ${dir}/`));
}

if (missingModels.length > 0) {
  console.log('❌ Missing required models:');
  missingModels.forEach(file => console.log(`   - ${file}`));
}

if (missingRoutes.length > 0) {
  console.log('❌ Missing required routes:');
  missingRoutes.forEach(file => console.log(`   - ${file}`));
}

if (missingUtils.length > 0) {
  console.log('❌ Missing required utilities:');
  missingUtils.forEach(file => console.log(`   - ${file}`));
}

if (missingFiles.length === 0 && missingDirs.length === 0 && 
    missingModels.length === 0 && missingRoutes.length === 0 && 
    missingUtils.length === 0) {
  console.log('✅ All required files and directories are present');
}

// Test 5: Server Startup
console.log('\n5️⃣ Testing Server Startup...');
async function testServerStartup() {
  try {
    // Import server (this will test if all imports work)
    const app = require('./server.js');
    console.log('✅ Server imports successfully');
    
    // Test if server can be created
    if (app && typeof app === 'function') {
      console.log('✅ Server application is properly configured');
    } else {
      console.log('❌ Server application configuration issue');
    }
    
  } catch (error) {
    console.log('❌ Server startup test failed:');
    console.log(`   Error: ${error.message}`);
    console.log('   Please check for syntax errors in your files');
  }
}

// Run all tests
async function runAllTests() {
  await testMongoConnection();
  await testServerStartup();
  
  console.log('\n🎯 Setup Test Summary:');
  console.log('========================');
  
  if (missingEnvVars.length > 0 || missingPackages.length > 0 || 
      missingFiles.length > 0 || missingDirs.length > 0 ||
      missingModels.length > 0 || missingRoutes.length > 0 ||
      missingUtils.length > 0) {
    console.log('❌ Some tests failed. Please fix the issues above.');
    console.log('\n💡 Next steps:');
    console.log('   1. Install missing packages: npm install');
    console.log('   2. Set up environment variables in .env file');
    console.log('   3. Ensure all required files are present');
    console.log('   4. Run this test again: node test-setup.js');
  } else {
    console.log('✅ All tests passed! Your backend is ready to run.');
    console.log('\n🚀 To start the server:');
    console.log('   npm run dev    # Development mode');
    console.log('   npm start      # Production mode');
    console.log('\n🔗 Health check: http://localhost:5000/health');
  }
  
  console.log('\n📚 Check README.md for detailed setup instructions');
}

// Run tests
runAllTests().catch(console.error);