<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChatStore } from '../../stores/chatStore'
import SessionItem from './SessionItem.vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const chatStore = useChatStore()
const searchQuery = ref('')

const filteredSessions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return chatStore.sessions
  return chatStore.sessions.filter(s => s.title.toLowerCase().includes(q))
})

function handleNewChat() {
  chatStore.createSession()
}

function handleSelectSession(id: string) {
  chatStore.switchSession(id)
  if (window.innerWidth <= 768) {
    emit('close')
  }
}

function handleDeleteSession(id: string) {
  chatStore.deleteSession(id)
}

function handleRenameSession(id: string, title: string) {
  chatStore.renameSession(id, title)
}

function handleOverlayClick() {
  emit('close')
}
</script>

<template>
  <!-- Mobile overlay -->
  <Transition name="fade">
    <div
      v-if="open"
      class="sidebar-overlay"
      @click="handleOverlayClick"
    />
  </Transition>

  <Transition name="slide">
    <aside class="sidebar" :class="{ open }">
      <div class="sidebar-header">
        <h2 class="sidebar-title">会话</h2>
        <button class="btn-icon" title="新建会话" @click="handleNewChat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div class="sidebar-search">
        <svg class="sidebar-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          v-model="searchQuery"
          class="sidebar-search-input"
          placeholder="搜索会话..."
          type="text"
        >
      </div>

      <div class="session-list">
        <div v-if="filteredSessions.length === 0" class="session-list-empty">
          <svg v-if="searchQuery" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <svg v-else width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <p>暂无会话</p>
        </div>
        <div v-if="filteredSessions.length === 0 && searchQuery.trim()" class="session-list-empty">
          <p>未找到匹配的会话</p>
        </div>
        <SessionItem
          v-for="(session, index) in filteredSessions"
          :key="session.id"
          :session="session"
          :active="session.id === chatStore.currentSessionId"
          :style="{ '--stagger': index }"
          @select="handleSelectSession(session.id)"
          @delete="handleDeleteSession(session.id)"
          @rename="(title: string) => handleRenameSession(session.id, title)"
        />
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  height: 100vh;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.sidebar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  margin: 0;
}

.sidebar-search {
  position: relative;
  padding: 8px 12px 4px;
}

.sidebar-search-icon {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
}

.sidebar-search-input {
  width: 100%;
  padding: 8px 10px 8px 32px;
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  outline: none;
  font-family: inherit;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.sidebar-search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-light);
}

.sidebar-search-input::placeholder {
  color: var(--text-tertiary);
}

.sidebar-search-input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px 12px;
}

.session-list::-webkit-scrollbar {
  width: 6px;
}

.session-list::-webkit-scrollbar-track {
  background: transparent;
}

.session-list::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

.session-list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--text-tertiary);
}

.session-list-empty svg {
  width: 32px;
  height: 32px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.session-list-empty p {
  font-size: 13px;
  line-height: 1.5;
}

.session-list > :deep(.session-item) {
  animation: item-enter 300ms ease-out both;
  animation-delay: calc(var(--stagger, 0) * 30ms);
}

@keyframes item-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
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
}

.btn-icon:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-icon:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.btn-icon:active {
  background: var(--border);
}

/* Mobile responsive */
.sidebar-overlay {
  display: none;
}

@media (max-width: 768px) {
  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 40;
  }

  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    z-index: 50;
    transform: translateX(-100%);
    transition: transform 150ms ease;
  }

  .sidebar.open {
    transform: translateX(0);
  }
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 150ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 150ms ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .sidebar,
  .sidebar-overlay,
  .fade-enter-active,
  .fade-leave-active,
  .slide-enter-active,
  .slide-leave-active {
    transition: none;
  }
}
</style>
