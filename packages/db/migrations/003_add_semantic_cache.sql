-- Migration: Add Semantic Cache Table with pgvector
-- Description: Creates semantic_cache table for caching LLM responses with vector similarity search
-- Requires: pgvector extension

-- Ensure pgvector extension is available
CREATE EXTENSION IF NOT EXISTS vector;

-- Create semantic cache table
CREATE TABLE IF NOT EXISTS semantic_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_hash VARCHAR(64) NOT NULL,
  prompt_text TEXT NOT NULL,
  prompt_embedding vector(1536) NOT NULL, -- OpenAI text-embedding-ada-002 dimensions
  response_text TEXT NOT NULL,
  response_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  model VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_count INTEGER NOT NULL DEFAULT 1,
  ttl_seconds INTEGER NOT NULL DEFAULT 3600,
  expires_at TIMESTAMPTZ NOT NULL,

  -- Unique constraint on prompt hash and model
  CONSTRAINT unique_prompt_model UNIQUE (prompt_hash, model)
);

-- Create indexes for efficient querying

-- Index for vector similarity search using ivfflat
-- This uses cosine distance for similarity comparison
CREATE INDEX IF NOT EXISTS idx_semantic_cache_embedding
ON semantic_cache
USING ivfflat (prompt_embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for model filtering
CREATE INDEX IF NOT EXISTS idx_semantic_cache_model
ON semantic_cache (model);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_semantic_cache_expires_at
ON semantic_cache (expires_at);

-- Index for accessing most used entries
CREATE INDEX IF NOT EXISTS idx_semantic_cache_access_count
ON semantic_cache (access_count DESC);

-- Index for prompt hash lookup
CREATE INDEX IF NOT EXISTS idx_semantic_cache_prompt_hash
ON semantic_cache (prompt_hash);

-- Composite index for common queries (model + not expired)
CREATE INDEX IF NOT EXISTS idx_semantic_cache_model_active
ON semantic_cache (model, expires_at)
WHERE expires_at > NOW();

-- Comments for documentation
COMMENT ON TABLE semantic_cache IS 'Stores cached LLM responses with vector embeddings for semantic similarity matching';
COMMENT ON COLUMN semantic_cache.prompt_hash IS 'SHA-256 hash of the prompt text for exact matching';
COMMENT ON COLUMN semantic_cache.prompt_text IS 'Original prompt text';
COMMENT ON COLUMN semantic_cache.prompt_embedding IS 'Vector embedding of the prompt for similarity search';
COMMENT ON COLUMN semantic_cache.response_text IS 'Cached LLM response';
COMMENT ON COLUMN semantic_cache.response_metadata IS 'Additional metadata about the response (tokens, finish reason, etc.)';
COMMENT ON COLUMN semantic_cache.model IS 'Model identifier that generated this response';
COMMENT ON COLUMN semantic_cache.access_count IS 'Number of times this cache entry has been accessed';
COMMENT ON COLUMN semantic_cache.ttl_seconds IS 'Time-to-live in seconds for this cache entry';
COMMENT ON COLUMN semantic_cache.expires_at IS 'Timestamp when this cache entry expires';
