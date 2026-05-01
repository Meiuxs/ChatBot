import type { Session, Message } from '../types/chat'
import { storage, STORAGE_KEYS } from '../utils/storage'
import { apiClient } from './apiClient'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function localGetSessions(): Session[] {
  return storage.get<Session[]>(STORAGE_KEYS.sessions) || []
}

function localSaveSessions(sessions: Session[]): void {
  storage.set(STORAGE_KEYS.sessions, sessions)
}

function toMessage(raw: any): Message {
  return {
    id: raw.id,
    role: raw.role,
    content: raw.content ?? '',
    reasoning: raw.reasoning || undefined,
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
  }
}

function toSession(raw: any): Session {
  const messages = Array.isArray(raw.messages) ? raw.messages.map((m: any) => toMessage(m)) : []
  return {
    id: raw.id,
    title: raw.title ?? '新对话',
    messages,
    model: raw.model,
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.updated_at ?? raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
  }
}

export const chatService = {
  async getSessions(): Promise<Session[]> {
    try {
      const res = await apiClient.get<{ sessions: Session[] }>('/api/sessions')
      return (res.sessions || []).map((s) => toSession(s))
    } catch {
      return localGetSessions()
    }
  },

  async createSession(title?: string): Promise<Session> {
    try {
      const session = await apiClient.post<Session>('/api/sessions', { title })
      return toSession(session)
    } catch {
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
      await apiClient.delete(`/api/sessions/${id}`)
    } catch {
      const sessions = localGetSessions()
      localSaveSessions(sessions.filter((s) => s.id !== id))
    }
  },

  async saveSessions(sessions: Session[]): Promise<void> {
    try {
      await apiClient.put('/api/sessions/sync', { sessions })
    } catch {
      localSaveSessions(sessions)
    }
  },

  async getSessionMessages(sessionId: string): Promise<Message[]> {
    try {
      const res = await apiClient.get<{ messages: Message[] }>(`/api/sessions/${sessionId}/messages`)
      return Array.isArray(res?.messages) ? res.messages.map((m) => toMessage(m)) : []
    } catch {
      const sessions = localGetSessions()
      const session = sessions.find((s) => s.id === sessionId)
      return session?.messages || []
    }
  },

  async updateSessionTitle(id: string, title: string): Promise<void> {
    try {
      await apiClient.put(`/api/sessions/${id}`, { title })
    } catch {
      const sessions = localGetSessions()
      const session = sessions.find((s) => s.id === id)
      if (session) {
        session.title = title
        localSaveSessions(sessions)
      }
    }
  },
}
