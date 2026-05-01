<script setup lang="ts">
import { useToast } from '../../composables/useToast'

const { toasts, removeToast } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast-item"
          :class="`toast-${toast.type}`"
          @click="removeToast(toast.id)"
        >
          <svg v-if="toast.type === 'success'" class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <svg v-else-if="toast.type === 'error'" class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <svg v-else-if="toast.type === 'warning'" class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <svg v-else class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span class="toast-text">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  color: white;
  box-shadow: var(--shadow-md);
  cursor: pointer;
  pointer-events: auto;
  max-width: 360px;
}

.toast-success { background: var(--success); }
.toast-error { background: var(--danger); }
.toast-warning { background: var(--warn); }
.toast-info { background: var(--text-secondary); }

.toast-icon { flex-shrink: 0; }
.toast-text { line-height: 1.4; }

.toast-enter-active { transition: all 0.3s ease; }
.toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from { opacity: 0; transform: translateX(50px); }
.toast-leave-to { opacity: 0; transform: translateX(50px); }
</style>
