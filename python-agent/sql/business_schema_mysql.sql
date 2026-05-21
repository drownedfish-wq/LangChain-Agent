-- Business database schema for python-agent.
-- Target: MySQL 8.0+
-- Vector data remains in Chroma. This schema stores business metadata,
-- conversation history, files, knowledge bases, MCP config, and logs.

CREATE DATABASE IF NOT EXISTS ai_agent
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE ai_agent;

CREATE TABLE IF NOT EXISTS app_user (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  display_name VARCHAR(128) NULL,
  email VARCHAR(255) NULL,
  password_hash VARCHAR(255) NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'user',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  last_login_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_app_user_username (username),
  UNIQUE KEY uk_app_user_email (email),
  KEY idx_app_user_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_model_config (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider VARCHAR(64) NOT NULL,
  model_name VARCHAR(128) NOT NULL,
  base_url VARCHAR(512) NULL,
  capabilities JSON NULL,
  parameters JSON NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_ai_model_provider_name (provider, model_name),
  KEY idx_ai_model_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  conversation_key VARCHAR(128) NOT NULL,
  title VARCHAR(255) NULL,
  mode VARCHAR(32) NOT NULL DEFAULT 'chat',
  model_id BIGINT UNSIGNED NULL,
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  archived_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_conversation_key (conversation_key),
  KEY idx_conversation_user_updated (user_id, updated_at),
  KEY idx_conversation_mode (mode),
  CONSTRAINT fk_conversation_user
    FOREIGN KEY (user_id) REFERENCES app_user(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_conversation_model
    FOREIGN KEY (model_id) REFERENCES ai_model_config(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_message (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  parent_message_id BIGINT UNSIGNED NULL,
  role VARCHAR(32) NOT NULL,
  content LONGTEXT NOT NULL,
  content_type VARCHAR(32) NOT NULL DEFAULT 'text',
  token_count INT UNSIGNED NULL,
  model_id BIGINT UNSIGNED NULL,
  latency_ms INT UNSIGNED NULL,
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_chat_message_conversation_created (conversation_id, created_at),
  KEY idx_chat_message_role (role),
  CONSTRAINT fk_chat_message_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversation(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_chat_message_parent
    FOREIGN KEY (parent_message_id) REFERENCES chat_message(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_chat_message_model
    FOREIGN KEY (model_id) REFERENCES ai_model_config(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS uploaded_file (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(1024) NOT NULL,
  mime_type VARCHAR(128) NULL,
  file_ext VARCHAR(32) NULL,
  file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
  sha256 CHAR(64) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'uploaded',
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_uploaded_file_sha256 (sha256),
  KEY idx_uploaded_file_user_created (user_id, created_at),
  KEY idx_uploaded_file_status (status),
  CONSTRAINT fk_uploaded_file_user
    FOREIGN KEY (user_id) REFERENCES app_user(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_base (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  collection_name VARCHAR(128) NOT NULL,
  display_name VARCHAR(255) NULL,
  description TEXT NULL,
  vector_store VARCHAR(64) NOT NULL DEFAULT 'chroma',
  persist_dir VARCHAR(1024) NULL,
  embedding_model VARCHAR(128) NOT NULL DEFAULT 'nomic-embed-text',
  chunk_size INT UNSIGNED NOT NULL DEFAULT 500,
  chunk_overlap INT UNSIGNED NOT NULL DEFAULT 50,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_knowledge_base_collection (collection_name),
  KEY idx_knowledge_base_user (user_id),
  KEY idx_knowledge_base_status (status),
  CONSTRAINT fk_knowledge_base_user
    FOREIGN KEY (user_id) REFERENCES app_user(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_document (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  knowledge_base_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NULL,
  title VARCHAR(255) NULL,
  source_uri VARCHAR(1024) NULL,
  source_type VARCHAR(64) NOT NULL DEFAULT 'file',
  loader VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'indexed',
  chunk_count INT UNSIGNED NOT NULL DEFAULT 0,
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_knowledge_document_kb_status (knowledge_base_id, status),
  KEY idx_knowledge_document_file (file_id),
  CONSTRAINT fk_knowledge_document_kb
    FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_base(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_knowledge_document_file
    FOREIGN KEY (file_id) REFERENCES uploaded_file(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS document_chunk (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  knowledge_document_id BIGINT UNSIGNED NOT NULL,
  knowledge_base_id BIGINT UNSIGNED NOT NULL,
  chunk_index INT UNSIGNED NOT NULL,
  vector_id VARCHAR(255) NULL,
  content_hash CHAR(64) NULL,
  content LONGTEXT NULL,
  token_count INT UNSIGNED NULL,
  char_count INT UNSIGNED NULL,
  page_number INT UNSIGNED NULL,
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_document_chunk_index (knowledge_document_id, chunk_index),
  KEY idx_document_chunk_kb (knowledge_base_id),
  KEY idx_document_chunk_vector_id (vector_id),
  CONSTRAINT fk_document_chunk_document
    FOREIGN KEY (knowledge_document_id) REFERENCES knowledge_document(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_document_chunk_kb
    FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_base(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rag_query_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  conversation_id BIGINT UNSIGNED NULL,
  knowledge_base_id BIGINT UNSIGNED NULL,
  model_id BIGINT UNSIGNED NULL,
  query_text TEXT NOT NULL,
  response_text LONGTEXT NULL,
  top_k INT UNSIGNED NOT NULL DEFAULT 3,
  retrieved_chunks JSON NULL,
  latency_ms INT UNSIGNED NULL,
  error_message TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_rag_query_user_created (user_id, created_at),
  KEY idx_rag_query_conversation (conversation_id),
  KEY idx_rag_query_kb_created (knowledge_base_id, created_at),
  CONSTRAINT fk_rag_query_user
    FOREIGN KEY (user_id) REFERENCES app_user(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_rag_query_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversation(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_rag_query_kb
    FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_base(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_rag_query_model
    FOREIGN KEY (model_id) REFERENCES ai_model_config(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mcp_server_config (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  transport VARCHAR(32) NOT NULL,
  command_text VARCHAR(512) NULL,
  args JSON NULL,
  url VARCHAR(1024) NULL,
  env JSON NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_mcp_server_name (name),
  KEY idx_mcp_server_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tool_call_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  conversation_id BIGINT UNSIGNED NULL,
  message_id BIGINT UNSIGNED NULL,
  tool_name VARCHAR(128) NOT NULL,
  tool_source VARCHAR(32) NOT NULL DEFAULT 'local',
  request_args JSON NULL,
  response_text LONGTEXT NULL,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  latency_ms INT UNSIGNED NULL,
  error_message TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_tool_call_conversation_created (conversation_id, created_at),
  KEY idx_tool_call_tool_created (tool_name, created_at),
  KEY idx_tool_call_user_created (user_id, created_at),
  CONSTRAINT fk_tool_call_user
    FOREIGN KEY (user_id) REFERENCES app_user(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_tool_call_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversation(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_tool_call_message
    FOREIGN KEY (message_id) REFERENCES chat_message(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_setting (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_key VARCHAR(128) NOT NULL,
  setting_value JSON NULL,
  description VARCHAR(512) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_app_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ai_model_config
  (provider, model_name, base_url, capabilities, parameters, is_default, enabled)
VALUES
  (
    'ollama',
    'deepseek-r1:1.5b',
    'http://localhost:11434',
    JSON_ARRAY('chat'),
    JSON_OBJECT('temperature', 0.7),
    TRUE,
    TRUE
  )
ON DUPLICATE KEY UPDATE
  base_url = VALUES(base_url),
  capabilities = VALUES(capabilities),
  parameters = VALUES(parameters),
  enabled = VALUES(enabled);

INSERT INTO knowledge_base
  (collection_name, display_name, description, vector_store, persist_dir, embedding_model)
VALUES
  (
    'default',
    'Default Knowledge Base',
    'Default collection for local RAG documents.',
    'chroma',
    './data/chroma/default',
    'nomic-embed-text'
  )
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  vector_store = VALUES(vector_store),
  persist_dir = VALUES(persist_dir),
  embedding_model = VALUES(embedding_model);
