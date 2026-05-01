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

const route = useRoute()
const chatStore = useChatStore()
const sidebar = useSidebar()
const settingsPanelRef = ref<InstanceType<typeof SettingsPanel> | null>(null)

function openSettings() {
  settingsPanelRef.value?.open()
}

onMounted(async () => {
  await chatStore.loadSessions()
  if (route.params.id) {
    chatStore.switchSession(route.params.id as string)
  }
  window.addEventListener('resize', sidebar.handleResize)
  // 方案 3: 页面关闭/隐藏时持久化变更
  window.addEventListener('beforeunload', onPageHide)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  window.removeEventListener('resize', sidebar.handleResize)
  window.removeEventListener('beforeunload', onPageHide)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

async function onPageHide() {
  await chatStore.persistSessions()
}

async function onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    await chatStore.persistSessions()
  }
}
</script>

<template>
  <div class="app">
    <Sidebar
      :open="sidebar.isOpen.value"
      @close="sidebar.close()"
    />
    <main class="chat-main">
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
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-base);
}
</style>
