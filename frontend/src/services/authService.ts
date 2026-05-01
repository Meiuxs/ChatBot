import type { User } from '../types/user'
import { storage, STORAGE_KEYS } from '../utils/storage'
import { apiClient, ApiError } from './apiClient'

const USERS_KEY = 'chatbot_users'

const DEFAULT_USERS: Record<string, string> = {
  'admin@admin.com': 'admin',
}

interface SessionData {
  access_token: string
  refresh_token?: string
}

interface AuthResponse {
  user: User
  session: SessionData
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const authService = {
  async login(email: string, password: string): Promise<{ user: User; token?: string }> {
    try {
      const res = await apiClient.post<AuthResponse>('/api/auth/login', { email, password })
      const token = res.session?.access_token
      if (token) {
        storage.set(STORAGE_KEYS.authToken, token)
      }
      const user: User = { email: res.user?.email ?? email }
      storage.set(STORAGE_KEYS.user, user)
      storage.set(STORAGE_KEYS.isLoggedIn, true)
      return { user, token }
    } catch (err) {
      // Only fall back to localStorage on network errors (server unreachable),
      // NOT when the backend explicitly rejects the credentials
      if (err instanceof ApiError) throw err

      // Fallback: localStorage mock
      await new Promise((r) => setTimeout(r, 300))

      const users = storage.get<Record<string, string>>(USERS_KEY) || {}
      if (Object.keys(users).length === 0) {
        const hashedDefaults: Record<string, string> = {}
        for (const [key, val] of Object.entries(DEFAULT_USERS)) {
          hashedDefaults[key] = await hashPassword(val)
        }
        storage.set(USERS_KEY, hashedDefaults)
      }

      const allUsers = storage.get<Record<string, string>>(USERS_KEY) || {}
      const hashedInput = await hashPassword(password)
      if (allUsers[email] !== hashedInput) {
        throw new Error('邮箱或密码错误')
      }

      const user: User = { email }
      storage.set(STORAGE_KEYS.user, user)
      storage.set(STORAGE_KEYS.isLoggedIn, true)
      return { user }
    }
  },

  async register(email: string, password: string): Promise<{ user: User; token?: string }> {
    try {
      const res = await apiClient.post<AuthResponse>('/api/auth/register', { email, password })
      const token = res.session?.access_token
      if (token) {
        storage.set(STORAGE_KEYS.authToken, token)
      }
      const user: User = { email: res.user?.email ?? email }
      storage.set(STORAGE_KEYS.user, user)
      storage.set(STORAGE_KEYS.isLoggedIn, true)
      return { user, token }
    } catch (err) {
      // Rate limit — fall back to localStorage so the app still works
      if (err instanceof ApiError && err.status === 429) {
        await new Promise((r) => setTimeout(r, 300))
        const users = storage.get<Record<string, string>>(USERS_KEY) || {}
        users[email] = await hashPassword(password)
        storage.set(USERS_KEY, users)
        throw new Error('注册过于频繁，账号已保存到本地，请登录')
      }

      // Other backend errors (duplicate, invalid) — show the message as-is
      if (err instanceof ApiError) throw err

      // Network error — fall back to localStorage
      await new Promise((r) => setTimeout(r, 300))

      const users = storage.get<Record<string, string>>(USERS_KEY) || {}
      if (users[email]) {
        throw new Error('该邮箱已注册')
      }

      users[email] = await hashPassword(password)
      storage.set(USERS_KEY, users)

      throw new Error('注册信息已保存到本地，请登录')
    }
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/api/auth/logout')
    } catch {
      // Fallback: proceed with local logout
    }
    storage.remove(STORAGE_KEYS.authToken)
    storage.remove(STORAGE_KEYS.user)
    storage.set(STORAGE_KEYS.isLoggedIn, false)
  },

  async checkAuth(): Promise<User | null> {
    // Skip backend call if no token exists locally
    const token = storage.get<string>(STORAGE_KEYS.authToken)
    if (!token) {
      const isLoggedIn = storage.get<boolean>(STORAGE_KEYS.isLoggedIn)
      if (!isLoggedIn) return null
      return storage.get<User>(STORAGE_KEYS.user)
    }

    try {
      const res = await apiClient.get<{ email: string }>('/api/auth/me')
      return { email: res.email }
    } catch {
      // Fallback: localStorage
      return storage.get<User>(STORAGE_KEYS.user)
    }
  },
}
