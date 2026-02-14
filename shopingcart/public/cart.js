// Cart management with localStorage persistence
class CartManager {
  constructor() {
    this.storageKey = 'shopping_cart';
    this.syncInterval = null;
    this.init();
  }

  init() {
    // Load cart from localStorage on init
    this.loadFromLocalStorage();
    
    // Sync with server on page load
    this.syncWithServer();
    
    // Set up periodic sync (every 30 seconds)
    this.syncInterval = setInterval(() => {
      this.syncWithServer();
    }, 30000);
  }

  // Get cart from localStorage
  loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        // Check if cart is expired (7 days)
        if (data.timestamp && Date.now() - data.timestamp < 7 * 24 * 60 * 60 * 1000) {
          return data.items || [];
        } else {
          // Clear expired cart
          localStorage.removeItem(this.storageKey);
        }
      }
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
    }
    return [];
  }

  // Save cart to localStorage
  saveToLocalStorage(items) {
    try {
      const data = {
        items: items,
        timestamp: Date.now()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving cart to localStorage:', error);
    }
  }

  // Get cart from server
  async getCartFromServer() {
    try {
      const response = await fetch('/api/cart');
      if (response.ok) {
        const data = await response.json();
        return data.items || [];
      }
    } catch (error) {
      console.error('Error fetching cart from server:', error);
    }
    return [];
  }

  // Sync cart with server (merge strategy)
  async syncWithServer() {
    try {
      const localItems = this.loadFromLocalStorage();
      const serverItems = await this.getCartFromServer();
      
      // Send local cart to server for merging
      const response = await fetch('/api/cart/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ items: localItems })
      });
      
      if (response.ok) {
        const data = await response.json();
        // Update localStorage with merged cart
        this.saveToLocalStorage(data.items);
        return data.items;
      }
    } catch (error) {
      console.error('Error syncing cart:', error);
    }
    return this.loadFromLocalStorage();
  }

  // Add item to cart
  async addItem(product) {
    try {
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(product)
      });
      
      if (response.ok) {
        const data = await response.json();
        this.saveToLocalStorage(data.items);
        return data.items;
      }
    } catch (error) {
      console.error('Error adding item:', error);
    }
    return this.loadFromLocalStorage();
  }

  // Update item quantity
  async updateQuantity(productId, quantity) {
    try {
      const response = await fetch('/api/cart/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ productId, quantity })
      });
      
      if (response.ok) {
        const data = await response.json();
        this.saveToLocalStorage(data.items);
        return data.items;
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
    return this.loadFromLocalStorage();
  }

  // Remove item from cart
  async removeItem(productId) {
    try {
      const response = await fetch(`/api/cart/remove/${productId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        const data = await response.json();
        this.saveToLocalStorage(data.items);
        return data.items;
      }
    } catch (error) {
      console.error('Error removing item:', error);
    }
    return this.loadFromLocalStorage();
  }

  // Clear cart
  async clearCart() {
    try {
      const response = await fetch('/api/cart/clear', {
        method: 'DELETE'
      });
      
      if (response.ok) {
        this.saveToLocalStorage([]);
        return [];
      }
    } catch (error) {
      console.error('Error clearing cart:', error);
    }
    localStorage.removeItem(this.storageKey);
    return [];
  }

  // Get current cart items
  getItems() {
    return this.loadFromLocalStorage();
  }

  // Calculate total
  calculateTotal(items) {
    return items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  }

  // Get total quantity
  getTotalQuantity(items) {
    return items.reduce((total, item) => {
      return total + item.quantity;
    }, 0);
  }

  // Cleanup on page unload
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

// Export for use in other scripts
window.CartManager = CartManager;

