<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUserStore } from '../../stores/userStore'
import { useAuth } from '../../composables/useAuth'

const emit = defineEmits<{
  toggleSidebar: []
  openSettings: []
}>()

const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const userStore = useUserStore()
const { logout } = useAuth()

const userDropdownOpen = ref(false)
const editingTitle = ref(false)
const newTitle = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

function startEditTitle() {
  if (!chatStore.currentSessionId) return
  newTitle.value = chatStore.currentSession?.title || ''
  editingTitle.value = true
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

function saveEditTitle() {
  if (!editingTitle.value) return
  editingTitle.value = false
  const trimmed = newTitle.value.trim()
  const sessionId = chatStore.currentSessionId
  const session = chatStore.sessions.find(s => s.id === sessionId)
  if (!sessionId || !session) return
  if (trimmed && trimmed !== session.title) {
    chatStore.renameSession(sessionId, trimmed)
  }
}

function cancelEditTitle() {
  editingTitle.value = false
}

function onTitleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    saveEditTitle()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelEditTitle()
  }
}

// Reset editing state when session changes
watch(() => chatStore.currentSessionId, () => {
  editingTitle.value = false
})

function toggleUserDropdown() {
  userDropdownOpen.value = !userDropdownOpen.value
}

function handleLogout() {
  userDropdownOpen.value = false
  logout()
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.user-menu')) {
    userDropdownOpen.value = false
  }
}

// Close dropdown on outside click
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const apiConfigured = computed(() => {
  return !!settingsStore.settings.apiKey
})

</script>

<template>
  <header class="chat-header">
    <button class="btn-icon" title="切换侧边栏" @click="emit('toggleSidebar')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>

    <template v-if="editingTitle && chatStore.currentSession">
      <input
        ref="titleInputRef"
        v-model="newTitle"
        class="chat-title-input"
        maxlength="100"
        @keydown="onTitleKeydown"
        @blur="saveEditTitle"
      >
    </template>
    <h1
      v-else
      class="chat-title"
      :title="chatStore.currentSessionId ? '点击重命名' : undefined"
      @click="startEditTitle"
    >{{ chatStore.currentSession?.title || '新对话' }}</h1>

    <div class="api-status" :class="apiConfigured ? 'configured' : 'unconfigured'" :title="apiConfigured ? 'API Key 已配置' : 'API Key 未配置'">
      <span class="api-status-dot" />
      <span class="api-status-text">{{ apiConfigured ? '已配置' : '未配置' }}</span>
    </div>

    <button class="btn-icon" title="设置" @click="emit('openSettings')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
      </svg>
    </button>

    <div class="user-menu">
      <button class="user-avatar" title="用户菜单" @click="toggleUserDropdown">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>
      <div class="user-dropdown" :class="{ show: userDropdownOpen }">
        <div class="user-dropdown-header">
          <span class="user-dropdown-label">当前用户</span>
          <span class="user-dropdown-email">{{ userStore.user?.email || '-' }}</span>
        </div>
        <div class="user-dropdown-divider" />
        <button class="user-dropdown-item" @click="handleLogout">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          退出登录
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
  height: var(--header-height);
  border-bottom: 1px solid var(--border);
  background: var(--bg-surface);
}

.chat-title {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
  cursor: pointer;
  border-radius: var(--radius-sm);
  padding: 4px 6px;
  margin: -4px -6px;
  transition: background var(--transition);
}

.chat-title:hover {
  background: var(--bg-hover);
}

.chat-title-input {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-surface);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  padding: 4px 6px;
  outline: none;
  font-family: inherit;
  min-width: 0;
}

.chat-title-input:focus {
  box-shadow: 0 0 0 2px var(--accent-light);
}

/* API Key status */
.api-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  cursor: default;
  transition: background var(--transition);
}

.api-status.unconfigured {
  background: var(--danger-light);
  color: var(--danger);
}

.api-status.configured {
  background: var(--success-light);
  color: var(--success);
}

.api-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.api-status-text {
  font-size: 12px;
}

/* Icon button */
.btn-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  transition: background var(--transition), color var(--transition);
  flex-shrink: 0;
}

.btn-icon:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-icon:active {
  background: var(--border);
}

/* User menu */
.user-menu {
  position: relative;
}

.user-avatar {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  transition: background var(--transition), color var(--transition);
}

.user-avatar:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 200px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-8px);
  transition: opacity 150ms ease, transform 150ms ease, visibility 150ms;
  z-index: 100;
}

.user-dropdown.show {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.user-dropdown-header {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-dropdown-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.user-dropdown-email {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.user-dropdown-divider {
  height: 1px;
  background: var(--border);
}

.user-dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 16px;
  font-size: 14px;
  color: var(--text-secondary);
  transition: background var(--transition), color var(--transition);
}

.user-dropdown-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.user-dropdown-item svg {
  flex-shrink: 0;
}

@media (prefers-reduced-motion: reduce) {
  .api-status,
  .btn-icon,
  .user-avatar,
  .user-dropdown,
  .user-dropdown-item,
  .chat-title {
    transition: none;
  }
}
</style>
