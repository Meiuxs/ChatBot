<script setup lang="ts">
import { watch, nextTick, ref, computed } from 'vue'
import { useChatStore } from '../../stores/chatStore'
import MessageBubble from './MessageBubble.vue'
import LoadingDots from './LoadingDots.vue'

const chatStore = useChatStore()
const messagesContainer = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// Watch for new messages to auto-scroll
watch(
  () => chatStore.currentMessages.length,
  () => {
    scrollToBottom()
  }
)

// Watch for streaming content changes
watch(
  () => {
    const msgs = chatStore.currentMessages
    if (msgs.length > 0) {
      return msgs[msgs.length - 1].content
    }
    return ''
  },
  () => {
    scrollToBottom()
  }
)

const shouldShowLoading = computed(() => {
  if (!chatStore.streaming) return false
  const msgs = chatStore.currentMessages
  if (msgs.length === 0) return true
  const lastMsg = msgs[msgs.length - 1]
  return lastMsg.role === 'assistant' && lastMsg.content === '' && !lastMsg.reasoning
})

</script>

<template>
  <div ref="messagesContainer" class="chat-messages">
    <!-- Empty state -->
    <div v-if="chatStore.currentMessages.length === 0 && !chatStore.streaming" class="empty-state">
      <div class="empty-state-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <h3 class="empty-state-title">开始对话</h3>
      <p class="empty-state-desc">在下方输入消息开始与 AI 助手对话</p>
    </div>

    <!-- Message list -->
    <template v-for="message in chatStore.currentMessages" :key="message.id">
      <MessageBubble :message="message" />
    </template>

    <!-- Loading indicator -->
    <div v-if="shouldShowLoading" class="message-loading">
      <LoadingDots />
    </div>
  </div>
</template>

<style scoped>
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.chat-messages::-webkit-scrollbar {
  width: 8px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
}

/* Empty state */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
}

.empty-state-icon {
  width: 48px;
  height: 48px;
  color: var(--text-tertiary);
  margin-bottom: 20px;
}

.empty-state-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.empty-state-desc {
  font-size: 14px;
  color: var(--text-secondary);
  max-width: 280px;
  margin: 0;
}

/* Loading message placeholder */
.message-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  align-self: flex-start;
}

@media (max-width: 768px) {
  .chat-messages {
    padding: 16px;
  }
}
</style>
