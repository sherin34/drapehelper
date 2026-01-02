const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// File storage setup for Excel uploads
const upload = multer({ dest: 'uploads/' });

// File storage setup for image uploads
const imageStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images/products');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const uploadImage = multer({ storage: imageStorage });

// Data files
const PRODUCTS_FILE = 'data/products.json';
const ORDERS_FILE = 'data/orders.json';

// Ensure data directory exists
if (!fs.existsSync('data')) {
    fs.mkdirSync('data');
}
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}
if (!fs.existsSync('public/images')) {
    fs.mkdirSync('public/images', { recursive: true });
}
if (!fs.existsSync('public/images/products')) {
    fs.mkdirSync('public/images/products', { recursive: true });
}

// Initialize data files if they don't exist
if (!fs.existsSync(PRODUCTS_FILE)) {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify([]));
}
if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));
}

// Helper functions
function readProducts() {
    return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
}

function writeProducts(products) {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}

function readOrders() {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
}

function writeOrders(orders) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

// Routes

// Get all products
app.get('/api/products', (req, res) => {
    try {
        const products = readProducts();
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read products' });
    }
});

// Upload Excel file for products
app.post('/api/products/upload', upload.single('file'), (req, res) => {
    try {
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        // Filter out rows with blank sellercode and map to our format
        const products = data
            .filter(row => row.sellercode && row.sellercode.toString().trim() !== '')
            .map((row, index) => ({
                id: index + 1,
                sellercode: row.sellercode || '',
                ourcode: row.ourcode || '',
                imageurl: row.imageurl || '',
                url: row.url || '',
                sellerprice: parseFloat(row.sellerprice) || 0,
                ourprice: parseFloat(row.ourprice) || 0,
                profitmargin: parseFloat(row.profitmargin) || 0,
                availability: 'Unknown' // Default availability status
            }));

        writeProducts(products);

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({ success: true, count: products.length });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to process Excel file' });
    }
});

// Check availability for a single product using Puppeteer
app.post('/api/products/check-availability/:id', async (req, res) => {
    let browser;
    try {
        const products = readProducts();
        const id = parseInt(req.params.id);
        const product = products.find(p => p.id === id);

        if (!product || !product.url) {
            return res.status(404).json({ error: 'Product not found or no URL' });
        }

        // Launch headless browser
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Navigate to product page and wait for content to load
        await page.goto(product.url, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Get the rendered HTML
        const html = await page.content();
        const lowerHtml = html.toLowerCase();

        // Debug logging
        const hasAddToCart = lowerHtml.includes('add to cart');
        const hasOutOfStock = lowerHtml.includes('out of stock');
        console.log(`Product ${product.ourcode}:`);
        console.log(`  - Has "add to cart": ${hasAddToCart}`);
        console.log(`  - Has "out of stock": ${hasOutOfStock}`);

        // Check availability - prioritize "out of stock" message
        // If "out of stock" is found, it's definitely out of stock
        // Otherwise, if "add to cart" is found, it's available
        let availability = 'Out of Stock'; // Default to out of stock

        if (hasOutOfStock) {
            availability = 'Out of Stock';
        } else if (hasAddToCart) {
            availability = 'Available';
        }

        await browser.close();

        // Update product availability
        const index = products.findIndex(p => p.id === id);
        products[index].availability = availability;
        writeProducts(products);

        res.json({ success: true, availability: availability, productId: id });
    } catch (error) {
        if (browser) await browser.close();
        console.error('Availability check error:', error.message);
        res.status(500).json({ error: 'Failed to check availability', message: error.message });
    }
});

// Check availability for all products using Puppeteer (parallel processing)
app.post('/api/products/check-all-availability', async (req, res) => {
    let browser;
    try {
        const products = readProducts();
        let checked = 0;
        let failed = 0;

        // Launch browser once for all checks
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        // Process products in parallel (5 at a time for reliable checking)
        const BATCH_SIZE = 5;

        async function checkProduct(product) {
            if (!product.url) {
                product.availability = 'No URL';
                return;
            }

            try {
                const page = await browser.newPage();

                // Navigate to product page
                await page.goto(product.url, {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                // Get rendered HTML
                const html = await page.content();
                const lowerHtml = html.toLowerCase();

                // Check availability - prioritize "out of stock" message
                if (lowerHtml.includes('out of stock')) {
                    product.availability = 'Out of Stock';
                } else if (lowerHtml.includes('add to cart')) {
                    product.availability = 'Available';
                } else {
                    product.availability = 'Out of Stock';
                }

                await page.close();
                checked++;
            } catch (error) {
                product.availability = 'Check Failed';
                failed++;
                console.error(`Failed to check ${product.ourcode}:`, error.message);
            }
        }

        // Process in batches
        for (let i = 0; i < products.length; i += BATCH_SIZE) {
            const batch = products.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(product => checkProduct(product)));
        }

        await browser.close();
        writeProducts(products);
        res.json({ success: true, checked: checked, failed: failed, total: products.length });
    } catch (error) {
        if (browser) await browser.close();
        console.error('Bulk availability check error:', error);
        res.status(500).json({ error: 'Failed to check availability' });
    }
});

// Update a product
app.put('/api/products/:id', (req, res) => {
    try {
        const products = readProducts();
        const id = parseInt(req.params.id);
        const index = products.findIndex(p => p.id === id);

        if (index !== -1) {
            products[index] = {
                ...products[index],
                ...req.body,
                id: id // Ensure ID doesn't change
            };
            writeProducts(products);
            res.json({ success: true, product: products[index] });
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Download products as Excel
app.get('/api/products/download', (req, res) => {
    try {
        const products = readProducts();

        // Prepare data for Excel (remove id field)
        const excelData = products.map(p => ({
            sellercode: p.sellercode,
            ourcode: p.ourcode,
            imageurl: p.imageurl,
            url: p.url,
            sellerprice: p.sellerprice,
            ourprice: p.ourprice,
            profitmargin: p.profitmargin
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename=products.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate Excel file' });
    }
});

// Get all orders
app.get('/api/orders', (req, res) => {
    try {
        const orders = readOrders();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read orders' });
    }
});

// Create a new order
app.post('/api/orders', (req, res) => {
    try {
        const orders = readOrders();
        const newOrder = {
            id: orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 1,
            slno: req.body.slno,
            orderid: req.body.orderid,
            productcode: req.body.productcode,
            date: req.body.date,
            price: parseFloat(req.body.price) || 0,
            profitamount: parseFloat(req.body.profitamount) || 0,
            buyername: req.body.buyername,
            status: req.body.status,
            notes: req.body.notes || ''
        };

        orders.push(newOrder);
        writeOrders(orders);

        res.json({ success: true, order: newOrder });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Update an order
app.put('/api/orders/:id', (req, res) => {
    try {
        const orders = readOrders();
        const id = parseInt(req.params.id);
        const index = orders.findIndex(o => o.id === id);

        if (index !== -1) {
            orders[index] = {
                ...orders[index],
                ...req.body,
                id: id,
                price: parseFloat(req.body.price) || orders[index].price,
                profitamount: parseFloat(req.body.profitamount) || orders[index].profitamount
            };
            writeOrders(orders);
            res.json({ success: true, order: orders[index] });
        } else {
            res.status(404).json({ error: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// Delete an order
app.delete('/api/orders/:id', (req, res) => {
    try {
        const orders = readOrders();
        const id = parseInt(req.params.id);
        const filteredOrders = orders.filter(o => o.id !== id);

        if (filteredOrders.length < orders.length) {
            writeOrders(filteredOrders);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete order' });
    }
});

// Download orders as Excel
app.get('/api/orders/download', (req, res) => {
    try {
        const orders = readOrders();

        // Prepare data for Excel
        const excelData = orders.map(o => ({
            'Serial No': o.slno,
            'Order ID': o.orderid,
            'Product Code': o.productcode,
            'Date': o.date,
            'Price': o.price,
            'Profit Amount': o.profitamount,
            'Buyer Name': o.buyername,
            'Status': o.status,
            'Notes': o.notes || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename=orders.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate Excel file' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
