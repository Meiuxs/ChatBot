-- 数据库索引迁移：提升后端接口查询性能
-- 在 Supabase Dashboard → SQL Editor 中执行

-- sessions 表：按 user_id 过滤，按 updated_at 排序
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_updated ON sessions(user_id, updated_at DESC);

-- messages 表：按 session_id 过滤，按 created_at 排序
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at);
