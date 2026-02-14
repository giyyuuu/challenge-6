// Products array (loaded from API)
let products = [];

// Initialize cart manager
const cartManager = new CartManager();

// DOM elements
const productsGrid = document.getElementById('productsGrid');
const cartItems = document.getElementById('cartItems');
const cartCount = document.getElementById('cartCount');
const cartTotal = document.getElementById('cartTotal');
const cartFooter = document.getElementById('cartFooter');
const clearCartBtn = document.getElementById('clearCartBtn');

// Load products from API
async function loadProducts() {
  try {
    const response = await fetch('/api/products');
    if (response.ok) {
      const data = await response.json();
      products = data.products || [];
      renderProducts();
    } else {
      console.error('Failed to load products');
      // Fallback to empty array
      products = [];
      renderProducts();
    }
  } catch (error) {
    console.error('Error loading products:', error);
    products = [];
    renderProducts();
  }
}

// Initialize app
async function init() {
  // Load products first
  await loadProducts();
  renderCart();
  
  // Set up event listeners
  clearCartBtn.addEventListener('click', handleClearCart);
  
  // Sync cart on page visibility change
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      cartManager.syncWithServer().then(() => renderCart());
    }
  });
  
  // Sync cart before page unload
  window.addEventListener('beforeunload', () => {
    cartManager.syncWithServer();
  });
}

// Render products
function renderProducts() {
  productsGrid.innerHTML = products.map(product => `
    <div class="product-card">
      <div class="product-image">${product.image}</div>
      <div class="product-name">${product.name}</div>
      <div class="product-price">$${product.price.toFixed(2)}</div>
      <button class="btn btn-add" onclick="handleAddToCart('${product.productId}')">
        Add to Cart
      </button>
    </div>
  `).join('');
}

// Render cart
function renderCart() {
  const items = cartManager.getItems();
  const total = cartManager.calculateTotal(items);
  const totalQuantity = cartManager.getTotalQuantity(items);
  
  // Update cart count
  cartCount.textContent = totalQuantity;
  
  // Update cart total
  cartTotal.textContent = total.toFixed(2);
  
  // Show/hide footer
  cartFooter.style.display = items.length > 0 ? 'block' : 'none';
  
  // Render cart items
  if (items.length === 0) {
    cartItems.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
  } else {
    cartItems.innerHTML = items.map(item => `
      <div class="cart-item">
        <div class="cart-item-image">${item.image || '📦'}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">$${item.price.toFixed(2)}</div>
        </div>
        <div class="quantity-controls">
          <button class="quantity-btn" onclick="handleDecreaseQuantity('${item.productId}')">-</button>
          <span class="quantity-display">${item.quantity}</span>
          <button class="quantity-btn" onclick="handleIncreaseQuantity('${item.productId}')">+</button>
        </div>
        <button class="remove-btn" onclick="handleRemoveItem('${item.productId}')">Remove</button>
      </div>
    `).join('');
  }
}

// Handle add to cart
async function handleAddToCart(productId) {
  const product = products.find(p => p.productId === productId);
  if (!product) return;
  
  showStatus('Adding to cart...', false);
  
  const items = await cartManager.addItem({
    productId: product.productId,
    name: product.name,
    price: product.price,
    quantity: 1,
    image: product.image
  });
  
  renderCart();
  showStatus('Item added to cart!', true);
}

// Handle increase quantity
async function handleIncreaseQuantity(productId) {
  const items = cartManager.getItems();
  const item = items.find(i => i.productId === productId);
  if (!item) return;
  
  const newItems = await cartManager.updateQuantity(productId, item.quantity + 1);
  renderCart();
  showStatus('Cart updated!', true);
}

// Handle decrease quantity
async function handleDecreaseQuantity(productId) {
  const items = cartManager.getItems();
  const item = items.find(i => i.productId === productId);
  if (!item) return;
  
  const newQuantity = item.quantity - 1;
  const newItems = await cartManager.updateQuantity(productId, newQuantity);
  renderCart();
  showStatus('Cart updated!', true);
}

// Handle remove item
async function handleRemoveItem(productId) {
  const newItems = await cartManager.removeItem(productId);
  renderCart();
  showStatus('Item removed from cart!', true);
}

// Handle clear cart
async function handleClearCart() {
  if (!confirm('Are you sure you want to clear your cart?')) {
    return;
  }
  
  await cartManager.clearCart();
  renderCart();
  showStatus('Cart cleared!', true);
}

// Show status message
function showStatus(message, isSuccess = true) {
  const statusEl = document.getElementById('statusMessage');
  statusEl.textContent = message;
  statusEl.className = `status-message ${isSuccess ? '' : 'error'} show`;
  
  setTimeout(() => {
    statusEl.classList.remove('show');
  }, 2000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

