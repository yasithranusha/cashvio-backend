# Stock Service

## Overview

The Stock Service manages inventory, products, categories, suppliers, and discount campaigns for the Cashvio platform. It provides comprehensive product catalog management with hierarchical categorization.

## Key Features

- **Product Management**: Create, update, and manage products with variants
- **Inventory Tracking**: Item-level inventory with barcode scanning
- **Category Hierarchy**: Three-level categorization (Category > SubCategory > SubSubCategory)
- **Supplier Management**: Supplier information and contact details
- **Discount Campaigns**: Time-based discount management with product-specific rates
- **Barcode Integration**: Support for barcode scanning and item lookup

## Endpoints

### Product Management

#### POST /products
Create a new product.

**Request:**
```json
{
  "name": "iPhone 14 Pro",
  "description": "Apple iPhone 14 Pro smartphone with A16 Bionic chip",
  "displayName": "iPhone 14 Pro (128GB)",
  "keepingUnits": 10,
  "imageUrls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "warrantyMonths": 12,
  "loyaltyPoints": 10,
  "status": "ACTIVE",
  "shopId": "shop-uuid-here",
  "supplierId": "supplier-uuid-here",
  "categoryId": "category-uuid-here",
  "subCategoryId": "subcategory-uuid-here",
  "subSubCategoryId": "subsubcategory-uuid-here"
}
```

#### GET /products
Get products with pagination and filtering.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `shopId`: Filter by shop ID (required)
- `status`: Filter by status (ACTIVE, HIDE)
- `search`: Search in product name/description
- `categoryId`: Filter by main category
- `subCategoryId`: Filter by subcategory
- `subSubCategoryId`: Filter by sub-subcategory
- `supplierId`: Filter by supplier

#### GET /products/:productId
Get product by ID with full details.

#### PUT /products/:productId
Update product information.

#### DELETE /products/:productId
Delete product (with optional cascade to items).

**Query Parameters:**
- `cascade`: If true, also deletes associated items

#### GET /products/with-items
Get products with their inventory items and stock count.

**Query Parameters:**
- `shopId`: Shop ID (required)
- `supplierId`: Filter by supplier
- `categoryId`: Filter by category
- `search`: Search term

### Item Management

#### POST /items
Create a new inventory item.

**Request:**
```json
{
  "barcode": "1234567890123",
  "broughtPrice": 120000,
  "sellPrice": 140000,
  "warrantyPeriod": "2025-03-29T00:00:00.000Z",
  "productId": "product-uuid-here"
}
```

#### GET /items
Get items with pagination and filtering.

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `productId`: Filter by product

#### GET /items/:itemId
Get item by ID.

#### GET /items/barcode/:barcode
Get item by barcode for POS scanning.

#### PUT /items/:itemId
Update item information.

#### DELETE /items/:itemId
Delete inventory item.

### Category Management

#### Main Categories

**POST /categories**
Create a new main category.

**Request:**
```json
{
  "name": "Electronics",
  "description": "Electronic devices and accessories",
  "imageUrl": "https://example.com/images/electronics.jpg",
  "status": "ACTIVE",
  "shopId": "shop-uuid-here"
}
```

**GET /categories/:shopId**
Get all main categories for a shop.

**GET /categories/:categoryId**
Get specific category by ID.

**PUT /categories/:categoryId**
Update category information.

**DELETE /categories/:categoryId**
Delete category.

#### SubCategories

**POST /categories/subcategories**
Create a new subcategory.

**Request:**
```json
{
  "name": "Smartphones",
  "description": "Mobile phones and accessories",
  "imageUrl": "https://example.com/images/smartphones.jpg",
  "status": "ACTIVE",
  "categoryId": "parent-category-uuid"
}
```

**GET /categories/subcategories/:shopId**
Get all subcategories for a shop.

**GET /categories/subcategories/:subcategoryId**
Get specific subcategory by ID.

**PUT /categories/subcategories/:subcategoryId**
Update subcategory.

**DELETE /categories/subcategories/:subcategoryId**
Delete subcategory.

#### SubSubCategories

**POST /categories/subcategories/subsubcategories**
Create a new sub-subcategory.

**Request:**
```json
{
  "name": "Android Phones",
  "description": "Android operating system smartphones",
  "imageUrl": "https://example.com/images/android.jpg",
  "status": "ACTIVE",
  "subCategoryId": "parent-subcategory-uuid"
}
```

**GET /categories/subcategories/subsubcategories/:shopId**
Get all sub-subcategories for a shop.

**GET /categories/subsubcategories/:subsubcategoryId**
Get specific sub-subcategory by ID.

**PUT /categories/subsubcategories/:subsubcategoryId**
Update sub-subcategory.

**DELETE /categories/subsubcategories/:subsubcategoryId**
Delete sub-subcategory.

### Supplier Management

#### POST /suppliers
Create a new supplier.

**Request:**
```json
{
  "name": "Samsung Electronics",
  "email": "contact@samsung.com",
  "contactNumber": "+1234567890",
  "haveWhatsApp": true,
  "shopId": "shop-uuid-here"
}
```

#### GET /suppliers
Get suppliers with pagination.

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `shopId`: Shop ID filter

#### GET /suppliers/:supplierId
Get supplier by ID.

#### PUT /suppliers/:supplierId
Update supplier information.

#### DELETE /suppliers/:supplierId
Delete supplier.

### Discount Management

#### POST /discounts
Create a new discount campaign.

**Request:**
```json
{
  "title": "Summer Sale 2025",
  "description": "Up to 50% off on selected items",
  "startDate": "2025-06-01T00:00:00.000Z",
  "endDate": "2025-08-31T23:59:59.000Z",
  "status": "ACTIVE"
}
```

#### GET /discounts
Get discount campaigns.

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `status`: Filter by status (ACTIVE, INACTIVE)

#### GET /discounts/:discountId
Get discount campaign by ID.

#### PUT /discounts/:discountId
Update discount campaign.

#### DELETE /discounts/:discountId
Delete discount campaign.

#### POST /discounts/products/:discountId
Add products to discount campaign.

**Request:**
```json
{
  "products": [
    {
      "productId": "product-uuid-here",
      "percentage": 25.5
    }
  ]
}
```

#### GET /discounts/products/:productId
Get active discounts for a specific product.

## Data Models

### Product Model
```typescript
{
  id: string;
  name: string;
  description?: string;
  displayName?: string;
  keepingUnits: number;
  imageUrls: string[];
  warrantyMonths?: number;
  loyaltyPoints?: number;
  status: 'ACTIVE' | 'HIDE';
  shopId: string;
  supplierId?: string;
  categoryId?: string;
  subCategoryId?: string;
  subSubCategoryId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Item Model
```typescript
{
  id: string;
  barcode: string;
  broughtPrice: number;
  sellPrice: number;
  warrantyPeriod?: Date;
  productId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Category Hierarchy
```typescript
// Main Category
{
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  status: 'ACTIVE' | 'INACTIVE';
  shopId: string;
}

// SubCategory
{
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  status: 'ACTIVE' | 'INACTIVE';
  categoryId: string;
}

// SubSubCategory
{
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  status: 'ACTIVE' | 'INACTIVE';
  subCategoryId: string;
}
```

## Business Logic

### Inventory Management
- Each product can have multiple items (inventory units)
- Items are tracked individually with unique barcodes
- Stock count is calculated by counting available items
- Items can have individual pricing and warranty periods

### Category Hierarchy
- Three-level categorization system
- Categories are shop-specific
- Hierarchical relationships: Category → SubCategory → SubSubCategory
- Products can be assigned to any level of the hierarchy

### Discount System
- Time-based discount campaigns
- Product-specific discount percentages
- Active discounts automatically applied during order processing
- Support for multiple concurrent discounts

### Barcode Integration
- Unique barcode per inventory item
- Barcode scanning for quick item lookup
- Integration with POS systems for fast checkout

## Configuration

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/cashvio

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672

# Service Port
STOCK_SERVICE_PORT=8082
```

## Error Handling

### Common Errors
- `400`: Invalid input data or business rule violation
- `404`: Product, item, category, or supplier not found
- `409`: Duplicate barcode or name conflict
- `422`: Business logic validation failed (e.g., cannot delete category with products)

### Validation Rules
- Product names must be unique within a shop
- Barcodes must be unique globally
- Categories cannot be deleted if they have associated products
- Items cannot be created without a valid product
- Discount percentages must be between 0 and 100