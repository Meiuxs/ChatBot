import type { Session, Message } from '../types/chat'
import { storage, STORAGE_KEYS } from '../utils/storage'
import { apiClient, ApiError } from './apiClient'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function localGetSessions(): Session[] {
  return storage.get<Session[]>(STORAGE_KEYS.sessions) || []
}

function localSaveSessions(sessions: Session[]): void {
  storage.set(STORAGE_KEYS.sessions, sessions)
}

// 后端响应的原始消息结构
interface RawMessage {
  id: string
  role: string
  content?: string
  reasoning?: string
  createdAt?: string
  created_at?: string
}

// 后端响应的原始会话结构
interface RawSession {
  id: string
  title?: string
  messages?: RawMessage[]
  model?: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

function toMessage(raw: RawMessage): Message {
  return {
    id: raw.id,
    role: raw.role as Message['role'],
    content: raw.content ?? '',
    reasoning: raw.reasoning || undefined,
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
  }
}

function toSession(raw: RawSession): Session {
  const messages = Array.isArray(raw.messages) ? raw.messages.map((m) => toMessage(m)) : []
  return {
    id: raw.id,
    title: raw.title ?? '新对话',
    messages,
    model: raw.model,
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.updated_at ?? raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
  }
}

function isNetworkError(err: unknown): boolean {
  // TypeError: Failed to fetch — network error
  if (err instanceof TypeError && err.message.includes('fetch')) return true
  return !(err instanceof ApiError)
}

export const chatService = {
  async getSessions(): Promise<Session[]> {
    try {
      const res = await apiClient.get<{ sessions: RawSession[] }>('/api/v1/sessions')
      return (res.sessions || []).map((s) => toSession(s))
    } catch (err) {
      if (!isNetworkError(err)) throw err
      return localGetSessions()
    }
  },

  async createSession(title?: string): Promise<Session> {
    try {
      const session = await apiClient.post<RawSession>('/api/v1/sessions', { title })
      return toSession(session)
    } catch (err) {
      if (!isNetworkError(err)) throw err
      const now = new Date().toISOString()
      const session: Session = {
        id: generateId(),
        title: title || '新对话',
        messages: [],
        createdAt: now,
        updatedAt: now,
      }
      const sessions = localGetSessions()
      sessions.unshift(session)
      localSaveSessions(sessions)
      return session
    }
  },

  async deleteSession(id: string): Promise<void> {
    try {
      await apiClient.delete(`/api/v1/sessions/${id}`)
    } catch (err) {
      if (!isNetworkError(err)) throw err
      const sessions = localGetSessions()
      localSaveSessions(sessions.filter((s) => s.id !== id))
    }
  },

  async saveSessions(sessions: Session[], localAll?: Session[]): Promise<void> {
    try {
      await apiClient.post('/api/v1/sessions/sync', { sessions })
    } catch (err) {
      if (!isNetworkError(err)) throw err
      localSaveSessions(localAll || sessions)
    }
  },

  async getSessionMessages(sessionId: string): Promise<Message[]> {
    try {
      const res = await apiClient.get<{ messages: RawMessage[] }>(`/api/v1/sessions/${sessionId}/messages`)
      return Array.isArray(res?.messages) ? res.messages.map((m) => toMessage(m)) : []
    } catch (err) {
      if (!isNetworkError(err)) throw err
      const sessions = localGetSessions()
      const session = sessions.find((s) => s.id === sessionId)
      return session?.messages || []
    }
  },

  async updateSessionTitle(id: string, title: string): Promise<void> {
    try {
      await apiClient.put(`/api/v1/sessions/${id}`, { title })
    } catch (err) {
      if (!isNetworkError(err)) throw err
      const sessions = localGetSessions()
      const session = sessions.find((s) => s.id === id)
      if (session) {
        session.title = title
        localSaveSessions(sessions)
      }
    }
  },
}

export { generateId }
