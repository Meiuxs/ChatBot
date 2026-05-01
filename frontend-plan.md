# ChatBot Vue 3 + TypeScript 前端重构计划

## 上下文

基于现有高保真设计稿（`design/` 目录）和需求/架构文档，使用 Vue 3 + TypeScript 从头重构前端。当前状态：项目仅有设计原型文件（HTML/CSS/JS）和文档，无任何 Vue 工程化配置。目标是建立结构清晰、可维护的前端工程，为后续对接后端（FastAPI + Supabase）做好准备。

---

## 技术栈

| 技术 | 版本 |
|------|------|
| Vue 3 (Composition API + `<script setup>`) | 3.4+ |
| TypeScript | 5.x |
| Vite | 5.x |
| Pinia | 2.x |
| Vue Router | 4.x |
| Tailwind CSS | 3.x |
| marked.js + highlight.js | latest |

## 项目结构

```
ChatBot/
├── frontend/                    # Vue 3 项目根目录
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── assets/
│   │   │   └── styles/
│   │   │       ├── main.css          # Tailwind 入口 + 全局样式
│   │   │       └── tokens.css        # 设计 Token (从 styles.css 移植)
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   ├── AuthView.vue      # 登录/注册视图
│   │   │   │   └── PasswordStrength.vue  # 密码强度指示器
│   │   │   ├── chat/
│   │   │   │   ├── ChatHeader.vue    # 顶部标题栏 + 操作按钮
│   │   │   │   ├── ChatMessages.vue  # 消息列表
│   │   │   │   ├── MessageBubble.vue # 单条消息 (Markdown 渲染)
│   │   │   │   ├── ChatInput.vue     # 输入框 + 发送按钮
│   │   │   │   └── LoadingDots.vue   # AI 思考加载动画
│   │   │   ├── sidebar/
│   │   │   │   ├── Sidebar.vue       # 侧边栏容器
│   │   │   │   └── SessionItem.vue   # 会话列表项
│   │   │   ├── settings/
│   │   │   │   ├── SettingsPanel.vue  # 设置面板容器
│   │   │   │   ├── TabModel.vue      # 模型配置 Tab
│   │   │   │   ├── TabApp.vue        # 应用设置 Tab
│   │   │   │   └── TabAbout.vue      # 关于 Tab
│   │   │   └── common/
│   │   │       ├── ConfirmModal.vue  # 确认弹框
│   │   │       ├── ToastNotification.vue  # Toast 通知
│   │   │       └── IconBase.vue      # SVG 图标组件
│   │   ├── composables/
│   │   │   ├── useAuth.ts            # 认证相关逻辑
│   │   │   ├── useChat.ts            # 聊天相关逻辑
│   │   │   ├── useSidebar.ts         # 侧边栏状态控制
│   │   │   └── useTheme.ts           # 主题切换
│   │   ├── stores/
│   │   │   ├── userStore.ts          # 用户状态 (auth + profile)
│   │   │   ├── chatStore.ts          # 会话 + 消息状态
│   │   │   └── settingsStore.ts      # 设置状态
│   │   ├── services/
│   │   │   ├── apiClient.ts          # HTTP 客户端封装
│   │   │   ├── authService.ts        # 认证 API
│   │   │   ├── chatService.ts        # 聊天 API (含 SSE)
│   │   │   └── settingsService.ts    # 设置 API
│   │   ├── types/
│   │   │   ├── user.ts               # 用户类型
│   │   │   ├── chat.ts               # 会话/消息类型
│   │   │   └── settings.ts           # 设置类型
│   │   ├── utils/
│   │   │   ├── markdown.ts           # Markdown 渲染配置
│   │   │   └── storage.ts            # localStorage 工具
│   │   ├── router/
│   │   │   └── index.ts              # Vue Router 配置
│   │   ├── App.vue                   # 根组件
│   │   └── main.ts                   # 入口文件
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── postcss.config.js
├── design/                          # 保留作为设计参考 (不变)
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── docs/                            # 保留文档 (不变)
```

---

## 架构设计

### 路由设计

```
/login     → AuthView (登录/注册)
/chat      → ChatView (主聊天界面，含侧边栏)
/chat/:id  → ChatView (指定会话)
```

- 未登录用户重定向到 `/login`
- 已登录用户访问 `/login` 重定向到 `/chat`
- 设置面板作为 ChatView 内的侧边抽屉，不单独占用路由

### 状态管理 (Pinia)

```
userStore:
  - state: user, isAuthenticated, loading
  - actions: login, register, logout, checkAuth, fetchUser
  - 持久化: localStorage 存储 token 和用户信息

chatStore:
  - state: sessions[], currentSessionId, messages[], streaming
  - getters: currentSession, sessionList
  - actions: createSession, deleteSession, switchSession, loadMessages,
             addMessage, updateMessage, streamChat, clearChat

settingsStore:
  - state: apiKey, model, temperature, maxTokens, theme
  - getters: isApiKeySet, modelConfig
  - actions: loadSettings, saveSettings, updateModel, resetSettings
```

### 数据流

```
Component → Composable → Store → Service → ApiClient → (Mock API / Backend)
```

- **Development 阶段**: services 层使用 localStorage + mock 数据，与现有 prototype 行为一致
- **Production 阶段**: services 层切换到真实 API 调用，组件和 store 代码无需修改
- **流式响应**: ChatService.streamChat() 返回 AsyncGenerator，chatStore 中逐块更新消息

### Mock 数据策略

初期使用 localStorage 模拟后端：
- 用户认证: localStorage 存储用户列表和当前 session
- 会话管理: localStorage 存储会话列表和消息
- AI 回复: 直接调用 OpenAI API (同现有 prototype)，或返回模拟回复
- 设置: localStorage 存储配置

---

## 实现步骤

### Step 1: 项目初始化
- `npm create vite@latest frontend -- --template vue-ts`
- 安装依赖: pinia, vue-router, tailwindcss, postcss, autoprefixer, marked, highlight.js
- 配置 Tailwind CSS, tsconfig, vite.config
- 配置 `index.html` 入口 (引入字体、marked.js、highlight.js)

### Step 2: 基础框架搭建
- 创建路由配置 (`router/index.ts`)
- 创建 Pinia stores (userStore, chatStore, settingsStore) - 骨架 + 类型定义
- 创建 API client 骨架
- 搭建 App.vue 根组件 + 路由视图
- 实现全局样式 (main.css + tokens.css)

### Step 3: 认证模块
- 实现 AuthView.vue (登录/注册表单切换)
- 实现 PasswordStrength.vue 组件
- 实现 userStore login/register/logout/checkAuth
- 实现 authService (localStorage mock)
- 路由守卫 (未登录重定向)
- 实现 useAuth composable
- 实现用户菜单 + 退出登录 (ChatHeader 中)

### Step 4: 聊天核心功能
- 实现 Sidebar.vue + SessionItem.vue (会话列表、新建/删除/切换)
- 实现 ChatHeader.vue (标题、切换侧边栏、设置入口)
- 实现 ChatMessages.vue + MessageBubble.vue (消息列表、Markdown 渲染、代码高亮)
- 实现 ChatInput.vue (输入框、自动扩展、Ctrl+Enter 发送)
- 实现 LoadingDots.vue (AI 思考动画)
- 实现 chatStore (会话和消息管理)
- 实现 chatService (含 SSE 流式响应)
- 实现 useChat composable (发送消息、流式更新、停止生成)

### Step 5: 设置面板
- 实现 SettingsPanel.vue (侧边抽屉 + 3 Tab 切换)
- 实现 TabModel.vue (API Key、模型选择、Temperature、Max Tokens)
- 实现 TabApp.vue (主题切换、数据导入导出、快捷指令)
- 实现 TabAbout.vue (应用信息、技术栈、清除数据)
- 实现 settingsStore 持久化
- 实现 ConfirmModal.vue 和 ToastNotification.vue

### Step 6: 主题与响应式
- 实现 useTheme composable (浅色/深色切换)
- 完善 CSS Token 系统
- 移动端适配 (侧边栏遮罩、触摸优化)
- `prefers-reduced-motion` 支持

### Step 7: 整合与测试
- 验证所有功能流程完整性
- 修复 UI/UX 细节
- 代码审查

---

## 关键设计决策

1. **Tailwind CSS + 自定义 Token**: 架构文档要求 Tailwind CSS。将现有 styles.css 的设计主题色、间距、圆角等映射为 Tailwind 的 `tailwind.config.js` 扩展主题，同时保留自定义 CSS 变量用于动态主题切换。

2. **Markdown 渲染**: 使用 marked.js 将 AI 回复内容解析为 HTML，使用 highlight.js 进行代码块语法高亮。MessageBubble 组件通过 `v-html` 渲染（使用 DOMPurify 或类似方案确保 XSS 安全）。

3. **SSE 流式处理**: 使用 Fetch API 的 `response.body.getReader()` 读取流，封装为 AsyncGenerator，由 chatStore 驱动逐块更新。

4. **初始 Mock 后端**: 所有 service 层先实现 localStorage 版本，组件开发完成后可无缝切换到真实 API。

5. **API Key 处理**: 前端设置面板中允许用户输入 API Key，但架构设计明确要求最终由后端加密存储。初期简单存储在 localStorage，后端对接时移至后端。

---

## 验证方式

1. `npm run dev` 启动开发服务器，检查页面正确渲染
2. 手动测试完整流程: 注册 → 登录 → 新建会话 → 发送消息 → 查看流式回复 → 切换/删除会话 → 修改设置 → 退出登录
3. 移动端视口测试侧边栏和布局响应式
4. TypeScript 编译检查 (`npx vue-tsc --noEmit`)
5. Vite 构建验证 (`npm run build`)
