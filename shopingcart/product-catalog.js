/**
 * Product Catalog Manager
 * Manages valid product IDs and product information
 * In production, this would typically connect to a product database
 */

class ProductCatalog {
  constructor() {
    // In-memory product catalog
    // In production, this would be loaded from a database
    this.products = new Map([
      ['1', { productId: '1', name: 'Laptop', price: 999.99, image: '💻' }],
      ['2', { productId: '2', name: 'Smartphone', price: 699.99, image: '📱' }],
      ['3', { productId: '3', name: 'Headphones', price: 199.99, image: '🎧' }],
      ['4', { productId: '4', name: 'Keyboard', price: 149.99, image: '⌨️' }],
      ['5', { productId: '5', name: 'Monitor', price: 299.99, image: '🖥️' }],
      ['6', { productId: '6', name: 'Mouse', price: 49.99, image: '🖱️' }],
      ['7', { productId: '7', name: 'Webcam', price: 79.99, image: '📹' }],
      ['8', { productId: '8', name: 'Speaker', price: 129.99, image: '🔊' }]
    ]);

    // Create Set of valid product IDs for fast lookup
    this.validProductIds = new Set(this.products.keys());
  }

  /**
   * Get all valid product IDs
   * @returns {Set<string>}
   */
  getValidProductIds() {
    return this.validProductIds;
  }

  /**
   * Check if product ID is valid
   * @param {string} productId
   * @returns {boolean}
   */
  isValidProductId(productId) {
    return this.validProductIds.has(productId);
  }

  /**
   * Get product information
   * @param {string} productId
   * @returns {Object|null}
   */
  getProduct(productId) {
    return this.products.get(productId) || null;
  }

  /**
   * Get all products
   * @returns {Array}
   */
  getAllProducts() {
    return Array.from(this.products.values());
  }

  /**
   * Add or update product (for admin use)
   * @param {string} productId
   * @param {Object} productData
   */
  addProduct(productId, productData) {
    this.products.set(productId, { ...productData, productId });
    this.validProductIds.add(productId);
  }
}

module.exports = ProductCatalog;

