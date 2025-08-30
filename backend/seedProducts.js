const mongoose = require('mongoose');
const Product = require('./models/Product'); // Adjust path if needed
const express = require('express');
const router = express.Router();

mongoose.connect('mongodb+srv://ramizrajmulla6:5Vmvi30iN268Q2CE@b2bnexus.x1bjd68.mongodb.net/?retryWrites=true&w=majority&appName=B2BNexus', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const demoProducts = [
  {
    name: 'Demo Widget',
    description: 'A high-quality demo widget for testing.',
    price: 19.99,
    stock: 100,
  },
  {
    name: 'Sample Gadget',
    description: 'A sample gadget for demonstration purposes.',
    price: 29.99,
    stock: 50,
  },
  {
    name: 'Test Product',
    description: 'This is a test product.',
    price: 9.99,
    stock: 200,
  },
];

async function seed() {
  try {
    await Product.deleteMany({});
    await Product.insertMany(demoProducts);
    console.log('Demo products inserted!');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

// Example Express route
router.get('/api/products', async (req, res) => {
  const products = await Product.find();
  res.json({ products });
});

seed();

module.exports = router;