<script setup lang="ts">
import { watch, ref, computed } from 'vue'
import { useChatStore } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useChat } from '../../composables/useChat'
import MessageBubble from './MessageBubble.vue'
import LoadingDots from './LoadingDots.vue'

const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const { sendMessage, retryMessage } = useChat()

const quickActions = [
  { label: '解释量子计算', text: '请用简单的语言解释量子计算的基本原理' },
  { label: '写一首诗', text: '写一首关于人工智能的现代诗' },
  { label: '代码审查', text: '帮我审查一段 Python 代码的最佳实践' },
  { label: '学习建议', text: '如何高效学习一门新的编程语言？' },
]
const apiConfigured = computed(() => !!settingsStore.settings.apiKey)
const messagesContainer = ref<HTMLElement | null>(null)

let scrollRafId: number | null = null

function scrollToBottom() {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
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

function handleRetry(messageId: string) {
  const msgs = chatStore.currentMessages
  if (msgs.length < 2) return
  const userMsg = msgs[msgs.length - 2]
  const errorMsg = msgs[msgs.length - 1]
  if (userMsg.role !== 'user' || errorMsg.id !== messageId) return
  retryMessage(userMsg.content)
}

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
      <div v-if="!apiConfigured" class="empty-state-hint">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>请先配置 API Key，点击右上角 <strong>设置</strong> 进入模型配置</span>
      </div>
      <div v-if="apiConfigured" class="quick-actions">
        <button
          v-for="action in quickActions"
          :key="action.label"
          class="quick-action-btn"
          @click="sendMessage(action.text, false)"
        >
          {{ action.label }}
        </button>
      </div>
    </div>

    <!-- Message list -->
    <template v-for="message in chatStore.currentMessages" :key="message.id">
      <div class="message-wrapper">
        <MessageBubble :message="message" :is-streaming="chatStore.streaming" @retry="handleRetry(message.id)" />
      </div>
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

.empty-state-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 10px 16px;
  background: var(--warn-light);
  border: 1px solid var(--warn);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-primary);
}

.empty-state-hint svg {
  flex-shrink: 0;
  color: var(--warn);
}

/* Quick action buttons */
.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 20px;
  max-width: 400px;
}

.quick-action-btn {
  padding: 8px 16px;
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
  white-space: nowrap;
}

.quick-action-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-light);
}

.quick-action-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Virtual scroll optimization - defer off-screen rendering */
.message-wrapper {
  display: flex;
  content-visibility: auto;
  contain-intrinsic-size: auto 200px;
  contain: layout style;
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
