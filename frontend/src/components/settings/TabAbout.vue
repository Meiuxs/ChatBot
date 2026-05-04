<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '../../stores/settingsStore'
import { useChatStore } from '../../stores/chatStore'
import { useUserStore } from '../../stores/userStore'
import { MODELS_BY_PROVIDER, getProviderDisplayName } from '../../types/settings'
import { useToast } from '../../composables/useToast'

const { showToast } = useToast()
import ConfirmModal from '../common/ConfirmModal.vue'

const settingsStore = useSettingsStore()
const chatStore = useChatStore()
const userStore = useUserStore()

const showConfirmModal = ref(false)

const techStack = ['Vue 3', 'TypeScript', 'FastAPI', 'Supabase']

const userEmail = computed(() => {
  return userStore.user?.email ?? '-'
})

const currentModelLabel = computed(() => {
  const allModels = Object.values(MODELS_BY_PROVIDER).flat()
  const option = allModels.find((opt) => opt.value === settingsStore.settings.model)
  return option?.label ?? settingsStore.settings.model
})

const currentProviderLabel = computed(() => {
  return getProviderDisplayName(settingsStore.settings.provider)
})

function handleClearAllData(): void {
  showConfirmModal.value = true
}

function confirmClearAllData(): void {
  try {
    chatStore.clearChat()
    settingsStore.updateSettings({ apiKey: '', provider: 'openai', model: 'gpt-4o', temperature: 0.7 })
    settingsStore.saveSettings()
    showToast('所有数据已清除')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '清除数据失败'
    showToast(message)
  } finally {
    showConfirmModal.value = false
  }
}

function cancelClearAllData(): void {
  showConfirmModal.value = false
}
</script>

<template>
  <div class="about-section">
    <div class="about-logo">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        stroke-width="1.5"
        stroke-linecap="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </div>
    <h3 class="about-title">ChatBot</h3>
    <p class="about-version">版本 1.0.0</p>
    <p class="about-desc">基于大模型的智能对话系统</p>
  </div>

  <div class="about-section">
    <div class="about-info-item">
      <span class="about-info-label">当前用户</span>
      <span class="about-info-value">{{ userEmail }}</span>
    </div>
    <div class="about-info-item">
      <span class="about-info-label">当前厂商</span>
      <span class="about-info-value">{{ currentProviderLabel }}</span>
    </div>
    <div class="about-info-item">
      <span class="about-info-label">当前模型</span>
      <span class="about-info-value">{{ currentModelLabel }}</span>
    </div>
  </div>

  <div class="about-section">
    <p class="about-tech">技术栈</p>
    <div class="about-tags">
      <span
        v-for="tech in techStack"
        :key="tech"
        class="about-tag"
      >
        {{ tech }}
      </span>
    </div>
  </div>

  <div class="about-section">
    <button
      class="btn-danger"
      @click="handleClearAllData"
    >
      清除所有数据
    </button>
  </div>

  <ConfirmModal
    :visible="showConfirmModal"
    title="清除所有数据"
    message="确定要清除所有数据吗？此操作不可恢复，包括所有对话记录和设置。"
    confirm-text="确认清除"
    cancel-text="取消"
    @confirm="confirmClearAllData"
    @cancel="cancelClearAllData"
  />
</template>

<style scoped>
.about-section {
  padding: 20px 0;
  border-bottom: 1px solid var(--border);
}

.about-section:first-child {
  padding-top: 0;
}

.about-section:last-child {
  border-bottom: none;
}

.about-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  margin: 0 auto 16px;
  background: var(--accent-light);
  border-radius: 16px;
}

.about-title {
  text-align: center;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px;
}

.about-version {
  text-align: center;
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0 0 8px;
}

.about-desc {
  text-align: center;
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.about-info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
}

.about-info-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.about-info-value {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.about-tech {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 10px;
}

.about-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.about-tag {
  padding: 4px 10px;
  background: var(--bg-elevated);
  border-radius: 20px;
  font-size: 12px;
  color: var(--text-secondary);
}

.btn-danger {
  width: 100%;
  padding: 12px 20px;
  background: var(--danger);
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  color: white;
  cursor: pointer;
  font-family: inherit;
  transition: background var(--transition);
}

.btn-danger:hover {
  background: var(--danger-hover);
}

.btn-danger:active {
  transform: scale(0.97);
}
</style>
