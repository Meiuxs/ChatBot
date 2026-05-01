<script setup lang="ts">
const props = defineProps<{
  title: string
  message: string
  visible: boolean
  confirmText?: string
  cancelText?: string
  danger?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

function onOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
    emit('cancel')
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('cancel')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="modal-overlay"
        @click="onOverlayClick"
        @keydown="onKeydown"
        tabindex="-1"
      >
        <div class="modal" role="dialog" aria-modal="true" :aria-label="title">
          <div class="modal-icon" :class="{ 'modal-icon-danger': danger !== false }">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 class="modal-title">{{ title }}</h3>
          <p class="modal-message">{{ message }}</p>
          <div class="modal-actions">
            <button class="btn-secondary" @click="emit('cancel')">
              {{ cancelText || '取消' }}
            </button>
            <button
              class="btn-danger"
              @click="emit('confirm')"
            >
              {{ confirmText || '确认' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  padding: 28px;
  width: 90%;
  max-width: 380px;
  text-align: center;
  box-shadow: var(--shadow-lg);
}

.modal-icon {
  margin-bottom: 16px;
}

.modal-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.modal-message {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 24px;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.btn-secondary {
  padding: 8px 20px;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 500;
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border);
  transition: background var(--transition);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

.btn-danger {
  padding: 8px 20px;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 500;
  background: var(--danger);
  color: white;
  border: none;
  transition: background var(--transition);
}

.btn-danger:hover {
  background: var(--danger-hover);
}

.modal-enter-active, .modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from, .modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal {
  transform: scale(0.95);
}

.modal-leave-to .modal {
  transform: scale(0.95);
}
</style>
