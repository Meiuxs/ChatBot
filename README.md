# ChatBot

基于大模型 API 的前后端分离聊天系统，支持多会话管理、Markdown/代码高亮渲染、流式响应（SSE）和用户级模型配置。

## 功能概览

- 用户注册、登录、鉴权（Supabase Auth + JWT）
- 多会话管理（新建、切换、删除、同步）
- 流式聊天（`/api/chat/stream`，打字机效果）
- Markdown 和代码高亮渲染
- 用户设置（Provider、Model、Temperature、Max Tokens）
- 安全策略：API Key 加密存储，不向前端回传明文

## 技术栈

- 前端：Vue 3 + TypeScript + Vite + Pinia + Tailwind CSS
- 后端：FastAPI + Supabase + SSE
- AI Provider：OpenAI、DeepSeek（可扩展）

## 目录结构

```text
ChatBot/
├── frontend/                  # Vue 前端
├── backend/                   # FastAPI 后端
│   ├── app/
│   │   ├── api/               # auth/chat/sessions/settings 路由
│   │   ├── core/              # 配置、数据库、日志、安全
│   │   ├── providers/         # OpenAI/DeepSeek 适配层
│   │   └── schemas/           # Pydantic 数据模型
│   └── supabase_schema.sql    # 数据库建表脚本
└── docs/                      # 需求、技术、架构与部署文档
```

## 快速开始

## 1) 后端启动（FastAPI）

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

启动后可访问：

- 健康检查：`http://localhost:8000/health`
- OpenAPI 文档：`http://localhost:8000/docs`

## 2) 前端启动（Vue）

```bash
cd frontend
npm install
npm run dev
```

默认 Vite 地址通常为 `http://localhost:5173`。

## 环境变量配置

## 前端：`frontend/.env`

```env
VITE_API_BASE=http://localhost:8001
```

> 说明：当前仓库已有该配置；如果你的后端跑在 8000，请改成 `http://localhost:8000`。

## 后端：`backend/.env`

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
API_KEY_SECRET=your-strong-secret
CORS_ORIGINS=["http://localhost:5173"]
```

变量说明：

- `SUPABASE_URL`：Supabase 项目地址
- `SUPABASE_KEY`：Service Role 密钥（仅后端使用）
- `API_KEY_SECRET`：用于加密用户 API Key 的密钥
- `CORS_ORIGINS`：允许跨域来源列表（JSON 数组）

## 核心接口（当前实现）

## 鉴权

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## 聊天

- `POST /api/chat/stream`（SSE 流式返回）

## 会话

- `GET /api/sessions`
- `POST /api/sessions`
- `PUT /api/sessions/{id}`
- `DELETE /api/sessions/{id}`
- `GET /api/sessions/{id}/messages`
- `PUT /api/sessions/sync`

## 设置

- `GET /api/settings`
- `PUT /api/settings`

注意：

- `GET /api/settings` 出于安全策略不返回真实 API Key（`apiKey` 固定为空字符串）
- 会话与消息接口做了用户归属校验，防止越权访问

## 数据库

执行 `backend/supabase_schema.sql` 初始化以下核心表：

- `settings`
- `sessions`
- `messages`

并启用：

- 审计字段与触发器（`created_by/updated_by` 等）
- RLS 策略（结合应用层归属校验）

## 参考文档

- `docs/需求规格说明书.md`
- `docs/技术说明文档.md`
- `docs/架构设计书.md`
- `docs/架构部署文档.md`

## 常见问题

- 前端请求 401：检查是否登录、`Authorization` token 是否存在
- 前端请求失败：确认 `VITE_API_BASE` 与后端端口一致
- 流式无输出：检查代理/网关是否支持 SSE（不要缓冲）
- Supabase 报错：检查 `SUPABASE_URL`、`SUPABASE_KEY` 与表结构是否已初始化
