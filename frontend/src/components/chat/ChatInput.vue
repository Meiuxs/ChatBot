<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChat } from '../../composables/useChat'
import { useSettingsStore } from '../../stores/settingsStore'

const { sendMessage, stopGenerating, sending } = useChat()
const settingsStore = useSettingsStore()

const inputText = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const thinkingEnabled = ref(localStorage.getItem('chatbot_thinking') === 'true')

function persistThinking(val: boolean) {
  localStorage.setItem('chatbot_thinking', String(val))
}
const sendFlash = ref(false)
let sendFlashTimer: ReturnType<typeof setTimeout> | null = null

const showThinkingToggle = computed(() => settingsStore.settings.provider === 'deepseek')

function toggleThinking() {
  const next = !thinkingEnabled.value
  thinkingEnabled.value = next
  persistThinking(next)
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

  // Brief flash feedback
  sendFlash.value = true
  if (sendFlashTimer) clearTimeout(sendFlashTimer)
  sendFlashTimer = setTimeout(() => { sendFlash.value = false }, 400)
}

function handleStop() {
  stopGenerating()
}
</script>

<template>
  <div class="chat-input-area">
    <div class="chat-input-container">
      <div v-if="showThinkingToggle" class="thinking-row">
        <button
          class="thinking-toggle"
          :class="{ active: thinkingEnabled }"
          :disabled="isStreaming"
          @click="toggleThinking"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5z"/>
          </svg>
          <span>深度思考</span>
        </button>
      </div>
      <div class="input-row">
        <textarea
          ref="textareaRef"
          class="chat-input"
          :class="{ flash: sendFlash }"
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
  </div>
</template>

<style scoped>
/* Outer wrapper with border-top divider */
.chat-input-area {
  border-top: 1px solid var(--border);
  background: var(--bg-base);
}

/* Input container */
.chat-input-container {
  padding: 0 20px 16px;
  background: var(--bg-base);
}

@media (max-width: 768px) {
  .chat-input-container {
    padding: 0 12px 12px;
  }
}

/* Thinking toggle row */
.thinking-row {
  display: flex;
  padding: 6px 0 4px;
}

.thinking-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  transition: color var(--transition), background var(--transition);
}

.thinking-toggle:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.thinking-toggle.active {
  color: var(--accent);
}

.thinking-toggle.active:hover {
  background: var(--accent-light);
}

.thinking-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.thinking-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Input row */
.input-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 12px 16px;
  font-size: var(--text-base);
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

.chat-input.flash {
  border-color: var(--success);
  box-shadow: 0 0 0 3px var(--success-light);
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
  .thinking-toggle,
  .chat-input,
  .btn-stop,
  .btn-send {
    transition: none;
  }
}
</style>
