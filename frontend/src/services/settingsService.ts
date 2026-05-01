import type { Settings } from '../types/settings'
import { DEFAULT_SETTINGS } from '../types/settings'
import { storage, STORAGE_KEYS } from '../utils/storage'
import { apiClient } from './apiClient'

export const settingsService = {
  async load(): Promise<Settings> {
    try {
      return await apiClient.get<Settings>('/api/settings')
    } catch {
      return storage.get<Settings>(STORAGE_KEYS.settings) || { ...DEFAULT_SETTINGS }
    }
  },

  async save(settings: Settings): Promise<void> {
    try {
      await apiClient.put('/api/settings', settings)
    } catch {
      storage.set(STORAGE_KEYS.settings, settings)
    }
  },
}
