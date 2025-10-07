const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://ramizrajmulla6:5Vmvi30iN268Q2CE@b2bnexus.x1bjd68.mongodb.net/ecommerce?retryWrites=true&w=majority&appName=B2BNexus')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Update the user to be a seller
    const updatedUser = await User.findOneAndUpdate(
      { email: 'ramizrajmulla6@gmail.com' },
      { 
        role: 'seller',
        'company.name': 'Ramiz Enterprise',
        'company.description': 'A leading B2B supplier'
      },
      { new: true }
    );
    
    if (updatedUser) {
      console.log(`✅ Updated user ${updatedUser.email} to role: ${updatedUser.role}`);
    } else {
      console.log('❌ User not found');
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });