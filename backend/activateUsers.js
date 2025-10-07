#!/usr/bin/env node

/**
 * Script to activate all inactive user accounts
 */

const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function activateUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all inactive users
    const inactiveUsers = await User.find({ 
      status: { $ne: 'active' } 
    }).select('firstName lastName email status');

    console.log(`Found ${inactiveUsers.length} inactive users:`);
    
    if (inactiveUsers.length === 0) {
      console.log('No inactive users found!');
      return;
    }

    // Display inactive users
    inactiveUsers.forEach(user => {
      console.log(`- ${user.firstName} ${user.lastName} (${user.email}) - Status: ${user.status}`);
    });

    // Activate all inactive users
    const result = await User.updateMany(
      { status: { $ne: 'active' } },
      { $set: { status: 'active' } }
    );

    console.log(`\nActivated ${result.modifiedCount} user accounts!`);
    console.log('All users are now active and can access the application.');

  } catch (error) {
    console.error('Error activating users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
activateUsers();