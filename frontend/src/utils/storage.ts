const STORAGE_WARNING_PREFIX = '[Storage]'

function warn(key: string, error: unknown): void {
  console.warn(`${STORAGE_WARNING_PREFIX} operation failed for key "${key}":`, error)
}

export const storage = {
  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : null
    } catch (e) {
      warn(key, e)
      return null
    }
  },
  set<T>(key: string, value: T): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch (e) {
      warn(key, e)
      return false
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch (e) {
      warn(key, e)
    }
  },
  clear(): void {
    try {
      localStorage.clear()
    } catch (e) {
      warn('clear', e)
    }
  },
}

export const STORAGE_KEYS = {
  settings: 'chatbot_settings',
  sessions: 'chatbot_sessions',
  currentSession: 'chatbot_current_session',
  user: 'chatbot_user',
  isLoggedIn: 'chatbot_is_logged_in',
  authToken: 'chatbot_auth_token',
} as const
