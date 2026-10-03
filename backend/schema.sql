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
