-- 器件部物料数据智能管理系统 - 数据库初始化脚本
-- PostgreSQL 14+

-- 启用 pgcrypto 扩展（用于 digest 函数）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. 数据记录表
-- ============================================
CREATE TABLE IF NOT EXISTS data_record (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL DEFAULT '',
    type VARCHAR(50) DEFAULT '',
    data JSONB NOT NULL DEFAULT '{}',
    content_hash VARCHAR(64) DEFAULT '',
    source VARCHAR(255) DEFAULT '',
    module VARCHAR(255) NOT NULL DEFAULT 'material',
    _created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    _created_by VARCHAR(100) DEFAULT '',
    _updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    _updated_by VARCHAR(100) DEFAULT ''
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_data_record_module ON data_record(module);
CREATE INDEX IF NOT EXISTS idx_data_record_title ON data_record(title);
CREATE INDEX IF NOT EXISTS idx_data_record_content_hash ON data_record(content_hash);
CREATE INDEX IF NOT EXISTS idx_data_record_data_gin ON data_record USING GIN(data);

-- ============================================
-- 2. 用户账号表
-- ============================================
CREATE TABLE IF NOT EXISTS app_account (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    initial_password VARCHAR(255) DEFAULT '123456',
    display_name VARCHAR(100) DEFAULT '',
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    _created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    _created_by VARCHAR(100) DEFAULT ''
);

-- ============================================
-- 3. 附件表
-- ============================================
CREATE TABLE IF NOT EXISTS attachment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(100) DEFAULT '',
    file_size BIGINT DEFAULT 0,
    bucket_id VARCHAR(255) DEFAULT '',
    file_path VARCHAR(500) NOT NULL,
    _created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    _created_by VARCHAR(100) DEFAULT ''
);

-- ============================================
-- 4. 记录-附件关联表
-- ============================================
CREATE TABLE IF NOT EXISTS record_attachment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES data_record(id) ON DELETE CASCADE,
    attachment_id UUID NOT NULL REFERENCES attachment(id) ON DELETE CASCADE,
    _created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    _created_by VARCHAR(100) DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_record_attachment_record ON record_attachment(record_id);
CREATE INDEX IF NOT EXISTS idx_record_attachment_attachment ON record_attachment(attachment_id);

-- ============================================
-- 5. 插入默认账号
-- ============================================
-- 密码哈希使用 SHA-256 计算

-- admin / admin123
INSERT INTO app_account (username, password_hash, initial_password, display_name, role, _created_by)
VALUES ('admin', encode(digest('admin123', 'sha256'), 'hex'), 'admin123', '系统管理员', 'admin', 'system')
ON CONFLICT (username) DO NOTHING;

-- operator1 / admin123
INSERT INTO app_account (username, password_hash, initial_password, display_name, role, _created_by)
VALUES ('operator1', encode(digest('admin123', 'sha256'), 'hex'), 'admin123', '操作员1', 'user', 'system')
ON CONFLICT (username) DO NOTHING;

-- operator2 / admin123
INSERT INTO app_account (username, password_hash, initial_password, display_name, role, _created_by)
VALUES ('operator2', encode(digest('admin123', 'sha256'), 'hex'), 'admin123', '操作员2', 'user', 'system')
ON CONFLICT (username) DO NOTHING;

-- guest / guest123
INSERT INTO app_account (username, password_hash, initial_password, display_name, role, _created_by)
VALUES ('guest', encode(digest('guest123', 'sha256'), 'hex'), 'guest123', '只读访客', 'guest', 'system')
ON CONFLICT (username) DO NOTHING;
