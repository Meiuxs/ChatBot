<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChat } from '../../composables/useChat'
import { useSettingsStore } from '../../stores/settingsStore'

const { sendMessage, stopGenerating, sending } = useChat()
const settingsStore = useSettingsStore()

const inputText = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const thinkingEnabled = ref(false)

const showThinkingToggle = computed(() => settingsStore.settings.provider === 'deepseek')

function toggleThinking() {
  thinkingEnabled.value = !thinkingEnabled.value
}

const isStreaming = computed(() => {
  return sending.value
})

const canSend = computed(() => {
  return inputText.value.trim().length > 0 && !isStreaming.value
})

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  const lineHeight = 24
  const minHeight = 48
  const maxHeight = lineHeight * 6
  const scrollHeight = el.scrollHeight
  el.style.height = Math.min(Math.max(scrollHeight, minHeight), maxHeight) + 'px'
}

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  inputText.value = target.value
  autoResize()
}

function handleKeydown(event: KeyboardEvent) {
  // Ctrl+Enter to send
  if (event.ctrlKey && event.key === 'Enter') {
    event.preventDefault()
    handleSend()
    return
  }

  // Enter to send, Shift+Enter for newline
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

function handleSend() {
  if (!canSend.value) return
  const text = inputText.value.trim()
  if (!text) return

  sendMessage(text, thinkingEnabled.value)
  inputText.value = ''

  // Reset textarea height
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
}

function handleStop() {
  stopGenerating()
}
</script>

<template>
  <div class="chat-input-area">
    <!-- Thinking mode toggle (only for DeepSeek) -->
    <div
      v-if="showThinkingToggle"
      class="thinking-bar"
      :class="{ active: thinkingEnabled }"
    >
      <div class="thinking-bar-left">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5z"/>
        </svg>
        <span>深度思考模式</span>
      </div>
      <button
        class="thinking-switch"
        :class="{ active: thinkingEnabled }"
        :disabled="isStreaming"
        @click="toggleThinking"
      >
        <span class="thinking-switch-knob"></span>
      </button>
    </div>
    <div class="chat-input-container">
      <textarea
        ref="textareaRef"
        class="chat-input"
        :value="inputText"
        placeholder="输入消息，Enter 发送，Shift+Enter 换行"
        rows="1"
        @input="handleInput"
        @keydown="handleKeydown"
      />
      <button
        v-if="isStreaming"
        class="btn-stop"
        title="停止生成"
        @click="handleStop"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      </button>
      <button
        v-else
        class="btn-send"
        :disabled="!canSend"
        title="发送"
        @click="handleSend"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Outer wrapper with border-top divider */
.chat-input-area {
  border-top: 1px solid var(--border);
  background: var(--bg-base);
}

/* Thinking bar toggle */
.thinking-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 20px 8px;
  padding: 10px 14px;
  font-size: 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  transition: border-color var(--transition), background var(--transition);
}

@media (max-width: 768px) {
  .thinking-bar {
    margin: 0 12px 8px;
  }
}

.thinking-bar.active {
  border-color: var(--accent);
  background: var(--accent-light);
}

.thinking-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-tertiary);
  transition: color var(--transition);
}

.thinking-bar.active .thinking-bar-left {
  color: var(--accent);
}

.thinking-bar-left svg {
  flex-shrink: 0;
}

/* Toggle switch */
.thinking-switch {
  position: relative;
  width: 44px;
  height: 24px;
  background: var(--border);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: background var(--transition);
  flex-shrink: 0;
  padding: 0;
}

.thinking-switch.active {
  background: var(--accent);
}

.thinking-switch:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.thinking-switch:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.thinking-switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  transition: transform var(--transition);
}

.thinking-switch.active .thinking-switch-knob {
  transform: translateX(20px);
}

/* Input row */
.chat-input-container {
  display: flex;
  gap: 12px;
  padding: 10px 20px 20px;
  background: var(--bg-base);
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 12px 16px;
  font-size: 16px;
  color: var(--text-primary);
  resize: none;
  min-height: 48px;
  max-height: 120px;
  outline: none;
  transition: border-color var(--transition), box-shadow var(--transition);
  line-height: 1.5;
}

.chat-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.chat-input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.chat-input::placeholder {
  color: var(--text-tertiary);
}

.chat-input::-webkit-scrollbar {
  width: 6px;
}

.chat-input::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

/* Stop button */
.btn-stop {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  transition: background var(--transition), color var(--transition), border-color var(--transition);
  flex-shrink: 0;
}

.btn-stop:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.btn-stop:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Send button */
.btn-send {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  border-radius: var(--radius-lg);
  color: white;
  transition: background var(--transition), transform var(--transition);
  flex-shrink: 0;
}

.btn-send:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-send:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.btn-send:active:not(:disabled) {
  transform: scale(0.96);
}

.btn-send:disabled {
  background: var(--bg-elevated);
  color: var(--text-tertiary);
  cursor: not-allowed;
  opacity: 0.45;
}

@media (prefers-reduced-motion: reduce) {
  .thinking-bar,
  .thinking-switch,
  .thinking-switch-knob,
  .chat-input,
  .btn-stop,
  .btn-send {
    transition: none;
  }
}
</style>
