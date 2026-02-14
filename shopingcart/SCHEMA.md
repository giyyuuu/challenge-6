# Database Schema Documentation

## Overview

The shopping cart system uses SQLite for persistent storage. The schema is designed for:
- **Multi-user support**: Each user gets a unique UUID-based `cart_id`
- **Performance**: Indexed queries for fast lookups and cleanup operations
- **Data integrity**: Proper constraints and data types
- **Scalability**: Efficient storage and retrieval patterns

## Tables

### `carts` Table

Stores shopping cart data for each user session.

#### Schema

```sql
CREATE TABLE carts (
  cart_id TEXT PRIMARY KEY,           -- UUID v4 identifier (36 characters)
  cart_data TEXT NOT NULL,            -- JSON array of cart items
  last_updated INTEGER NOT NULL,      -- Unix timestamp (milliseconds)
  created_at INTEGER NOT NULL,        -- Unix timestamp (milliseconds)
  item_count INTEGER NOT NULL DEFAULT 0  -- Number of items in cart
);
```

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `cart_id` | TEXT | PRIMARY KEY | UUID v4 format (e.g., `550e8400-e29b-41d4-a716-446655440000`) |
| `cart_data` | TEXT | NOT NULL | JSON string containing array of cart items |
| `last_updated` | INTEGER | NOT NULL | Unix timestamp in milliseconds when cart was last modified |
| `created_at` | INTEGER | NOT NULL | Unix timestamp in milliseconds when cart was created |
| `item_count` | INTEGER | NOT NULL, DEFAULT 0 | Cached count of items for performance |

#### Indexes

```sql
-- Index for cleanup operations (queries by last_updated)
CREATE INDEX idx_last_updated ON carts(last_updated);

-- Index for analytics queries (optional)
CREATE INDEX idx_item_count ON carts(item_count);
```

#### Cart Data JSON Structure

The `cart_data` column stores a JSON array of cart items:

```json
[
  {
    "productId": "1",
    "name": "Laptop",
    "price": 999.99,
    "quantity": 2,
    "image": "💻"
  },
  {
    "productId": "3",
    "name": "Headphones",
    "price": 199.99,
    "quantity": 1,
    "image": "🎧"
  }
]
```

#### Item Schema

Each cart item object contains:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `productId` | string | Yes | Unique product identifier (max 100 chars) |
| `name` | string | Yes | Product name (max 200 chars) |
| `price` | number | Yes | Product price (2 decimal places, >= 0) |
| `quantity` | integer | Yes | Item quantity (1-999, > 0) |
| `image` | string | No | Product image URL or emoji (max 500 chars) |

## Database Configuration

### WAL Mode

The database uses Write-Ahead Logging (WAL) mode for better concurrency:

```javascript
db.pragma('journal_mode = WAL');
```

**Benefits:**
- Multiple readers can access database simultaneously
- Writers don't block readers
- Better performance for concurrent operations

### Busy Timeout

Set to 5 seconds to handle concurrent write operations:

```javascript
db.pragma('busy_timeout = 5000');
```

## Data Lifecycle

### Cart Creation

1. New cart created when user first adds item
2. `cart_id` generated as UUID v4
3. `created_at` and `last_updated` set to current timestamp
4. `item_count` initialized to 0

### Cart Updates

1. `cart_data` updated with new item array
2. `last_updated` set to current timestamp
3. `item_count` recalculated and updated

### Cart Expiration

- Carts with `last_updated` older than 7 days are considered expired
- Cleanup job runs every hour
- Expired carts are automatically deleted

### Cleanup Query

```sql
DELETE FROM carts 
WHERE last_updated < (CURRENT_TIMESTAMP - INTERVAL '7 days');
```

In SQLite (using milliseconds):
```sql
DELETE FROM carts 
WHERE last_updated < (strftime('%s', 'now') * 1000 - 7 * 24 * 60 * 60 * 1000);
```

## Performance Considerations

### Query Patterns

1. **Get Cart by ID** (most common)
   - Uses primary key lookup: `O(1)`
   - Index: `cart_id` (PRIMARY KEY)

2. **Cleanup Expired Carts**
   - Uses index: `idx_last_updated`
   - Query: `WHERE last_updated < ?`
   - Efficient range scan

3. **Statistics Queries**
   - Uses aggregate functions
   - Indexes help with COUNT and SUM operations

### Optimization Tips

1. **Item Count Caching**: `item_count` column avoids parsing JSON for count operations
2. **Indexed Queries**: All common queries use indexes
3. **WAL Mode**: Enables concurrent read operations
4. **JSON Storage**: Flexible schema, easy to extend

## Migration Path

### From Memory-Based to Database

If migrating from in-memory storage:

1. Export existing carts (if any) to JSON
2. Import into database with UUID cart_ids
3. Update client-side code to use `cart_id` cookie

### Schema Evolution

To add new fields:

1. Add column to table: `ALTER TABLE carts ADD COLUMN new_field TYPE;`
2. Update application code to handle new field
3. Migrate existing data if needed

## PostgreSQL Alternative

For production at scale, consider PostgreSQL:

```sql
CREATE TABLE carts (
  cart_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_data JSONB NOT NULL,
  last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  item_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_carts_last_updated ON carts(last_updated);
CREATE INDEX idx_carts_item_count ON carts(item_count);

-- GIN index for JSONB queries
CREATE INDEX idx_carts_data ON carts USING GIN (cart_data);
```

## Backup Strategy

### SQLite Backup

```bash
# Simple backup
cp carts.db carts.db.backup

# Online backup (recommended)
sqlite3 carts.db ".backup 'carts.db.backup'"
```

### Automated Backup Script

```bash
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
sqlite3 carts.db ".backup '$BACKUP_DIR/carts_$DATE.db'"
# Keep only last 30 days
find $BACKUP_DIR -name "carts_*.db" -mtime +30 -delete
```

## Monitoring Queries

### Get Total Carts

```sql
SELECT COUNT(*) FROM carts;
```

### Get Total Items Across All Carts

```sql
SELECT SUM(item_count) FROM carts;
```

### Get Oldest Cart

```sql
SELECT MIN(last_updated) FROM carts;
```

### Get Carts by Size

```sql
SELECT item_count, COUNT(*) as cart_count
FROM carts
GROUP BY item_count
ORDER BY item_count;
```

### Get Active Carts (last 24 hours)

```sql
SELECT COUNT(*) 
FROM carts 
WHERE last_updated > (strftime('%s', 'now') * 1000 - 24 * 60 * 60 * 1000);
```

