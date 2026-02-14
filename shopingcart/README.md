# Persistent Shopping Cart System

A robust e-commerce shopping cart solution that solves the critical problem of cart data loss. This implementation ensures carts persist across browser sessions, server restarts, and supports multiple users seamlessly.

## Features

✅ **Browser Persistence** - Cart survives browser close/reopen using localStorage  
✅ **Server Persistence** - Cart survives server restarts using SQLite database  
✅ **Multi-User Support** - Different browsers/sessions maintain separate carts via session IDs  
✅ **Auto-Cleanup** - Cart items expire after 7 days of inactivity  

## Problem Solved

The original implementation stored cart data in server memory, causing:
- Cart loss when users close their browser
- Cart reset when server restarts
- No support for multiple users on different devices
- No mechanism to clean up old abandoned carts

## Solution Architecture

### Client-Side (Browser)
- **localStorage**: Stores cart data locally for immediate access
- **Automatic Sync**: Syncs with server every 30 seconds and on page load
- **Session Cookie**: Maintains session ID for user identification

### Server-Side
- **SQLite Database**: Persistent storage for all cart data
- **Session Management**: Unique session IDs via cookies
- **Auto-Cleanup**: Background job removes carts inactive for 7+ days
- **RESTful API**: Clean endpoints for all cart operations

## Installation

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

## API Endpoints

### Get Cart
```
GET /api/cart
```
Returns the current user's cart items.

### Add Item
```
POST /api/cart/add
Body: { productId, name, price, quantity?, image? }
```
Adds an item to the cart or updates quantity if item exists.

### Update Item Quantity
```
PUT /api/cart/update
Body: { productId, quantity }
```
Updates the quantity of an item. Removes item if quantity is 0.

### Remove Item
```
DELETE /api/cart/remove/:productId
```
Removes an item from the cart.

### Clear Cart
```
DELETE /api/cart/clear
```
Clears all items from the cart.

### Sync Cart
```
POST /api/cart/sync
Body: { items: [...] }
```
Merges client-side cart with server-side cart.

### Cleanup Expired Carts (Admin)
```
POST /api/admin/cleanup
```
Manually trigger cleanup of carts older than 7 days.

## How It Works

### Session Management
- Each user gets a unique session ID stored in a cookie
- Session ID persists for 7 days
- Different browsers/devices get different session IDs

### Data Persistence Flow

1. **User adds item**: 
   - Item saved to localStorage immediately
   - Item sent to server and saved to database
   - Both stores updated

2. **User closes browser**:
   - Cart data remains in localStorage
   - Cart data remains in server database

3. **User returns**:
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
- Prevents database bloat from abandoned carts

## Database Schema

```sql
CREATE TABLE carts (
  session_id TEXT PRIMARY KEY,
  cart_data TEXT NOT NULL,        -- JSON array of items
  last_updated INTEGER NOT NULL,  -- Unix timestamp
  created_at INTEGER NOT NULL     -- Unix timestamp
);
```

## Technical Stack

- **Backend**: Node.js + Express
- **Database**: SQLite (better-sqlite3)
- **Frontend**: Vanilla JavaScript (no framework dependencies)
- **Storage**: localStorage + SQLite

## Testing the Persistence

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

4. **Auto-Cleanup Test**:
   - Wait 7 days (or modify cleanup interval in code)
   - Old carts will be automatically removed

## File Structure

```
shopingcart/
├── server.js          # Express server and API routes
├── database.js         # SQLite database operations
├── package.json        # Dependencies and scripts
├── public/
│   ├── index.html     # Main HTML page
│   ├── styles.css     # Styling
│   ├── cart.js        # Cart management with localStorage
│   └── app.js         # Frontend application logic
└── README.md          # This file
```

## Future Enhancements

- User authentication integration
- Cart sharing between devices
- Cart recovery via email
- Analytics and cart abandonment tracking
- Redis caching for better performance
- Cart expiration notifications

## License

ISC

