// Usage: node unlockUser.js <userEmail>

const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/YOUR_DB_NAME';
const email = process.argv[2];

if (!email) {
  console.error('Please provide a user email as an argument.');
  process.exit(1);
}

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const user = await User.findOne({ email: email });
    if (!user) {
      console.error('User not found.');
      process.exit(1);
    }
    user.status = 'active';
    user.isLocked = false;
    await user.save();
    console.log(`User ${email} activated and unlocked.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });
