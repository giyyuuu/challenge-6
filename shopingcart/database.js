const Database = require('better-sqlite3');
const path = require('path');

/**
 * Production-ready Cart Database Manager
 * Handles persistent storage of shopping carts using SQLite
 */
class CartDatabase {
  constructor(dbPath = null) {
    const finalPath = dbPath || path.join(__dirname, 'carts.db');
    this.db = new Database(finalPath);
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    // Set busy timeout for better concurrency handling
    this.db.pragma('busy_timeout = 5000');
    
    this.initDatabase();
  }

  /**
   * Initialize database schema
   * Creates tables and indexes for optimal performance
   */
  initDatabase() {
    this.db.exec(`
      -- Main carts table
      -- Uses cart_id (UUID) as primary key for multi-user support
      CREATE TABLE IF NOT EXISTS carts (
        cart_id TEXT PRIMARY KEY,
        cart_data TEXT NOT NULL,
        last_updated INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        item_count INTEGER NOT NULL DEFAULT 0
      );
      
      -- Index for cleanup operations (queries by last_updated)
      CREATE INDEX IF NOT EXISTS idx_last_updated ON carts(last_updated);
      
      -- Index for item count queries (optional, for analytics)
      CREATE INDEX IF NOT EXISTS idx_item_count ON carts(item_count);
    `);
  }

  /**
   * Save or update cart
   * @param {string} cartId - UUID cart identifier
   * @param {Array} cartData - Array of cart items
   * @returns {boolean} Success status
   */
  saveCart(cartId, cartData) {
    try {
      const now = Date.now();
      const cartJson = JSON.stringify(cartData);
      const itemCount = Array.isArray(cartData) ? cartData.length : 0;
      
      const stmt = this.db.prepare(`
        INSERT INTO carts (cart_id, cart_data, last_updated, created_at, item_count)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(cart_id) DO UPDATE SET
          cart_data = ?,
          last_updated = ?,
          item_count = ?
      `);
      
      stmt.run(cartId, cartJson, now, now, itemCount, cartJson, now, itemCount);
      return true;
    } catch (error) {
      console.error('Error saving cart:', error);
      throw new Error('Failed to save cart to database');
    }
  }

  /**
   * Get cart by cart ID
   * @param {string} cartId - UUID cart identifier
   * @returns {Object|null} Cart object with items and metadata
   */
  getCart(cartId) {
    try {
      const stmt = this.db.prepare(`
        SELECT cart_data, last_updated, created_at, item_count 
        FROM carts 
        WHERE cart_id = ?
      `);
      const row = stmt.get(cartId);
      
      if (!row) {
        return null;
      }
      
      return {
        items: JSON.parse(row.cart_data),
        lastUpdated: row.last_updated,
        createdAt: row.created_at,
        itemCount: row.item_count
      };
    } catch (error) {
      console.error('Error getting cart:', error);
      throw new Error('Failed to retrieve cart from database');
    }
  }

  /**
   * Delete cart
   * @param {string} cartId - UUID cart identifier
   * @returns {boolean} Success status
   */
  deleteCart(cartId) {
    try {
      const stmt = this.db.prepare('DELETE FROM carts WHERE cart_id = ?');
      const result = stmt.run(cartId);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting cart:', error);
      throw new Error('Failed to delete cart from database');
    }
  }

  /**
   * Clean up carts older than specified days
   * @param {number} days - Number of days of inactivity before cleanup (default: 7)
   * @returns {number} Number of carts deleted
   */
  cleanupExpiredCarts(days = 7) {
    try {
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      const stmt = this.db.prepare('DELETE FROM carts WHERE last_updated < ?');
      const result = stmt.run(cutoffTime);
      return result.changes;
    } catch (error) {
      console.error('Error cleaning up expired carts:', error);
      throw new Error('Failed to cleanup expired carts');
    }
  }

  /**
   * Get statistics about carts
   * @returns {Object} Statistics object
   */
  getStatistics() {
    try {
      const totalCarts = this.db.prepare('SELECT COUNT(*) as count FROM carts').get();
      const totalItems = this.db.prepare('SELECT SUM(item_count) as total FROM carts').get();
      const oldestCart = this.db.prepare('SELECT MIN(last_updated) as oldest FROM carts').get();
      
      return {
        totalCarts: totalCarts?.count || 0,
        totalItems: totalItems?.total || 0,
        oldestCartTimestamp: oldestCart?.oldest || null
      };
    } catch (error) {
      console.error('Error getting statistics:', error);
      return { totalCarts: 0, totalItems: 0, oldestCartTimestamp: null };
    }
  }

  /**
   * Get all carts (for admin/debugging purposes)
   * @param {number} limit - Maximum number of carts to return
   * @returns {Array} Array of cart records
   */
  getAllCarts(limit = 100) {
    try {
      const stmt = this.db.prepare(`
        SELECT cart_id, cart_data, last_updated, created_at, item_count 
        FROM carts 
        ORDER BY last_updated DESC 
        LIMIT ?
      `);
      return stmt.all(limit);
    } catch (error) {
      console.error('Error getting all carts:', error);
      return [];
    }
  }

  /**
   * Close database connection
   */
  close() {
    try {
      this.db.close();
    } catch (error) {
      console.error('Error closing database:', error);
    }
  }
}

module.exports = CartDatabase;

