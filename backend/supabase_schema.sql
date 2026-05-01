-- ============================================================
-- ChatBot 数据库表创建脚本（可重复执行）
-- 在 Supabase Dashboard → SQL Editor 中执行
-- ============================================================

-- 数据迁移（已有表时添加新列）
ALTER TABLE settings ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'openai';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reasoning TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS model TEXT;

-- 先删除已有表（从子表到父表，避免外键冲突）
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- ============================================================
-- 通用函数：自动设置审计字段
-- ============================================================

-- 插入时设置 created_by / updated_by
CREATE OR REPLACE FUNCTION set_created_by()
RETURNS TRIGGER AS $$
BEGIN
    NEW.created_by = auth.uid();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 更新时设置 updated_by / updated_at
CREATE OR REPLACE FUNCTION set_updated_by()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_by = auth.uid();
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. settings 表（用户配置）
-- ============================================================
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    api_key TEXT,
    provider TEXT DEFAULT 'openai',
    model TEXT DEFAULT 'gpt-4o',
    temperature FLOAT DEFAULT 0.7,
    max_tokens INT DEFAULT 2000,
    theme TEXT DEFAULT 'light',

    -- 审计字段
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id)
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own settings"
ON settings FOR ALL
USING (auth.uid() = user_id);

CREATE TRIGGER trg_settings_insert
BEFORE INSERT ON settings
FOR EACH ROW EXECUTE FUNCTION set_created_by();

CREATE TRIGGER trg_settings_update
BEFORE UPDATE ON settings
FOR EACH ROW EXECUTE FUNCTION set_updated_by();

-- ============================================================
-- 2. sessions 表（会话）
-- ============================================================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL DEFAULT '新对话',

    -- 审计字段
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own sessions"
ON sessions FOR ALL
USING (auth.uid() = user_id);

CREATE TRIGGER trg_sessions_insert
BEFORE INSERT ON sessions
FOR EACH ROW EXECUTE FUNCTION set_created_by();

CREATE TRIGGER trg_sessions_update
BEFORE UPDATE ON sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_by();

-- ============================================================
-- 3. messages 表（消息）
-- ============================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    reasoning TEXT,
    model TEXT,

    -- 审计字段
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access messages in their own sessions"
ON messages FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM sessions
        WHERE sessions.id = messages.session_id
        AND sessions.user_id = auth.uid()
    )
);

CREATE TRIGGER trg_messages_insert
BEFORE INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION set_created_by();

CREATE TRIGGER trg_messages_update
BEFORE UPDATE ON messages
FOR EACH ROW EXECUTE FUNCTION set_updated_by();
