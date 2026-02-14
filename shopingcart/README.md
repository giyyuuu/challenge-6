# Production-Ready Persistent Shopping Cart System

A robust, secure, and scalable e-commerce shopping cart solution that solves the critical problem of cart data loss. This production-ready implementation ensures carts persist across browser sessions, server restarts, and supports multiple users seamlessly with comprehensive security and validation.

## 🎯 Features

✅ **Browser Persistence** - Cart survives browser close/reopen using localStorage  
✅ **Server Persistence** - Cart survives server restarts using SQLite database  
✅ **Multi-User Support** - Different browsers/sessions maintain separate carts via UUID-based cart_id  
✅ **Auto-Cleanup** - Cart items expire after 7 days of inactivity  
✅ **Security** - Input validation, secure cookies, XSS/CSRF protection  
✅ **Product Validation** - Validates product IDs against catalog  
✅ **Quantity Validation** - Prevents negative quantities and enforces limits  
✅ **Error Handling** - Comprehensive error handling and logging  

## 🔒 Security Features

- **Secure Cookies**: HttpOnly, SameSite, and Secure flags (production)
- **Input Validation**: Comprehensive validation for all inputs
- **SQL Injection Prevention**: Parameterized queries and input sanitization
- **XSS Protection**: Security headers and input sanitization
- **CSRF Protection**: SameSite cookie attribute
- **Product ID Validation**: Validates against product catalog
- **Quantity Limits**: Prevents negative quantities and enforces maximum limits

## 📋 Problem Solved

The original implementation stored cart data in server memory, causing:
- ❌ Cart loss when users close their browser
- ❌ Cart reset when server restarts
- ❌ No support for multiple users on different devices
- ❌ No mechanism to clean up old abandoned carts
- ❌ No input validation or security measures

## 🏗️ Solution Architecture

### Client-Side (Browser)
- **localStorage**: Stores cart data locally for immediate access
- **Automatic Sync**: Syncs with server every 30 seconds and on page load
- **Cart ID Cookie**: UUID-based cart identifier for multi-user support

### Server-Side
- **SQLite Database**: Persistent storage with WAL mode for concurrency
- **UUID Cart IDs**: Unique cart identifiers via secure cookies
- **Auto-Cleanup**: Background job removes carts inactive for 7+ days
- **RESTful API**: Clean, validated endpoints for all cart operations
- **Product Catalog**: Centralized product validation system

## 🚀 Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## 📡 API Endpoints

### Cart Operations

#### Get Cart
```
GET /api/cart
```
Returns the current user's cart items with metadata.

**Response:**
```json
{
  "items": [...],
  "lastUpdated": 1234567890,
  "itemCount": 3
}
```

#### Add Item
```
POST /api/cart/add
Content-Type: application/json

{
  "productId": "1",
  "name": "Laptop",
  "price": 999.99,
  "quantity": 1,
  "image": "💻"
}
```
Adds an item to the cart or updates quantity if item exists. Validates product ID, price, and quantity.

#### Update Item Quantity
```
PUT /api/cart/update
Content-Type: application/json

{
  "productId": "1",
  "quantity": 2
}
```
Updates the quantity of an item. Removes item if quantity is 0. Prevents negative quantities.

#### Remove Item
```
DELETE /api/cart/remove/:productId
```
Removes an item from the cart. Validates product ID format.

#### Clear Cart
```
DELETE /api/cart/clear
```
Clears all items from the cart.

#### Sync Cart
```
POST /api/cart/sync
Content-Type: application/json

{
  "items": [...]
}
```
Merges client-side cart with server-side cart. Validates all items before merging.

### Product Operations

#### Get Products
```
GET /api/products
```
Returns list of available products from the catalog.

### Admin Operations

#### Cleanup Expired Carts
```
POST /api/admin/cleanup
Content-Type: application/json

{
  "days": 7
}
```
Manually trigger cleanup of carts older than specified days (default: 7).

#### Get Statistics
```
GET /api/admin/stats
```
Returns cart statistics (total carts, total items, oldest cart timestamp).

## 🔐 Security Implementation

### Cookie Security

```javascript
{
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
  httpOnly: true,                    // Prevents XSS
  sameSite: 'lax',                   // CSRF protection
  secure: IS_PRODUCTION              // HTTPS only in production
}
```

### Input Validation

All inputs are validated using the `CartValidators` class:
- Product ID format and existence
- Quantity limits (1-999, no negatives)
- Price validation (non-negative, reasonable max)
- Product name sanitization
- Array size limits (max 100 items per cart)

### Security Headers

```javascript
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
```

## 📊 Database Schema

See [SCHEMA.md](./SCHEMA.md) for detailed schema documentation.

**Key Points:**
- Uses UUID-based `cart_id` as primary key
- JSON storage for flexible cart data
- Indexed queries for performance
- WAL mode for better concurrency
- Automatic cleanup of expired carts

## 🔄 How It Works

### Session Management
- Each user gets a unique UUID-based `cart_id` stored in a secure cookie
- Cart ID persists for 7 days
- Different browsers/devices get different cart IDs
- Invalid UUIDs are rejected and new ones are generated

### Data Persistence Flow

1. **User adds item**: 
   - Input validated (product ID, price, quantity)
   - Item saved to localStorage immediately
   - Item sent to server and validated again
   - Saved to database with timestamp
   - Both stores updated

2. **User closes browser**:
   - Cart data remains in localStorage
   - Cart data remains in server database
   - Cart ID cookie persists

3. **User returns**:
   - Cart ID retrieved from cookie
   - Cart loaded from localStorage (instant)
   - Cart synced with server (merges any differences)
   - Updated cart saved to both stores

4. **Server restart**:
   - Database persists on disk
   - All cart data survives restart
   - Users can continue shopping seamlessly

### Auto-Cleanup
- Background job runs every hour
- Removes carts with no activity for 7+ days
- Runs on server startup
- Prevents database bloat from abandoned carts
- Can be triggered manually via admin endpoint

## 🧪 Testing the Persistence

1. **Browser Persistence Test**:
   - Add items to cart
   - Close browser completely
   - Reopen browser and navigate to the site
   - Cart should still be there!

2. **Server Restart Test**:
   - Add items to cart
   - Stop the server (Ctrl+C)
   - Restart the server
   - Refresh browser
   - Cart should still be there!

3. **Multi-User Test**:
   - Open site in two different browsers
   - Add different items in each
   - Each browser maintains its own cart

4. **Validation Test**:
   - Try adding item with negative quantity → Should fail
   - Try adding invalid product ID → Should fail
   - Try adding item with negative price → Should fail

5. **Auto-Cleanup Test**:
   - Wait 7 days (or modify cleanup interval in code)
   - Old carts will be automatically removed

## 📁 File Structure

```
shopingcart/
├── server.js              # Express server with security & validation
├── database.js            # SQLite database operations (production-ready)
├── validators.js          # Input validation utilities
├── product-catalog.js     # Product catalog manager
├── package.json           # Dependencies and scripts
├── SCHEMA.md              # Database schema documentation
├── README.md              # This file
└── public/
    ├── index.html         # Main HTML page
    ├── styles.css         # Styling
    ├── cart.js            # Cart management with localStorage
    └── app.js             # Frontend application logic
```

## 🔧 Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (`development` or `production`)

### Production Deployment

1. Set `NODE_ENV=production` for secure cookies
2. Use HTTPS (required for secure cookie flag)
3. Configure database backup strategy
4. Set up monitoring for cart statistics
5. Configure log aggregation

## 🚦 Validation Rules

### Product ID
- Must be non-empty string
- Must exist in product catalog
- Max length: 100 characters
- No SQL injection patterns

### Quantity
- Must be positive integer
- Range: 1-999
- Cannot be zero (use remove endpoint)
- Cannot be negative

### Price
- Must be non-negative number
- Max value: 1,000,000
- Rounded to 2 decimal places

### Product Name
- Must be non-empty string
- Max length: 200 characters
- Trimmed of whitespace

### Cart Items
- Max 100 items per cart
- No duplicate product IDs
- All items validated before saving

## 📈 Performance

- **WAL Mode**: Enables concurrent reads
- **Indexed Queries**: Fast lookups by cart_id and last_updated
- **Item Count Caching**: Avoids parsing JSON for count operations
- **Efficient Cleanup**: Indexed queries for expired cart removal

## 🔮 Future Enhancements

- User authentication integration
- Cart sharing between devices
- Cart recovery via email
- Analytics and cart abandonment tracking
- Redis caching for better performance
- Cart expiration notifications
- Rate limiting for API endpoints
- Request logging and monitoring
- PostgreSQL migration path

## 📝 License

ISC
