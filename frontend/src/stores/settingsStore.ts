import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Settings } from '../types/settings'
import { DEFAULT_SETTINGS } from '../types/settings'
import { settingsService } from '../services/settingsService'
import { storage, STORAGE_KEYS } from '../utils/storage'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS })
  const loaded = ref(false)

  function loadLocal() {
    const saved = storage.get<Settings>(STORAGE_KEYS.settings)
    if (saved) {
      settings.value = { ...DEFAULT_SETTINGS, ...saved }
    }
    loaded.value = true
    applyTheme(settings.value.theme)
  }

  async function loadSettings() {
    const s = await settingsService.load()
    settings.value = s
    loaded.value = true
    applyTheme(s.theme)
  }

  async function saveSettings() {
    await settingsService.save(settings.value)
    applyTheme(settings.value.theme)
  }

  function updateSettings(partial: Partial<Settings>) {
    settings.value = { ...settings.value, ...partial }
  }

  function applyTheme(theme: 'light' | 'dark') {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  function toggleTheme() {
    settings.value.theme = settings.value.theme === 'light' ? 'dark' : 'light'
    applyTheme(settings.value.theme)
    saveSettings()
  }

  return { settings, loaded, loadSettings, loadLocal, saveSettings, updateSettings, toggleTheme }
})
