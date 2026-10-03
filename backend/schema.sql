-- 1. Enable pgvector extension for shop visual memory embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create Products Table (Shop-isolated inventory with loose items & rate/kg support)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id VARCHAR(50) NOT NULL DEFAULT 'SHOP001',
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    category VARCHAR(100) DEFAULT 'General',
    selling_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    cost_price NUMERIC(10, 2) DEFAULT 0.00,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    unit VARCHAR(50) DEFAULT 'packet',
    is_loose BOOLEAN DEFAULT FALSE,
    price_unit VARCHAR(50) DEFAULT 'per_item',
    expiry_date VARCHAR(50),
    barcode VARCHAR(100),
    image_url TEXT,
    visual_embedding vector(512),
    created_at TIMESTAMP WITH TIMEZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIMEZONE DEFAULT NOW()
);

-- Index for fast shop-scoped visual vector search
CREATE INDEX IF NOT EXISTS products_shop_embedding_idx 
ON products 
USING ivfflat (visual_embedding vector_cosine_ops) 
WITH (lists = 100);

-- Index for barcode lookups
CREATE INDEX IF NOT EXISTS products_barcode_idx ON products(shop_id, barcode);

-- 3. SQL Function for Shop Visual Vector Matching
CREATE OR REPLACE FUNCTION match_shop_products(
    query_shop_id VARCHAR(50),
    query_embedding vector(512),
    match_threshold FLOAT,
    match_count INT
)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    brand VARCHAR(100),
    selling_price NUMERIC(10, 2),
    quantity NUMERIC(10, 2),
    unit VARCHAR(50),
    is_loose BOOLEAN,
    price_unit VARCHAR(50),
    expiry_date VARCHAR(50),
    barcode VARCHAR(100),
    image_url TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.brand,
        p.selling_price,
        p.quantity,
        p.unit,
        p.is_loose,
        p.price_unit,
        p.expiry_date,
        p.barcode,
        p.image_url,
        (1 - (p.visual_embedding <=> query_embedding))::FLOAT AS similarity
    FROM products p
    WHERE p.shop_id = query_shop_id
      AND p.visual_embedding IS NOT NULL
      AND (1 - (p.visual_embedding <=> query_embedding)) >= match_threshold
    ORDER BY p.visual_embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 4. Customers Table (Udhaar & Contact Ledger)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id VARCHAR(50) NOT NULL DEFAULT 'SHOP001',
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    udhaar_balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIMEZONE DEFAULT NOW()
);

-- 5. Bills / Sales Transactions Table
CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id VARCHAR(50) NOT NULL DEFAULT 'SHOP001',
    customer_id UUID REFERENCES customers(id),
    customer_name VARCHAR(150),
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    udhaar_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_mode VARCHAR(50) DEFAULT 'CASH',
    status VARCHAR(50) DEFAULT 'COMPLETED',
    created_at TIMESTAMP WITH TIMEZONE DEFAULT NOW()
);

-- 6. Bill Items Table
CREATE TABLE IF NOT EXISTS bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(50) DEFAULT 'packet',
    unit_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL
);

-- 7. Udhaar Payments & Logs Table
CREATE TABLE IF NOT EXISTS udhaar_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id VARCHAR(50) NOT NULL DEFAULT 'SHOP001',
    customer_id UUID REFERENCES customers(id),
    type VARCHAR(30) NOT NULL, -- 'UDHAAR_ADDED' or 'PAYMENT_RECEIVED'
    amount NUMERIC(10, 2) NOT NULL,
    balance_after NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIMEZONE DEFAULT NOW()
);
