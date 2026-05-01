<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSettingsStore } from '../../stores/settingsStore'
import {
  PROVIDER_OPTIONS,
  getModelsForProvider,
  getProviderDisplayName,
  getModelMaxTokens,
} from '../../types/settings'
import type { Settings } from '../../types/settings'

const settingsStore = useSettingsStore()

const apiKeyVisible = ref(false)

function toggleApiKeyVisibility(): void {
  apiKeyVisible.value = !apiKeyVisible.value
}

// 厂商
const currentProvider = computed({
  get: () => settingsStore.settings.provider,
  set: (val: string) => {
    settingsStore.updateSettings({ provider: val } as Partial<Settings>)
    const models = getModelsForProvider(val)
    if (models.length > 0) {
      settingsStore.updateSettings({ model: models[0].value } as Partial<Settings>)
    }
  },
})

const availableModels = computed(() => getModelsForProvider(currentProvider.value))

// 模型
const currentModel = computed({
  get: () => settingsStore.settings.model,
  set: (val: string) => {
    settingsStore.updateSettings({ model: val } as Partial<Settings>)
  },
})

const apiKey = computed({
  get: () => settingsStore.settings.apiKey,
  set: (val: string) => {
    settingsStore.updateSettings({ apiKey: val } as Partial<Settings>)
  },
})

const temperature = computed({
  get: () => settingsStore.settings.temperature,
  set: (val: number) => {
    settingsStore.updateSettings({ temperature: val } as Partial<Settings>)
  },
})

const maxTokens = computed({
  get: () => settingsStore.settings.maxTokens,
  set: (val: number) => {
    settingsStore.updateSettings({ maxTokens: val } as Partial<Settings>)
  },
})

const activeProviderName = computed(() => getProviderDisplayName(currentProvider.value))

// 当前模型的最大 token 限制
const modelMaxTokens = computed(() => getModelMaxTokens(currentModel.value))

// 模型变化时，如果当前 maxTokens 超出限制则自动调低
watch(currentModel, () => {
  const limit = modelMaxTokens.value
  if (settingsStore.settings.maxTokens > limit) {
    settingsStore.updateSettings({ maxTokens: limit } as Partial<Settings>)
  }
})
</script>

<template>
  <!-- API Key -->
  <div class="setting-group">
    <label for="apiKey">API Key</label>
    <div class="input-with-action">
      <input
        :id="apiKeyVisible ? 'apiKeyText' : 'apiKey'"
        :type="apiKeyVisible ? 'text' : 'password'"
        class="setting-input"
        :placeholder="`${activeProviderName} API Key`"
        :value="apiKey"
        @input="apiKey = ($event.target as HTMLInputElement).value"
      />
      <button
        class="btn-toggle-visibility"
        :title="apiKeyVisible ? '隐藏' : '显示'"
        @click="toggleApiKeyVisibility"
      >
        <svg
          v-if="!apiKeyVisible"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        <svg
          v-else
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      </button>
    </div>
    <p class="api-key-hint">
      请填写 <strong>{{ activeProviderName }}</strong> API Key
    </p>
  </div>

  <!-- Provider Select -->
  <div class="setting-group">
    <label for="provider">AI 厂商</label>
    <select
      id="provider"
      class="setting-select"
      :value="currentProvider"
      @change="currentProvider = ($event.target as HTMLSelectElement).value"
    >
      <option
        v-for="option in PROVIDER_OPTIONS"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </div>

  <!-- Model Select -->
  <div class="setting-group">
    <label for="model">模型</label>
    <select
      id="model"
      class="setting-select"
      :value="currentModel"
      @change="currentModel = ($event.target as HTMLSelectElement).value"
    >
      <option
        v-for="option in availableModels"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </div>

  <!-- Temperature -->
  <div class="setting-group">
    <div class="setting-label-row">
      <label for="temperature">Temperature</label>
      <span class="setting-value">{{ temperature.toFixed(1) }}</span>
    </div>
    <input
      id="temperature"
      type="range"
      class="setting-range"
      min="0"
      max="2"
      step="0.1"
      :value="temperature"
      @input="temperature = parseFloat(($event.target as HTMLInputElement).value)"
    />
  </div>

  <!-- Max Tokens -->
  <div class="setting-group">
    <div class="setting-label-row">
      <label for="maxTokens">Max Tokens</label>
      <span class="setting-value">{{ maxTokens }}</span>
    </div>
    <input
      id="maxTokens"
      type="range"
      class="setting-range"
      min="100"
      :max="modelMaxTokens"
      step="100"
      :value="maxTokens"
      @input="maxTokens = parseInt(($event.target as HTMLInputElement).value, 10)"
    />
    <p class="api-key-hint">当前模型最大支持 {{ modelMaxTokens.toLocaleString() }} tokens</p>
  </div>
</template>

<style scoped>
.setting-group {
  margin-bottom: 28px;
}

.setting-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.setting-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.setting-label-row label {
  margin-bottom: 0;
}

.setting-value {
  font-size: 12px;
  font-weight: 500;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.input-with-action {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-action .setting-input {
  padding-right: 40px;
}

.setting-input {
  width: 100%;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.setting-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.setting-input::placeholder {
  color: var(--text-tertiary);
}

.api-key-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.api-key-hint strong {
  color: var(--accent);
}

.btn-toggle-visibility {
  position: absolute;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  background: none;
  border: none;
  cursor: pointer;
  transition: background var(--transition), color var(--transition);
}

.btn-toggle-visibility:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.setting-select {
  width: 100%;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  cursor: pointer;
  font-family: inherit;
  transition: border-color var(--transition);
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23666666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

.setting-select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.setting-range {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-hover);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.setting-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: transform var(--transition);
}

.setting-range::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.setting-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: none;
}
</style>
