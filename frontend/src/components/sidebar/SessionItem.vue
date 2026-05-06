<script setup lang="ts">
import { ref, nextTick } from 'vue'
import type { Session } from '../../types/chat'

const props = defineProps<{
  session: Session
  active: boolean
}>()

const emit = defineEmits<{
  select: []
  delete: []
  rename: [title: string]
}>()

const editing = ref(false)
const newTitle = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

function handleClick() {
  if (!editing.value) {
    emit('select')
  }
}

function handleDelete(event: MouseEvent) {
  event.stopPropagation()
  if (!editing.value) {
    emit('delete')
  }
}

function startEdit() {
  newTitle.value = props.session.title
  editing.value = true
  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

function saveEdit() {
  if (!editing.value) return
  editing.value = false
  const trimmed = newTitle.value.trim()
  if (trimmed && trimmed !== props.session.title) {
    emit('rename', trimmed)
  }
}

function cancelEdit() {
  editing.value = false
}

function onInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    saveEdit()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelEdit()
  }
}
</script>

<template>
  <div
    class="session-item"
    :class="{ active, editing }"
    @click="handleClick"
  >
    <svg
      class="session-item-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>

    <template v-if="editing">
      <input
        ref="inputRef"
        v-model="newTitle"
        class="session-item-input"
        maxlength="100"
        @keydown="onInputKeydown"
        @blur="saveEdit"
      >
      <span class="session-item-count">{{ newTitle.length }}/100</span>
    </template>
    <span v-else class="session-item-title">{{ session.title }}</span>

    <button
      v-if="!editing"
      class="session-item-edit"
      title="重命名"
      @click="startEdit"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      </svg>
    </button>
    <button
      v-if="!editing"
      class="session-item-delete"
      title="删除会话"
      @click="handleDelete"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.session-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition);
  margin-bottom: 2px;
  min-height: 44px;
}

.session-item:hover {
  background: var(--bg-hover);
}

.session-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.session-item.active {
  background: var(--accent-light);
}

.session-item.active .session-item-edit,
.session-item.active .session-item-delete {
  opacity: 0.5;
}

.session-item.editing {
  cursor: default;
  background: var(--bg-hover);
}

.session-item.editing .session-item-icon {
  opacity: 0.4;
}

.session-item-icon {
  width: 16px;
  height: 16px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.session-item.active .session-item-icon {
  color: var(--accent);
}

.session-item-title {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-item-input {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--bg-surface);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  outline: none;
  min-width: 0;
  font-family: inherit;
  line-height: 1.5;
}

.session-item-input:focus {
  box-shadow: 0 0 0 2px var(--accent-light);
}

.session-item-edit {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  opacity: 0;
  transition: opacity var(--transition), background var(--transition), color var(--transition);
  flex-shrink: 0;
}

.session-item:hover .session-item-edit {
  opacity: 1;
}

.session-item-edit:hover {
  background: var(--bg-hover);
  color: var(--accent);
}

.session-item-edit:focus-visible,
.session-item-delete:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.session-item-delete {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  opacity: 0;
  transition: opacity var(--transition), background var(--transition), color var(--transition);
  flex-shrink: 0;
}

.session-item:hover .session-item-delete {
  opacity: 1;
}

.session-item-delete:hover {
  background: oklch(from var(--danger) l c h / 0.15);
  color: var(--danger);
}

.session-item-input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.session-item-count {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .session-item-edit,
  .session-item-delete {
    opacity: 0.5;
    width: 44px;
    height: 44px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .session-item,
  .session-item-edit,
  .session-item-delete {
    transition: none;
  }
}
</style>
