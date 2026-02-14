const Database = require('better-sqlite3');
const path = require('path');

class CartDatabase {
  constructor() {
    const dbPath = path.join(__dirname, 'carts.db');
    this.db = new Database(dbPath);
    this.initDatabase();
  }

  initDatabase() {
    // Create carts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS carts (
        session_id TEXT PRIMARY KEY,
        cart_data TEXT NOT NULL,
        last_updated INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_last_updated ON carts(last_updated);
    `);
  }

  // Save or update cart
  saveCart(sessionId, cartData) {
    const now = Date.now();
    const cartJson = JSON.stringify(cartData);
    
    const stmt = this.db.prepare(`
      INSERT INTO carts (session_id, cart_data, last_updated, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        cart_data = ?,
        last_updated = ?
    `);
    
    stmt.run(sessionId, cartJson, now, now, cartJson, now);
  }

  // Get cart by session ID
  getCart(sessionId) {
    const stmt = this.db.prepare('SELECT cart_data, last_updated FROM carts WHERE session_id = ?');
    const row = stmt.get(sessionId);
    
    if (!row) {
      return null;
    }
    
    return {
      items: JSON.parse(row.cart_data),
      lastUpdated: row.last_updated
    };
  }

  // Delete cart
  deleteCart(sessionId) {
    const stmt = this.db.prepare('DELETE FROM carts WHERE session_id = ?');
    stmt.run(sessionId);
  }

  // Clean up carts older than 7 days
  cleanupExpiredCarts() {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const stmt = this.db.prepare('DELETE FROM carts WHERE last_updated < ?');
    const result = stmt.run(sevenDaysAgo);
    return result.changes;
  }

  // Get all carts (for debugging/admin purposes)
  getAllCarts() {
    const stmt = this.db.prepare('SELECT session_id, cart_data, last_updated FROM carts');
    return stmt.all();
  }

  close() {
    this.db.close();
  }
}

module.exports = CartDatabase;

