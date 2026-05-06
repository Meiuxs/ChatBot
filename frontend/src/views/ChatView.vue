<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from '../components/sidebar/Sidebar.vue'
import ChatHeader from '../components/chat/ChatHeader.vue'
import ChatMessages from '../components/chat/ChatMessages.vue'
import ChatInput from '../components/chat/ChatInput.vue'
import SettingsPanel from '../components/settings/SettingsPanel.vue'
import { useChatStore } from '../stores/chatStore'
import { useSidebar } from '../composables/useSidebar'

const API_BASE = import.meta.env.VITE_API_BASE || ''

const route = useRoute()
const chatStore = useChatStore()
const sidebar = useSidebar()
const settingsPanelRef = ref<InstanceType<typeof SettingsPanel> | null>(null)
let isPersisting = false

function openSettings() {
  settingsPanelRef.value?.open()
}

onMounted(async () => {
  await chatStore.loadSessions()
  if (route.params.id) {
    chatStore.switchSession(route.params.id as string)
  }
  window.addEventListener('resize', sidebar.handleResize)
  window.addEventListener('beforeunload', onPageHide)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  window.removeEventListener('resize', sidebar.handleResize)
  window.removeEventListener('beforeunload', onPageHide)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

/** 页面关闭前同步（使用 keepalive 确保请求发出去） */
function onPageHide() {
  if (isPersisting) return
  const sessions = chatStore.sessions
  if (sessions.length === 0) return
  try {
    const raw = localStorage.getItem('chatbot_auth_token')
    const token = raw ? JSON.parse(raw) : null
    fetch(`${API_BASE}/api/v1/sessions/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ sessions }),
      keepalive: true,
    })
  } catch {
    // fetch + keepalive 失败时降级到 localStorage，由 chatService 已有逻辑处理
  }
}

/** 页面隐藏到后台时同步（async/await 在此场景下安全可用） */
async function onVisibilityChange() {
  if (document.visibilityState !== 'hidden' || isPersisting) return
  isPersisting = true
  try {
    await chatStore.persistSessions()
  } finally {
    isPersisting = false
  }
}
</script>

<template>
  <div class="app">
    <Sidebar
      :open="sidebar.isOpen.value"
      @close="sidebar.close()"
    />
    <main
      class="chat-main"
      @touchstart="sidebar.handleTouchStart"
      @touchend="sidebar.handleTouchEnd"
    >
      <ChatHeader
        @toggle-sidebar="sidebar.toggle()"
        @open-settings="openSettings"
      />
      <ChatMessages />
      <ChatInput />
    </main>
    <SettingsPanel ref="settingsPanelRef" />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  height: 100vh;
  animation: app-enter 300ms ease-out;
}

@keyframes app-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-base);
}
</style>
