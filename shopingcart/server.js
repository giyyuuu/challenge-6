const express = require('express');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const CartDatabase = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const cartDb = new CartDatabase();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// Session management middleware
app.use((req, res, next) => {
  // Get or create session ID from cookie
  let sessionId = req.cookies.sessionId;
  
  if (!sessionId) {
    sessionId = uuidv4();
    res.cookie('sessionId', sessionId, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      sameSite: 'lax'
    });
  }
  
  req.sessionId = sessionId;
  next();
});

// API Routes

// Get cart
app.get('/api/cart', (req, res) => {
  try {
    const cart = cartDb.getCart(req.sessionId);
    
    if (!cart) {
      return res.json({ items: [] });
    }
    
    res.json({ items: cart.items, lastUpdated: cart.lastUpdated });
  } catch (error) {
    console.error('Error getting cart:', error);
    res.status(500).json({ error: 'Failed to get cart' });
  }
});

// Add item to cart
app.post('/api/cart/add', (req, res) => {
  try {
    const { productId, name, price, quantity = 1, image } = req.body;
    
    if (!productId || !name || !price) {
      return res.status(400).json({ error: 'Missing required fields: productId, name, price' });
    }
    
    // Get existing cart
    let cart = cartDb.getCart(req.sessionId);
    let items = cart ? cart.items : [];
    
    // Check if item already exists
    const existingItemIndex = items.findIndex(item => item.productId === productId);
    
    if (existingItemIndex >= 0) {
      // Update quantity
      items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      items.push({
        productId,
        name,
        price: parseFloat(price),
        quantity: parseInt(quantity),
        image: image || null
      });
    }
    
    // Save to database
    cartDb.saveCart(req.sessionId, items);
    
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

// Update item quantity
app.put('/api/cart/update', (req, res) => {
  try {
    const { productId, quantity } = req.body;
    
    if (!productId || quantity === undefined) {
      return res.status(400).json({ error: 'Missing required fields: productId, quantity' });
    }
    
    const cart = cartDb.getCart(req.sessionId);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    
    let items = cart.items;
    const itemIndex = items.findIndex(item => item.productId === productId);
    
    if (itemIndex < 0) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }
    
    if (quantity <= 0) {
      // Remove item
      items.splice(itemIndex, 1);
    } else {
      // Update quantity
      items[itemIndex].quantity = parseInt(quantity);
    }
    
    cartDb.saveCart(req.sessionId, items);
    
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// Remove item from cart
app.delete('/api/cart/remove/:productId', (req, res) => {
  try {
    const { productId } = req.params;
    
    const cart = cartDb.getCart(req.sessionId);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    
    let items = cart.items.filter(item => item.productId !== productId);
    cartDb.saveCart(req.sessionId, items);
    
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ error: 'Failed to remove item from cart' });
  }
});

// Clear cart
app.delete('/api/cart/clear', (req, res) => {
  try {
    cartDb.saveCart(req.sessionId, []);
    res.json({ success: true, items: [] });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

// Sync cart from localStorage (for browser persistence)
app.post('/api/cart/sync', (req, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Items must be an array' });
    }
    
    // Get server cart
    const serverCart = cartDb.getCart(req.sessionId);
    const serverItems = serverCart ? serverCart.items : [];
    
    // Merge strategy: prefer server data if it's newer, otherwise merge
    let mergedItems = [...serverItems];
    
    // Add or update items from client
    items.forEach(clientItem => {
      const existingIndex = mergedItems.findIndex(item => item.productId === clientItem.productId);
      if (existingIndex >= 0) {
        // Use the higher quantity
        mergedItems[existingIndex].quantity = Math.max(
          mergedItems[existingIndex].quantity,
          clientItem.quantity
        );
      } else {
        mergedItems.push(clientItem);
      }
    });
    
    // Save merged cart
    cartDb.saveCart(req.sessionId, mergedItems);
    
    res.json({ success: true, items: mergedItems });
  } catch (error) {
    console.error('Error syncing cart:', error);
    res.status(500).json({ error: 'Failed to sync cart' });
  }
});

// Cleanup endpoint (can be called manually or via cron)
app.post('/api/admin/cleanup', (req, res) => {
  try {
    const deleted = cartDb.cleanupExpiredCarts();
    res.json({ success: true, deletedCarts: deleted });
  } catch (error) {
    console.error('Error cleaning up carts:', error);
    res.status(500).json({ error: 'Failed to cleanup carts' });
  }
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start cleanup interval (runs every hour)
setInterval(() => {
  try {
    const deleted = cartDb.cleanupExpiredCarts();
    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} expired cart(s)`);
    }
  } catch (error) {
    console.error('Error in cleanup interval:', error);
  }
}, 60 * 60 * 1000); // 1 hour

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Persistent shopping cart system initialized');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  cartDb.close();
  process.exit(0);
});

