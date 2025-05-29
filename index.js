const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads'));

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/productDB')
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Product Schema
const productSchema = new mongoose.Schema({
    title: { type: String, required: true },
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    itemType: { type: String, enum: ['cold', 'organic', 'regular'], default: 'regular' },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    images: [String],
    createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

// Cart Schema
const cartSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, default: 1 },
    addedAt: { type: Date, default: Date.now }
});

const Cart = mongoose.model('Cart', cartSchema);

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/jpg') {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, JPG, and PNG images are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // 5MB limit
    fileFilter: fileFilter
});

// Routes

// POST API for creating a product with multiple images
app.post('/api/products', upload.array('images', 5), async (req, res) => {
    try {
        const { title, price, discount, itemType, rating } = req.body;
        
        if (!title || !price) {
            return res.status(400).json({ error: 'Title and price are required' });
        }

        const imagePaths = req.files ? req.files.map(file => file.path) : [];

        const product = new Product({
            title,
            price: parseFloat(price),
            discount: discount ? parseFloat(discount) : 0,
            itemType: itemType || 'regular',
            rating: rating ? parseFloat(rating) : 0,
            images: imagePaths
        });

        await product.save();

        res.status(201).json({
            message: 'Product created successfully',
            product
        });
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST API for adding a product to cart
app.post('/api/cart', async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        
        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Check if product is already in cart
        let cartItem = await Cart.findOne({ productId });
        
        if (cartItem) {
            // Update quantity if already in cart
            cartItem.quantity += quantity || 1;
            await cartItem.save();
        } else {
            // Add new item to cart
            cartItem = new Cart({
                productId,
                quantity: quantity || 1
            });
            await cartItem.save();
        }

        res.status(201).json({
            message: 'Product added to cart successfully',
            cartItem
        });
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET API for all products
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET API for cart items
app.get('/api/cart', async (req, res) => {
    try {
        const cartItems = await Cart.find().populate('productId');
        res.json(cartItems);
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (err instanceof multer.MulterError) {
        res.status(400).json({ error: 'File upload error: ' + err.message });
    } else {
        res.status(500).json({ error: 'Something went wrong!' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});