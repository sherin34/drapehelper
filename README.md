# Drape Store Management System

A beautiful Node.js web application for managing product details and order tracking for your online store.

## Features

### Product Details
- Upload product data via Excel file
- View all products in a beautiful table
- Edit product information inline
- Download updated product data as Excel
- Supports: Seller Code, Our Code, Image URL, Product URL, Seller Price, Our Price, Profit Margin

### Order Details
- Add new orders through a clean form interface
- Product dropdown with automatic profit calculation
- Edit and delete existing orders
- Download order history as Excel
- Track: Serial No, Order ID, Product Code, Date, Price, Profit Amount, Buyer Name, Status, Notes

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
node server.js
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

### Product Management

1. **Upload Products**
   - Click "Upload Excel" button
   - Select your Excel file with columns: sellercode, ourcode, image, url, sellerprice, ourprice, profitmargin
   - Products will be loaded into the system

2. **Edit Products**
   - Click the "Edit" button on any product row
   - Modify the fields as needed
   - Click "Save Changes"

3. **Download Products**
   - Click "Download Excel" to export all products
   - File will maintain the original column format

### Order Management

1. **Add New Order**
   - Click "Add New Order" button
   - Fill in the order details
   - Select product from dropdown (profit will auto-calculate)
   - Click "Save Order"

2. **Edit/Delete Orders**
   - Click "Edit" to modify an existing order
   - Click "Delete" to remove an order (with confirmation)

3. **Download Orders**
   - Click "Download Excel" to export all orders
   - Excel file includes all order details

## Data Storage

All data is stored in JSON files in the `data/` directory:
- `data/products.json` - Product information
- `data/orders.json` - Order records

## Excel Format

### Products Excel Format
Your product Excel file should have these columns:
- sellercode
- ourcode
- image
- url
- sellerprice
- ourprice
- profitmargin

## Technologies Used

- Node.js
- Express.js
- Multer (file uploads)
- XLSX (Excel processing)
- Custom CSS (beautiful gradient design)
- Vanilla JavaScript

## Notes

- The application runs on port 3000 by default
- All data persists in local JSON files
- No database required
- Beautiful gradient purple theme with responsive design
