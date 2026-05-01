import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useUserStore } from './stores/userStore'
import { useSettingsStore } from './stores/settingsStore'
import './assets/styles/main.css'
import 'highlight.js/styles/github-dark.min.css'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)

  // Auth check MUST happen before router installation,
  // otherwise the route guard runs before isAuthenticated is set
  const userStore = useUserStore()
  await userStore.checkAuth()

  app.use(router)

  // Load settings from localStorage first (instant, no network call)
  const settingsStore = useSettingsStore()
  settingsStore.loadLocal()

  // Sync settings from backend in background if authenticated
  if (userStore.isAuthenticated) {
    settingsStore.loadSettings().catch(() => {})
  }

  app.mount('#app')
}

bootstrap()
