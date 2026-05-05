<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useSettingsStore } from '../../stores/settingsStore'
import { useToast } from '../../composables/useToast'
import type { Settings } from '../../types/settings'

const { showToast } = useToast()
import TabModel from './TabModel.vue'
import TabApp from './TabApp.vue'
import TabAbout from './TabAbout.vue'

const settingsStore = useSettingsStore()

const isOpen = ref(false)
const activeTab = ref<'model' | 'app' | 'about'>('model')

// 打开面板时快照一份原始设置，关闭未保存时还原
let _snapshot: Settings | null = null

const tabs = [
  { key: 'model' as const, label: '模型配置' },
  { key: 'app' as const, label: '应用设置' },
  { key: 'about' as const, label: '关于' },
]

async function open(): Promise<void> {
  // 从后端拉取最新设置（覆盖 store 中可能残留的未保存修改）
  await settingsStore.loadSettings()
  _snapshot = { ...settingsStore.settings }
  isOpen.value = true
  activeTab.value = 'model'
}

function close(): void {
  isOpen.value = false
}

function handleOverlayClick(e: MouseEvent): void {
  if ((e.target as HTMLElement).classList.contains('settings-overlay')) {
    cancelAndClose()
  }
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && isOpen.value) {
    cancelAndClose()
  }
}

function cancelAndClose(): void {
  // 未保存：还原快照
  if (_snapshot) {
    settingsStore.updateSettings(_snapshot)
  }
  close()
}

function saveSettings(): void {
  settingsStore.saveSettings()
  _snapshot = { ...settingsStore.settings }
  showToast('设置已保存', 'success')
  close()
}

const showSaveButton = computed(() => activeTab.value === 'model')

defineExpose({ open })

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <!-- Overlay -->
    <div
      class="settings-overlay"
      :class="{ open: isOpen }"
      @click="handleOverlayClick"
    />

    <!-- Settings Panel -->
    <aside
      class="settings-panel"
      :class="{ open: isOpen }"
    >
      <!-- Header -->
      <div class="settings-header">
        <h2 class="settings-title">设置</h2>
        <button
          class="btn-icon settings-close"
          title="关闭"
          @click="cancelAndClose"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <!-- Tabs -->
      <div class="settings-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="settings-tab"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab Content -->
      <div class="settings-content">
        <div
          v-show="activeTab === 'model'"
          class="settings-tab-content"
        >
          <TabModel />
        </div>
        <div
          v-show="activeTab === 'app'"
          class="settings-tab-content"
        >
          <TabApp />
        </div>
        <div
          v-show="activeTab === 'about'"
          class="settings-tab-content"
        >
          <TabAbout />
        </div>

        <!-- Save Button -->
        <div
          v-if="showSaveButton"
          class="setting-actions"
        >
          <button
            class="btn-primary"
            @click="saveSettings"
          >
            保存设置
          </button>
        </div>
      </div>
    </aside>
  </Teleport>
</template>

<style scoped>
/* Overlay */
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 99;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition, 150ms ease);
}

.settings-overlay.open {
  opacity: 1;
  pointer-events: auto;
}

/* Panel */
.settings-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 380px;
  height: 100vh;
  background: var(--bg-surface);
  border-left: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  transform: translateX(100%);
  transition: transform 150ms ease;
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.settings-panel.open {
  transform: translateX(0);
}

/* Header */
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.settings-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.settings-close {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  transition: background var(--transition), color var(--transition);
}

.settings-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.settings-close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Tabs */
.settings-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  padding: 0 16px;
  background: var(--bg-surface);
  flex-shrink: 0;
}

.settings-tab {
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  transition: color var(--transition), border-color var(--transition);
  font-family: inherit;
}

.settings-tab:hover {
  color: var(--text-primary);
}

.settings-tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.settings-tab:active {
  color: var(--accent);
  background: var(--accent-light);
}

.settings-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

/* Content */
.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 20px;
}

.settings-content::-webkit-scrollbar {
  width: 6px;
}

.settings-content::-webkit-scrollbar-track {
  background: transparent;
}

.settings-content::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

.settings-tab-content {
  display: block;
}

/* Save Button */
.setting-actions {
  margin-top: 32px;
}

.btn-primary {
  width: 100%;
  padding: 12px 20px;
  background: var(--accent);
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  font-family: inherit;
  transition: background var(--transition), box-shadow var(--transition);
}

.btn-primary:hover {
  background: var(--accent-hover);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.btn-primary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.btn-primary:active {
  transform: scale(0.98);
}

/* Responsive */
@media (max-width: 768px) {
  .settings-panel {
    width: 100%;
    height: 85vh;
    top: auto;
    bottom: 0;
    border-left: none;
    border-top: 1px solid var(--border);
    transform: translateY(100%);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }

  .settings-panel.open {
    transform: translateY(0);
  }
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .settings-panel,
  .settings-overlay {
    transition-duration: 0.01ms !important;
  }
}
</style>
