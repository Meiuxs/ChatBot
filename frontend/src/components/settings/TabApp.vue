<script setup lang="ts">
import { ref } from 'vue'
import { useChatStore } from '../../stores/chatStore'
import { useTheme } from '../../composables/useTheme'
import { useToast } from '../../composables/useToast'

const { showToast } = useToast()

const chatStore = useChatStore()
const { theme, toggleTheme } = useTheme()

const fileInputRef = ref<HTMLInputElement | null>(null)

const shortcuts = ref([
  { name: '代码助手', prompt: '你是一个编程助手' },
  { name: '翻译助手', prompt: '你是一个翻译助手' },
  { name: '文案润色', prompt: '请润色以下文案' },
])

function setTheme(newTheme: 'light' | 'dark'): void {
  if (theme !== newTheme) {
    toggleTheme()
  }
}

function exportData(): void {
  try {
    const sessions = chatStore.sessions
    if (!sessions || sessions.length === 0) {
      showToast('没有可导出的对话数据')
      return
    }

    const data = JSON.stringify(sessions, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chatbot-conversations-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showToast('对话数据已导出')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '导出失败'
    showToast(message)
  }
}

function importData(): void {
  fileInputRef.value?.click()
}

function handleFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e: ProgressEvent<FileReader>) => {
    try {
      const text = e.target?.result as string
      const data = JSON.parse(text)

      if (!Array.isArray(data)) {
        showToast('无效的导入文件格式')
        return
      }

      chatStore.importSessions(data)
      showToast(`已导入 ${data.length} 个会话`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '导入失败，请检查文件格式'
      showToast(message)
    } finally {
      input.value = ''
    }
  }
  reader.onerror = () => {
    showToast('读取文件失败')
    input.value = ''
  }
  reader.readAsText(file)
}

function editShortcut(index: number): void {
  showToast('编辑指令: ' + shortcuts.value[index].name)
}

function addShortcut(): void {
  showToast('添加指令功能开发中')
}
</script>

<template>
  <!-- Theme -->
  <div class="setting-section-title">主题</div>
  <div class="setting-group">
    <label>主题模式</label>
    <div class="theme-selector">
      <button
        class="theme-option"
        :class="{ active: theme === 'light' }"
        @click="setTheme('light')"
      >
        <span class="theme-icon">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        </span>
        <span>浅色</span>
      </button>
      <button
        class="theme-option"
        :class="{ active: theme === 'dark' }"
        @click="setTheme('dark')"
      >
        <span class="theme-icon">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </span>
        <span>深色</span>
      </button>
    </div>
  </div>

  <!-- Data Management -->
  <div class="setting-section-title">数据管理</div>
  <div class="setting-group">
    <label>对话数据</label>
    <div class="action-buttons">
      <button
        class="btn-secondary setting-action-btn"
        @click="exportData"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        导出对话
      </button>
      <button
        class="btn-secondary setting-action-btn"
        @click="importData"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        导入对话
      </button>
    </div>
  </div>

  <!-- Hidden File Input -->
  <input
    ref="fileInputRef"
    type="file"
    accept=".json"
    style="display: none"
    @change="handleFileChange"
  />

  <!-- Shortcuts -->
  <div class="setting-section-title">快捷指令</div>
  <div class="setting-group">
    <label>指令模板</label>
    <div class="shortcut-list">
      <div
        v-for="(shortcut, index) in shortcuts"
        :key="index"
        class="shortcut-item"
      >
        <span class="shortcut-name">{{ shortcut.name }}</span>
        <button
          class="btn-icon shortcut-edit"
          title="编辑"
          @click="editShortcut(index)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </div>
    </div>
    <button
      class="btn-secondary setting-action-btn"
      @click="addShortcut"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      添加指令
    </button>
  </div>
</template>

<style scoped>
.setting-section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
  margin-top: 8px;
}

.setting-section-title:first-child {
  margin-top: 0;
}

.setting-group {
  margin-bottom: 28px;
}

.setting-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

/* Theme Selector */
.theme-selector {
  display: flex;
  gap: 8px;
}

.theme-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  background: var(--bg-base);
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  transition: border-color var(--transition), background var(--transition);
}

.theme-option:hover {
  border-color: var(--border-strong);
}

.theme-option.active {
  border-color: var(--accent);
  background: var(--accent-light);
  color: var(--accent);
}

.theme-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 8px;
}

.setting-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px;
  font-size: 13px;
  font-family: inherit;
}

.btn-secondary {
  padding: 9px 18px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  transition: background var(--transition);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

.btn-secondary:active {
  background: var(--border);
}

.btn-secondary.setting-action-btn:active {
  transform: scale(0.97);
}

/* Shortcut List */
.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--bg-base);
  border-radius: var(--radius-sm);
}

.shortcut-name {
  font-size: 14px;
  color: var(--text-primary);
}

.shortcut-edit {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity var(--transition), background var(--transition);
}

.shortcut-edit:hover {
  opacity: 1;
  background: var(--bg-hover);
}
</style>
