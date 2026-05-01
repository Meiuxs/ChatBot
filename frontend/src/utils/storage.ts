export const storage = {
  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : null
    } catch {
      return null
    }
  },
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* noop */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      /* noop */
    }
  },
  clear(): void {
    try {
      localStorage.clear()
    } catch {
      /* noop */
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
