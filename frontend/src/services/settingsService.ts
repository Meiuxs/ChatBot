import type { Settings } from '../types/settings'
import { DEFAULT_SETTINGS } from '../types/settings'
import { storage, STORAGE_KEYS } from '../utils/storage'
import { apiClient } from './apiClient'

function sanitizeSettings(data: Settings): Settings {
  // localStorage 中不应存储明文 API Key
  return { ...data, apiKey: '' }
}

export const settingsService = {
  async load(): Promise<Settings> {
    try {
      return await apiClient.get<Settings>('/api/v1/settings')
    } catch {
      const local = storage.get<Settings>(STORAGE_KEYS.settings) || { ...DEFAULT_SETTINGS }
      // localStorage 不应包含 API Key
      local.apiKey = ''
      return local
    }
  },

  async save(settings: Settings): Promise<void> {
    try {
      await apiClient.put('/api/v1/settings', settings)
    } catch {
      // Fallback: 存到 localStorage，但不包含 API Key
      storage.set(STORAGE_KEYS.settings, sanitizeSettings(settings))
    }
  },
}
