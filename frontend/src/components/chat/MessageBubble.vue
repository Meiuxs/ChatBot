<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import type { Message } from '../../types/chat'
import { renderMarkdown } from '../../utils/markdown'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
})

const COPY_FALLBACK_FAILED = '复制失败'

const props = defineProps<{
  message: Message
  isStreaming?: boolean
}>()

const emit = defineEmits<{
  copyFailed: [message: string]
  retry: []
}>()

const showToolbar = ref(false)
const isTouchDevice = ref(false)
const contentRef = ref<HTMLElement | null>(null)
const reasoningOpen = ref(false)
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

function triggerCopied() {
  copied.value = true
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => { copied.value = false }, 1800)
}

onMounted(() => {
  isTouchDevice.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0
})

function handleCopy() {
  const content = props.message.content
  navigator.clipboard.writeText(content).catch(() => {
    const textarea = document.createElement('textarea')
    textarea.value = content
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
    } catch {
      emit('copyFailed', COPY_FALLBACK_FAILED)
    } finally {
      document.body.removeChild(textarea)
    }
  })
  triggerCopied()
}

function toggleReasoning() {
  reasoningOpen.value = !reasoningOpen.value
}

function onMessageBlur(event: FocusEvent) {
  const related = event.relatedTarget as HTMLElement | null
  const target = event.currentTarget as HTMLElement
  if (related && target.contains(related)) {
    return
  }
  showToolbar.value = false
}

const isUser = computed(() => props.message.role === 'user')
const hasReasoning = computed(() => !isUser.value && !!props.message.reasoning)
const isError = computed(() => props.message.error === true)

function renderContent(content: string): string {
  return renderMarkdown(content)
}

// 首次收到思考内容时自动展开
watch(() => props.message.reasoning, (val, oldVal) => {
  if (val && !oldVal) {
    reasoningOpen.value = true
  }
})

// 仅在流式结束后渲染 Mermaid 图表（避免流式期间每 delta 触发 mermaid.run）
watch(() => props.isStreaming, async (streaming, wasStreaming) => {
  if (wasStreaming && !streaming) {
    await nextTick()
    await renderMermaid()
  }
}, { immediate: false })

// 非流式消息（如历史消息加载）也需渲染 Mermaid
watch(() => props.message.content, async (content, oldContent) => {
  if (isUser.value || props.isStreaming) return
  // 非流式场景：内容变化时渲染 Mermaid
  if (content !== oldContent) {
    await nextTick()
    await renderMermaid()
  }
}, { immediate: true })

async function renderMermaid() {
  if (!contentRef.value) return
  const elements = contentRef.value.querySelectorAll('.mermaid:not([data-processed])')
  if (elements.length === 0) return
  try {
    await mermaid.run({ nodes: Array.from(elements) as HTMLElement[] })
  } catch {
    // mermaid 语法错误时静默处理，保留原始代码文本
  }
}
</script>

<template>
  <div
    class="message"
    :class="{
      user: isUser,
      assistant: message.role === 'assistant',
    }"
    tabindex="0"
    @mouseenter="showToolbar = true"
    @mouseleave="showToolbar = false"
    @focus="showToolbar = true"
    @blur="onMessageBlur"
  >
    <!-- Error message -->
    <div v-if="isError" class="message-content">
      <div class="error-text">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{{ message.content }}</span>
        <button class="error-retry" title="重试" @click="emit('retry')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          重试
        </button>
      </div>
    </div>

    <template v-else>
      <!-- Reasoning content (collapsible) -->
      <div v-if="hasReasoning" class="reasoning-wrapper">
        <button class="reasoning-toggle" @click="toggleReasoning">
          <svg
            class="reasoning-chevron"
            :class="{ open: reasoningOpen }"
            width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>思考过程</span>
        </button>
        <Transition name="reasoning-slide">
          <div v-if="reasoningOpen" class="reasoning-content">{{ message.reasoning }}</div>
        </Transition>
      </div>

      <!-- Normal message content -->
      <div ref="contentRef" class="message-content" v-html="renderContent(message.content)" />
    </template>

    <!-- Toolbar -->
    <div v-show="showToolbar || isTouchDevice" class="message-toolbar">
      <button class="toolbar-btn" :class="{ copied }" title="复制内容" @click="handleCopy">
        <svg v-if="!copied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.message {
  max-width: 680px;
  padding: 14px 18px;
  border-radius: var(--radius-lg);
  font-size: var(--text-base);
  line-height: 1.6;
  position: relative;
}

.message.user {
  margin-left: auto;
  background: linear-gradient(135deg, var(--user-bubble-from) 0%, var(--user-bubble-to) 100%);
  color: var(--bg-surface);
  border-bottom-right-radius: 2px;
  box-shadow: var(--shadow-md);
}

.message.assistant {
  align-self: flex-start;
  background: var(--bg-surface);
  box-shadow: var(--shadow-sm), 0 0 0 1px var(--border);
  border-bottom-left-radius: 2px;
  color: var(--text-primary);
}

.dark .message.assistant {
  background: var(--bg-elevated);
}

.error-text {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--danger);
}

.error-text svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 1px;
}

.error-retry {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--danger);
  cursor: pointer;
  padding: 4px 0;
  transition: opacity var(--transition);
}

.error-retry:hover {
  opacity: 0.8;
}

.error-retry svg {
  width: 14px;
  height: 14px;
}

/* Message content markdown styles */
.message-content {
  overflow-wrap: break-word;
  word-break: break-word;
}

.message-content :deep(p) {
  margin-bottom: 12px;
}

.message-content :deep(p:last-child) {
  margin-bottom: 0;
}

.message-content :deep(p + p) {
  margin-top: 8px;
}

.message-content :deep(code) {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  background: var(--code-inline-bg);
  padding: 2px 6px;
  border-radius: 4px;
}

.message.user .message-content :deep(code) {
  background: rgba(255, 255, 255, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
}

.message.user .message-content :deep(pre) {
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.message.user .message-content :deep(pre code) {
  background: transparent;
  padding: 16px;
  border: none;
}

.message-content :deep(pre) {
  margin: 14px 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--code-bg, #1e1e1e);
}

.message-content :deep(pre code) {
  display: block;
  padding: 16px;
  overflow-x: auto;
  font-size: var(--text-sm);
  line-height: 1.5;
  background: transparent;
}

.message-content :deep(ul),
.message-content :deep(ol) {
  margin: 10px 0;
  padding-left: 24px;
}

.message-content :deep(li) {
  margin-bottom: 6px;
}

.message-content :deep(h1),
.message-content :deep(h2),
.message-content :deep(h3),
.message-content :deep(h4) {
  margin: 20px 0 10px;
  font-weight: 600;
  line-height: 1.3;
}

.message-content :deep(h1:first-child),
.message-content :deep(h2:first-child),
.message-content :deep(h3:first-child),
.message-content :deep(h4:first-child) {
  margin-top: 0;
}

.message-content :deep(h1) {
  font-size: 1.4em;
}

.message-content :deep(h2) {
  font-size: 1.25em;
}

.message-content :deep(h3) {
  font-size: 1.1em;
}

.message-content :deep(blockquote) {
  margin: 14px 0;
  padding: 12px 16px;
  border-left: 3px solid var(--accent);
  background: var(--bg-elevated);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  color: var(--text-secondary);
}

.message-content :deep(a) {
  color: var(--accent);
  text-decoration: none;
}

.message-content :deep(a:hover) {
  text-decoration: underline;
}

.message-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 14px 0;
  font-size: var(--text-sm);
}

.message-content :deep(th),
.message-content :deep(td) {
  padding: 10px 14px;
  border: 1px solid var(--border);
  text-align: left;
}

.message-content :deep(th) {
  background: var(--bg-elevated);
  font-weight: 600;
}

.message-content :deep(tr:nth-child(even)) {
  background: var(--bg-elevated);
}

/* Toolbar */
.message-toolbar {
  display: flex;
  gap: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition);
  margin-top: 4px;
}

.message:hover .message-toolbar,
.message:focus-within .message-toolbar,
.message-toolbar.show-toolbar {
  opacity: 1;
  pointer-events: auto;
}

.message.user .message-toolbar {
  justify-content: flex-end;
}

.toolbar-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background var(--transition), color var(--transition);
  box-shadow: var(--shadow-sm);
}

.toolbar-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.toolbar-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.toolbar-btn.copied {
  color: var(--success);
  pointer-events: none;
}

@media (max-width: 768px) {
  .message {
    max-width: 92%;
  }
}

/* Reasoning section */
.reasoning-wrapper {
  margin-bottom: 12px;
}

.reasoning-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-tertiary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: background var(--transition), color var(--transition);
  width: 100%;
  user-select: none;
}

.reasoning-toggle:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.reasoning-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.reasoning-chevron {
  transition: transform var(--transition);
  flex-shrink: 0;
}

.reasoning-chevron.open {
  transform: rotate(90deg);
}

/* Reasoning slide transition */
.reasoning-slide-enter-active,
.reasoning-slide-leave-active {
  transition: opacity 0.3s ease, max-height 0.3s ease, margin-top 0.3s ease;
  overflow: hidden;
}

.reasoning-slide-enter-from,
.reasoning-slide-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
}

.reasoning-slide-enter-to,
.reasoning-slide-leave-from {
  opacity: 1;
  max-height: 500px;
  margin-top: 8px;
}

.reasoning-badge {
  margin-left: auto;
  font-size: var(--text-xs);
  opacity: 0.6;
}

.reasoning-content {
  margin-top: 8px;
  padding: 12px;
  border-left: 3px solid var(--accent);
  background: var(--bg-elevated);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
}

.message:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .error-retry,
  .toolbar-btn,
  .reasoning-chevron,
  .toolbar-btn.copied {
    transition: none;
  }
}
</style>
