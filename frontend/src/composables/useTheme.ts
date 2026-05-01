import { useSettingsStore } from '../stores/settingsStore'

export function useTheme() {
  const settingsStore = useSettingsStore()

  function initTheme() {
    const theme = settingsStore.settings.theme
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  function toggleTheme() {
    settingsStore.toggleTheme()
  }

  return {
    theme: settingsStore.settings.theme,
    initTheme,
    toggleTheme,
  }
}
