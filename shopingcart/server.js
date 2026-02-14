const express = require('express');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const CartDatabase = require('./database');
const CartValidators = require('./validators');
const ProductCatalog = require('./product-catalog');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

// Initialize services
const cartDb = new CartDatabase();
const productCatalog = new ProductCatalog();

// Middleware
app.use(express.json({ limit: '10mb' })); // Limit request size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(express.static('public'));

// Security headers middleware
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Cart ID management middleware
// Uses UUID-based cart_id stored in secure cookie
app.use((req, res, next) => {
  let cartId = req.cookies.cart_id;
  
  // Validate existing cart_id format
  if (cartId && !CartValidators.isValidUUID(cartId)) {
    // Invalid UUID format, generate new one
    cartId = null;
  }
  
  // Generate new cart_id if not present
  if (!cartId) {
    cartId = uuidv4();
  }
  
  // Set secure cookie with appropriate flags
  const cookieOptions = {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true, // Prevent XSS attacks
    sameSite: 'lax', // CSRF protection
    secure: IS_PRODUCTION // Only send over HTTPS in production
  };
  
  res.cookie('cart_id', cartId, cookieOptions);
  req.cartId = cartId;
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: IS_PRODUCTION ? undefined : err.message
  });
});

// API Routes

/**
 * GET /api/cart
 * Retrieve the current user's cart
 */
app.get('/api/cart', (req, res) => {
  try {
    const cart = cartDb.getCart(req.cartId);
    
    if (!cart) {
      return res.json({ items: [], lastUpdated: null });
    }
    
    res.json({ 
      items: cart.items, 
      lastUpdated: cart.lastUpdated,
      itemCount: cart.itemCount
    });
  } catch (error) {
    console.error('Error getting cart:', error);
    res.status(500).json({ error: 'Failed to get cart' });
  }
});

/**
 * POST /api/cart/add
 * Add an item to the cart
 * Body: { productId, name, price, quantity?, image? }
 */
app.post('/api/cart/add', (req, res) => {
  try {
    const { productId, name, price, quantity = 1, image } = req.body;
    
    // Validate required fields
    if (!productId || !name || price === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: productId, name, price' 
      });
    }
    
    // Validate product ID against catalog
    const validProductIds = productCatalog.getValidProductIds();
    const productIdValidation = CartValidators.validateProductId(productId, validProductIds);
    if (!productIdValidation.valid) {
      return res.status(400).json({ error: productIdValidation.error });
    }
    
    // Validate quantity
    const quantityValidation = CartValidators.validateQuantity(quantity);
    if (!quantityValidation.valid) {
      return res.status(400).json({ error: quantityValidation.error });
    }
    
    // Validate price
    const priceValidation = CartValidators.validatePrice(price);
    if (!priceValidation.valid) {
      return res.status(400).json({ error: priceValidation.error });
    }
    
    // Validate product name
    const nameValidation = CartValidators.validateProductName(name);
    if (!nameValidation.valid) {
      return res.status(400).json({ error: nameValidation.error });
    }
    
    // Get existing cart
    let cart = cartDb.getCart(req.cartId);
    let items = cart ? cart.items : [];
    
    // Check if item already exists
    const existingItemIndex = items.findIndex(
      item => item.productId === productIdValidation.sanitizedId
    );
    
    if (existingItemIndex >= 0) {
      // Update quantity (add to existing)
      const newQuantity = items[existingItemIndex].quantity + quantityValidation.sanitized;
      
      // Validate total quantity doesn't exceed max
      const totalQuantityValidation = CartValidators.validateQuantity(newQuantity);
      if (!totalQuantityValidation.valid) {
        return res.status(400).json({ error: totalQuantityValidation.error });
      }
      
      items[existingItemIndex].quantity = totalQuantityValidation.sanitized;
    } else {
      // Add new item with validated data
      items.push({
        productId: productIdValidation.sanitizedId,
        name: nameValidation.sanitized,
        price: priceValidation.sanitized,
        quantity: quantityValidation.sanitized,
        image: image && typeof image === 'string' && image.length <= 500 
          ? image.trim() 
          : null
      });
    }
    
    // Save to database
    cartDb.saveCart(req.cartId, items);
    
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

/**
 * PUT /api/cart/update
 * Update item quantity in cart
 * Body: { productId, quantity }
 */
app.put('/api/cart/update', (req, res) => {
  try {
    const { productId, quantity } = req.body;
    
    // Validate required fields
    if (!productId || quantity === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: productId, quantity' 
      });
    }
    
    // Validate product ID
    const validProductIds = productCatalog.getValidProductIds();
    const productIdValidation = CartValidators.validateProductId(productId, validProductIds);
    if (!productIdValidation.valid) {
      return res.status(400).json({ error: productIdValidation.error });
    }
    
    // Validate quantity (but allow 0 to remove item)
    if (quantity < 0) {
      return res.status(400).json({ error: 'Quantity cannot be negative' });
    }
    
    const cart = cartDb.getCart(req.cartId);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    
    let items = cart.items;
    const itemIndex = items.findIndex(
      item => item.productId === productIdValidation.sanitizedId
    );
    
    if (itemIndex < 0) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }
    
    // If quantity is 0, remove item
    if (quantity === 0) {
      items.splice(itemIndex, 1);
    } else {
      // Validate quantity
      const quantityValidation = CartValidators.validateQuantity(quantity);
      if (!quantityValidation.valid) {
        return res.status(400).json({ error: quantityValidation.error });
      }
      
      // Update quantity
      items[itemIndex].quantity = quantityValidation.sanitized;
    }
    
    cartDb.saveCart(req.cartId, items);
    
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

/**
 * DELETE /api/cart/remove/:productId
 * Remove an item from the cart
 */
app.delete('/api/cart/remove/:productId', (req, res) => {
  try {
    const { productId } = req.params;
    
    // Validate product ID format
    const validProductIds = productCatalog.getValidProductIds();
    const productIdValidation = CartValidators.validateProductId(productId, validProductIds);
    if (!productIdValidation.valid) {
      return res.status(400).json({ error: productIdValidation.error });
    }
    
    const cart = cartDb.getCart(req.cartId);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    
    let items = cart.items.filter(
      item => item.productId !== productIdValidation.sanitizedId
    );
    
    cartDb.saveCart(req.cartId, items);
    
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ error: 'Failed to remove item from cart' });
  }
});

/**
 * DELETE /api/cart/clear
 * Clear all items from the cart
 */
app.delete('/api/cart/clear', (req, res) => {
  try {
    cartDb.saveCart(req.cartId, []);
    res.json({ success: true, items: [] });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

/**
 * POST /api/cart/sync
 * Sync cart from localStorage with server
 * Body: { items: [...] }
 */
app.post('/api/cart/sync', (req, res) => {
  try {
    const { items } = req.body;
    
    // Validate items array
    const validProductIds = productCatalog.getValidProductIds();
    const itemsValidation = CartValidators.validateCartItems(items, validProductIds);
    
    if (!itemsValidation.valid) {
      return res.status(400).json({ error: itemsValidation.error });
    }
    
    // Get server cart
    const serverCart = cartDb.getCart(req.cartId);
    const serverItems = serverCart ? serverCart.items : [];
    
    // Merge strategy: combine items, use maximum quantity for duplicates
    const mergedItemsMap = new Map();
    
    // Add server items first
    serverItems.forEach(item => {
      mergedItemsMap.set(item.productId, { ...item });
    });
    
    // Merge client items (prefer higher quantity)
    itemsValidation.sanitized.forEach(clientItem => {
      const existing = mergedItemsMap.get(clientItem.productId);
      if (existing) {
        // Use the higher quantity
        existing.quantity = Math.max(existing.quantity, clientItem.quantity);
      } else {
        mergedItemsMap.set(clientItem.productId, clientItem);
      }
    });
    
    const mergedItems = Array.from(mergedItemsMap.values());
    
    // Save merged cart
    cartDb.saveCart(req.cartId, mergedItems);
    
    res.json({ success: true, items: mergedItems });
  } catch (error) {
    console.error('Error syncing cart:', error);
    res.status(500).json({ error: 'Failed to sync cart' });
  }
});

/**
 * GET /api/products
 * Get list of available products
 */
app.get('/api/products', (req, res) => {
  try {
    const products = productCatalog.getAllProducts();
    res.json({ products });
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ error: 'Failed to get products' });
  }
});

/**
 * POST /api/admin/cleanup
 * Manually trigger cleanup of expired carts
 */
app.post('/api/admin/cleanup', (req, res) => {
  try {
    const days = req.body.days || 7;
    const deleted = cartDb.cleanupExpiredCarts(days);
    res.json({ 
      success: true, 
      deletedCarts: deleted,
      message: `Cleaned up ${deleted} expired cart(s)`
    });
  } catch (error) {
    console.error('Error cleaning up carts:', error);
    res.status(500).json({ error: 'Failed to cleanup carts' });
  }
});

/**
 * GET /api/admin/stats
 * Get cart statistics (for monitoring)
 */
app.get('/api/admin/stats', (req, res) => {
  try {
    const stats = cartDb.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start cleanup interval (runs every hour)
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
setInterval(() => {
  try {
    const deleted = cartDb.cleanupExpiredCarts(7);
    if (deleted > 0) {
      console.log(`[Cleanup] Removed ${deleted} expired cart(s)`);
    }
  } catch (error) {
    console.error('[Cleanup] Error in cleanup interval:', error);
  }
}, CLEANUP_INTERVAL);

// Run cleanup on startup
try {
  const deleted = cartDb.cleanupExpiredCarts(7);
  if (deleted > 0) {
    console.log(`[Startup] Cleaned up ${deleted} expired cart(s)`);
  }
} catch (error) {
  console.error('[Startup] Error during initial cleanup:', error);
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${NODE_ENV}`);
  console.log(`🔒 Secure cookies: ${IS_PRODUCTION ? 'enabled' : 'disabled (dev mode)'}`);
  console.log('✅ Persistent shopping cart system initialized');
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n🛑 Shutting down gracefully...');
  cartDb.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
