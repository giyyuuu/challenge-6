/**
 * Input validation utilities for cart operations
 * Production-ready validation with comprehensive checks
 */

class CartValidators {
  /**
   * Validate product ID format and existence
   * @param {string} productId - Product identifier
   * @param {Set<string>} validProductIds - Set of valid product IDs
   * @returns {Object} { valid: boolean, error?: string }
   */
  static validateProductId(productId, validProductIds) {
    if (!productId || typeof productId !== 'string') {
      return { valid: false, error: 'Product ID must be a non-empty string' };
    }

    // Sanitize: remove whitespace
    const sanitizedId = String(productId).trim();
    
    if (sanitizedId.length === 0) {
      return { valid: false, error: 'Product ID cannot be empty' };
    }

    // Check against valid product IDs if provided
    if (validProductIds && !validProductIds.has(sanitizedId)) {
      return { valid: false, error: 'Invalid product ID' };
    }

    // Additional security: prevent injection attempts
    if (sanitizedId.length > 100) {
      return { valid: false, error: 'Product ID exceeds maximum length' };
    }

    // Prevent SQL injection patterns (basic check)
    const dangerousPatterns = /[;'"\\]|--|\/\*|\*\/|xp_|sp_/i;
    if (dangerousPatterns.test(sanitizedId)) {
      return { valid: false, error: 'Invalid characters in product ID' };
    }

    return { valid: true, sanitizedId };
  }

  /**
   * Validate quantity
   * @param {number} quantity - Item quantity
   * @param {number} maxQuantity - Maximum allowed quantity per item
   * @returns {Object} { valid: boolean, error?: string, sanitized?: number }
   */
  static validateQuantity(quantity, maxQuantity = 999) {
    if (quantity === undefined || quantity === null) {
      return { valid: false, error: 'Quantity is required' };
    }

    const numQuantity = Number(quantity);

    // Check if it's a valid number
    if (isNaN(numQuantity) || !isFinite(numQuantity)) {
      return { valid: false, error: 'Quantity must be a valid number' };
    }

    // Prevent negative quantities
    if (numQuantity < 0) {
      return { valid: false, error: 'Quantity cannot be negative' };
    }

    // Prevent zero (use remove endpoint instead)
    if (numQuantity === 0) {
      return { valid: false, error: 'Quantity cannot be zero. Use remove endpoint to delete items' };
    }

    // Check maximum quantity
    if (numQuantity > maxQuantity) {
      return { valid: false, error: `Quantity cannot exceed ${maxQuantity}` };
    }

    // Ensure it's an integer
    const intQuantity = Math.floor(numQuantity);
    if (intQuantity !== numQuantity) {
      return { valid: false, error: 'Quantity must be an integer' };
    }

    return { valid: true, sanitized: intQuantity };
  }

  /**
   * Validate price
   * @param {number} price - Item price
   * @returns {Object} { valid: boolean, error?: string, sanitized?: number }
   */
  static validatePrice(price) {
    if (price === undefined || price === null) {
      return { valid: false, error: 'Price is required' };
    }

    const numPrice = Number(price);

    if (isNaN(numPrice) || !isFinite(numPrice)) {
      return { valid: false, error: 'Price must be a valid number' };
    }

    if (numPrice < 0) {
      return { valid: false, error: 'Price cannot be negative' };
    }

    if (numPrice > 1000000) {
      return { valid: false, error: 'Price exceeds maximum allowed value' };
    }

    // Round to 2 decimal places
    const sanitized = Math.round(numPrice * 100) / 100;

    return { valid: true, sanitized };
  }

  /**
   * Validate product name
   * @param {string} name - Product name
   * @returns {Object} { valid: boolean, error?: string, sanitized?: string }
   */
  static validateProductName(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Product name must be a non-empty string' };
    }

    const sanitized = String(name).trim();

    if (sanitized.length === 0) {
      return { valid: false, error: 'Product name cannot be empty' };
    }

    if (sanitized.length > 200) {
      return { valid: false, error: 'Product name exceeds maximum length' };
    }

    return { valid: true, sanitized };
  }

  /**
   * Validate cart item structure
   * @param {Object} item - Cart item object
   * @param {Set<string>} validProductIds - Set of valid product IDs
   * @returns {Object} { valid: boolean, error?: string, sanitized?: Object }
   */
  static validateCartItem(item, validProductIds) {
    if (!item || typeof item !== 'object') {
      return { valid: false, error: 'Cart item must be an object' };
    }

    // Validate product ID
    const productIdValidation = this.validateProductId(item.productId, validProductIds);
    if (!productIdValidation.valid) {
      return productIdValidation;
    }

    // Validate product name
    const nameValidation = this.validateProductName(item.name);
    if (!nameValidation.valid) {
      return nameValidation;
    }

    // Validate price
    const priceValidation = this.validatePrice(item.price);
    if (!priceValidation.valid) {
      return priceValidation;
    }

    // Validate quantity (default to 1 if not provided)
    const quantity = item.quantity !== undefined ? item.quantity : 1;
    const quantityValidation = this.validateQuantity(quantity);
    if (!quantityValidation.valid) {
      return quantityValidation;
    }

    // Validate image (optional)
    let image = null;
    if (item.image !== undefined && item.image !== null) {
      if (typeof item.image !== 'string' || item.image.length > 500) {
        return { valid: false, error: 'Invalid image format' };
      }
      image = String(item.image).trim() || null;
    }

    return {
      valid: true,
      sanitized: {
        productId: productIdValidation.sanitizedId,
        name: nameValidation.sanitized,
        price: priceValidation.sanitized,
        quantity: quantityValidation.sanitized,
        image
      }
    };
  }

  /**
   * Validate cart items array
   * @param {Array} items - Array of cart items
   * @param {Set<string>} validProductIds - Set of valid product IDs
   * @returns {Object} { valid: boolean, error?: string, sanitized?: Array }
   */
  static validateCartItems(items, validProductIds) {
    if (!Array.isArray(items)) {
      return { valid: false, error: 'Items must be an array' };
    }

    if (items.length > 100) {
      return { valid: false, error: 'Cart cannot contain more than 100 items' };
    }

    const sanitizedItems = [];
    const seenProductIds = new Set();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const validation = this.validateCartItem(item, validProductIds);

      if (!validation.valid) {
        return { valid: false, error: `Item at index ${i}: ${validation.error}` };
      }

      // Check for duplicate product IDs in the same cart
      if (seenProductIds.has(validation.sanitized.productId)) {
        return { valid: false, error: `Duplicate product ID: ${validation.sanitized.productId}` };
      }

      seenProductIds.add(validation.sanitized.productId);
      sanitizedItems.push(validation.sanitized);
    }

    return { valid: true, sanitized: sanitizedItems };
  }

  /**
   * Validate UUID format (for cart_id)
   * @param {string} uuid - UUID string
   * @returns {boolean}
   */
  static isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}

module.exports = CartValidators;

