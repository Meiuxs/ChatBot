import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useUserStore } from './stores/userStore'
import { useSettingsStore } from './stores/settingsStore'
import { logger } from './utils/logger'
import './assets/styles/main.css'
import 'highlight.js/styles/github-dark.min.css'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)

  // Capture Vue errors
  app.config.errorHandler = (err, _instance, info) => {
    logger.error(`Vue error [${info}]`, err instanceof Error ? err.message : String(err))
  }

  // Capture unhandled promise rejections
  window.onunhandledrejection = (event) => {
    const msg = event.reason instanceof Error ? event.reason.message : String(event.reason)
    logger.error('Unhandled promise rejection', msg)
  }

  // Auth check MUST happen before router installation,
  // otherwise the route guard runs before isAuthenticated is set
  const userStore = useUserStore()
  await userStore.checkAuth()

  app.use(router)

  // 当 API 返回 401 时，通过 router 跳转而不刷新页面
  // 使用 nextTick 避免与进行中的导航产生竞争条件
  window.addEventListener('auth:unauthorized', () => {
    const store = useUserStore()
    store.isAuthenticated = false
    store.user = null
    if (router.currentRoute.value.path !== '/login') {
      nextTick(() => {
        router.replace('/login').catch(() => {})
      })
    }
  })

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
