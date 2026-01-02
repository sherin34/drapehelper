// Global state
let products = [];
let orders = [];
let currentEditProductId = null;
let currentEditOrderId = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadOrders();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Product upload
    document.getElementById('product-upload').addEventListener('change', handleProductUpload);

    // Order form
    document.getElementById('order-form').addEventListener('submit', handleOrderSubmit);

    // Edit product form
    document.getElementById('edit-product-form').addEventListener('submit', handleEditProductSubmit);

    // Edit order form
    document.getElementById('edit-order-form').addEventListener('submit', handleEditOrderSubmit);

    // Product code change for profit calculation
    document.getElementById('order-productcode').addEventListener('change', calculateProfit);
    document.getElementById('order-price').addEventListener('input', calculateProfit);
}

// Navigation
function showSection(section) {
    const sections = document.querySelectorAll('.content-section');
    const navBtns = document.querySelectorAll('.nav-btn');

    sections.forEach(s => s.classList.remove('active'));
    navBtns.forEach(btn => btn.classList.remove('active'));

    document.getElementById(`${section}-section`).classList.add('active');
    event.target.classList.add('active');

    if (section === 'orders') {
        populateProductDropdowns();
    }
}

// Load products from server
async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        products = await response.json();
        renderProducts();
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

// Render products table
function renderProducts() {
    const tbody = document.getElementById('products-tbody');

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">No products loaded. Upload an Excel file to get started.</td></tr>';
        return;
    }

    tbody.innerHTML = products.map(product => `
        <tr>
            <td>${product.sellercode}</td>
            <td>${product.ourcode}</td>
            <td>
                ${product.imageurl ? `<img src="${product.imageurl}" alt="Product" class="product-image" onclick="viewImage('${product.imageurl}')" onerror="this.style.display='none'">` : 'N/A'}
            </td>
            <td>
                ${product.url ? `<a href="${product.url}" target="_blank" class="product-link">View</a>` : 'N/A'}
            </td>
            <td>₹${parseFloat(product.sellerprice).toFixed(2)}</td>
            <td>₹${parseFloat(product.ourprice).toFixed(2)}</td>
            <td>${parseFloat(product.profitmargin).toFixed(2)}%</td>
            <td>
                <span class="availability-badge ${getAvailabilityClass(product.availability)}">
                    ${product.availability || 'Unknown'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-edit" onclick="editProduct(${product.id})">Edit</button>
                    <button class="btn btn-secondary" onclick="checkSingleAvailability(${product.id})">Check Stock</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Handle product upload
async function handleProductUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/products/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            alert(`Successfully uploaded ${result.count} products!`);
            await loadProducts();
            populateProductDropdowns();
        } else {
            alert('Error uploading file: ' + result.error);
        }
    } catch (error) {
        console.error('Error uploading file:', error);
        alert('Error uploading file. Please try again.');
    }

    event.target.value = '';
}

// Download products as Excel
async function downloadProducts() {
    try {
        const response = await fetch('/api/products/download');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'products.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Error downloading products:', error);
        alert('Error downloading products. Please try again.');
    }
}

// Edit product
function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    currentEditProductId = id;

    document.getElementById('edit-product-id').value = id;
    document.getElementById('edit-sellercode').value = product.sellercode;
    document.getElementById('edit-ourcode').value = product.ourcode;
    document.getElementById('edit-imageurl').value = product.imageurl || '';
    document.getElementById('edit-url').value = product.url;
    document.getElementById('edit-sellerprice').value = product.sellerprice;
    document.getElementById('edit-ourprice').value = product.ourprice;
    document.getElementById('edit-profitmargin').value = parseFloat(product.profitmargin).toFixed(2);

    document.getElementById('edit-product-modal').style.display = 'block';
}

// Handle edit product submit
async function handleEditProductSubmit(event) {
    event.preventDefault();

    const id = currentEditProductId;
    const updatedProduct = {
        sellercode: document.getElementById('edit-sellercode').value,
        ourcode: document.getElementById('edit-ourcode').value,
        imageurl: document.getElementById('edit-imageurl').value,
        url: document.getElementById('edit-url').value,
        sellerprice: parseFloat(document.getElementById('edit-sellerprice').value),
        ourprice: parseFloat(document.getElementById('edit-ourprice').value),
        profitmargin: parseFloat(document.getElementById('edit-profitmargin').value)
    };

    try {
        const response = await fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedProduct)
        });

        const result = await response.json();

        if (result.success) {
            alert('Product updated successfully!');
            await loadProducts();
            closeEditProductModal();
        } else {
            alert('Error updating product: ' + result.error);
        }
    } catch (error) {
        console.error('Error updating product:', error);
        alert('Error updating product. Please try again.');
    }
}

// Close edit product modal
function closeEditProductModal() {
    document.getElementById('edit-product-modal').style.display = 'none';
    currentEditProductId = null;
}

// Load orders from server
async function loadOrders() {
    try {
        const response = await fetch('/api/orders');
        orders = await response.json();
        renderOrders();
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

// Render orders table
function renderOrders() {
    const tbody = document.getElementById('orders-tbody');

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="no-data">No orders yet. Add a new order to get started.</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>${order.slno}</td>
            <td>${order.orderid}</td>
            <td>${order.productcode}</td>
            <td>${order.date}</td>
            <td>₹${parseFloat(order.price).toFixed(2)}</td>
            <td>₹${parseFloat(order.profitamount).toFixed(2)}</td>
            <td>${order.buyername}</td>
            <td><span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span></td>
            <td>${order.notes || '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-edit" onclick="editOrder(${order.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteOrder(${order.id})">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Show add order form
function showAddOrderForm() {
    document.getElementById('add-order-form').style.display = 'block';
    document.getElementById('order-form').reset();

    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('order-date').value = today;

    populateProductDropdowns();
}

// Hide add order form
function hideAddOrderForm() {
    document.getElementById('add-order-form').style.display = 'none';
}

// Populate product dropdowns
function populateProductDropdowns() {
    const addSelect = document.getElementById('order-productcode');
    const editSelect = document.getElementById('edit-order-productcode');

    const options = products.map(p =>
        `<option value="${p.ourcode}" data-margin="${p.profitmargin}" data-ourprice="${p.ourprice}">${p.ourcode} - ${p.sellercode}</option>`
    ).join('');

    addSelect.innerHTML = '<option value="">Select Product</option>' + options;
    editSelect.innerHTML = '<option value="">Select Product</option>' + options;
}

// Calculate profit automatically
function calculateProfit() {
    const select = document.getElementById('order-productcode');
    const priceInput = document.getElementById('order-price');
    const profitInput = document.getElementById('order-profitamount');

    const selectedOption = select.options[select.selectedIndex];
    const price = parseFloat(priceInput.value) || 0;

    if (selectedOption && selectedOption.value) {
        const ourPrice = parseFloat(selectedOption.dataset.ourprice) || 0;
        const profitAmount = price - ourPrice;
        profitInput.value = profitAmount.toFixed(2);
    }
}

// Handle order submit
async function handleOrderSubmit(event) {
    event.preventDefault();

    const newOrder = {
        slno: document.getElementById('order-slno').value,
        orderid: document.getElementById('order-orderid').value,
        productcode: document.getElementById('order-productcode').value,
        date: document.getElementById('order-date').value,
        price: parseFloat(document.getElementById('order-price').value),
        profitamount: parseFloat(document.getElementById('order-profitamount').value),
        buyername: document.getElementById('order-buyername').value,
        status: document.getElementById('order-status').value,
        notes: document.getElementById('order-notes').value
    };

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newOrder)
        });

        const result = await response.json();

        if (result.success) {
            alert('Order created successfully!');
            await loadOrders();
            hideAddOrderForm();
        } else {
            alert('Error creating order: ' + result.error);
        }
    } catch (error) {
        console.error('Error creating order:', error);
        alert('Error creating order. Please try again.');
    }
}

// Edit order
function editOrder(id) {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    currentEditOrderId = id;

    document.getElementById('edit-order-id').value = id;
    document.getElementById('edit-order-slno').value = order.slno;
    document.getElementById('edit-order-orderid').value = order.orderid;
    document.getElementById('edit-order-productcode').value = order.productcode;
    document.getElementById('edit-order-date').value = order.date;
    document.getElementById('edit-order-price').value = order.price;
    document.getElementById('edit-order-profitamount').value = order.profitamount;
    document.getElementById('edit-order-buyername').value = order.buyername;
    document.getElementById('edit-order-status').value = order.status;
    document.getElementById('edit-order-notes').value = order.notes || '';

    populateProductDropdowns();
    document.getElementById('edit-order-modal').style.display = 'block';
}

// Handle edit order submit
async function handleEditOrderSubmit(event) {
    event.preventDefault();

    const id = currentEditOrderId;
    const updatedOrder = {
        slno: document.getElementById('edit-order-slno').value,
        orderid: document.getElementById('edit-order-orderid').value,
        productcode: document.getElementById('edit-order-productcode').value,
        date: document.getElementById('edit-order-date').value,
        price: parseFloat(document.getElementById('edit-order-price').value),
        profitamount: parseFloat(document.getElementById('edit-order-profitamount').value),
        buyername: document.getElementById('edit-order-buyername').value,
        status: document.getElementById('edit-order-status').value,
        notes: document.getElementById('edit-order-notes').value
    };

    try {
        const response = await fetch(`/api/orders/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedOrder)
        });

        const result = await response.json();

        if (result.success) {
            alert('Order updated successfully!');
            await loadOrders();
            closeEditOrderModal();
        } else {
            alert('Error updating order: ' + result.error);
        }
    } catch (error) {
        console.error('Error updating order:', error);
        alert('Error updating order. Please try again.');
    }
}

// Close edit order modal
function closeEditOrderModal() {
    document.getElementById('edit-order-modal').style.display = 'none';
    currentEditOrderId = null;
}

// Delete order
async function deleteOrder(id) {
    if (!confirm('Are you sure you want to delete this order?')) {
        return;
    }

    try {
        const response = await fetch(`/api/orders/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            alert('Order deleted successfully!');
            await loadOrders();
        } else {
            alert('Error deleting order: ' + result.error);
        }
    } catch (error) {
        console.error('Error deleting order:', error);
        alert('Error deleting order. Please try again.');
    }
}

// Download orders as Excel
async function downloadOrders() {
    try {
        const response = await fetch('/api/orders/download');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'orders.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Error downloading orders:', error);
        alert('Error downloading orders. Please try again.');
    }
}

// View full-size image
function viewImage(imageSrc) {
    const modal = document.getElementById('image-viewer-modal');
    const img = document.getElementById('full-size-image');
    img.src = imageSrc;
    modal.style.display = 'block';
}

// Close image viewer
function closeImageViewer() {
    document.getElementById('image-viewer-modal').style.display = 'none';
}

// Close modals when clicking outside
window.onclick = function(event) {
    const productModal = document.getElementById('edit-product-modal');
    const orderModal = document.getElementById('edit-order-modal');
    const imageModal = document.getElementById('image-viewer-modal');

    if (event.target === productModal) {
        closeEditProductModal();
    }
    if (event.target === orderModal) {
        closeEditOrderModal();
    }
    if (event.target === imageModal) {
        closeImageViewer();
    }
}

// Get availability badge class
function getAvailabilityClass(availability) {
    if (!availability || availability === 'Unknown') return 'availability-unknown';
    if (availability === 'Available') return 'availability-available';
    if (availability === 'Out of Stock') return 'availability-out-of-stock';
    if (availability === 'Check Failed' || availability === 'No URL') return 'availability-error';
    return 'availability-unknown';
}

// Show loading screen
function showLoading(message = 'Loading...', progress = '') {
    const loadingScreen = document.getElementById('loading-screen');
    const loadingMessage = document.getElementById('loading-message');
    const loadingProgress = document.getElementById('loading-progress');

    loadingMessage.textContent = message;
    loadingProgress.textContent = progress;
    loadingScreen.style.display = 'flex';
}

// Hide loading screen
function hideLoading() {
    document.getElementById('loading-screen').style.display = 'none';
}

// Check single product availability
async function checkSingleAvailability(id) {
    showLoading('Checking product availability...');

    try {
        const response = await fetch(`/api/products/check-availability/${id}`, {
            method: 'POST'
        });

        const result = await response.json();

        hideLoading();

        if (result.success) {
            alert(`Availability checked: ${result.availability}`);
            await loadProducts();
        } else {
            alert('Error checking availability: ' + result.error);
        }
    } catch (error) {
        hideLoading();
        console.error('Error checking availability:', error);
        alert('Error checking availability. Please try again.');
    }
}

// Check all products availability
async function checkAllAvailability() {
    if (!confirm('This will check availability for all products. It may take a while. Continue?')) {
        return;
    }

    const totalProducts = products.length;
    showLoading('Checking all products availability...', `Starting check for ${totalProducts} products...`);

    try {
        const response = await fetch('/api/products/check-all-availability', {
            method: 'POST'
        });

        const result = await response.json();

        hideLoading();

        if (result.success) {
            alert(`Availability check complete!\nChecked: ${result.checked}\nFailed: ${result.failed}\nTotal: ${result.total}`);
            await loadProducts();
        } else {
            alert('Error checking availability: ' + result.error);
        }
    } catch (error) {
        hideLoading();
        console.error('Error checking availability:', error);
        alert('Error checking availability. Please try again.');
    }
}
