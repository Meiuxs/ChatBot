-- ============================================================
-- 迁移脚本：为 messages 表添加 reasoning 字段
-- 用于存储 AI 推理模型的思考过程内容
-- 在 Supabase Dashboard → SQL Editor 中执行
-- 可重复执行（含 IF NOT EXISTS）
-- ============================================================

-- 为已有 messages 表添加 reasoning 列
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reasoning TEXT;

-- 同时补充 model 列（如果还没有）
ALTER TABLE messages ADD COLUMN IF NOT EXISTS model TEXT;

-- ============================================================
-- 验证：查看表结构确认字段已添加
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'messages'
  AND column_name IN ('reasoning', 'model');
