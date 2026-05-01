import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session, Message } from '../types/chat'
import { chatService } from '../services/chatService'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<Session[]>([])
  const currentSessionId = ref<string | null>(null)
  const streaming = ref(false)
  const abortController = ref<AbortController | null>(null)

  const currentSession = computed(() => {
    return sessions.value.find((s) => s.id === currentSessionId.value) || null
  })
  const currentMessages = computed(() => currentSession.value?.messages || [])
  const sessionList = computed(() => sessions.value)

  async function loadSessions() {
    sessions.value = await chatService.getSessions()
    if (sessions.value.length > 0 && !currentSessionId.value) {
      currentSessionId.value = sessions.value[0].id
    }
  }

  async function createSession() {
    const session = await chatService.createSession()
    sessions.value.unshift(session)
    currentSessionId.value = session.id
    return session
  }

  async function deleteSession(id: string) {
    await chatService.deleteSession(id)
    sessions.value = sessions.value.filter((s) => s.id !== id)
    if (currentSessionId.value === id) {
      currentSessionId.value = sessions.value[0]?.id || null
    }
  }

  async function switchSession(id: string) {
    currentSessionId.value = id
    // Try to load messages from backend if the session has none locally
    const session = sessions.value.find((s) => s.id === id)
    if (session && session.messages.length === 0) {
      const messages = await chatService.getSessionMessages(id)
      if (messages.length > 0) {
        session.messages = messages
      }
    }
  }

  function removeLastPair() {
    const session = sessions.value.find((s) => s.id === currentSessionId.value)
    if (session && session.messages.length >= 2) {
      session.messages.splice(session.messages.length - 2, 2)
      session.updatedAt = new Date().toISOString()
    }
  }

  async function persistSessions() {
    await chatService.saveSessions(sessions.value)
  }

  function addMessage(role: Message['role'], content: string): Message {
    const msg: Message = {
      id: generateId(),
      role,
      content,
      createdAt: new Date().toISOString(),
    }
    const session = sessions.value.find((s) => s.id === currentSessionId.value)
    if (session) {
      session.messages.push(msg)
      session.updatedAt = new Date().toISOString()
      // Auto-title on first user message
      if (session.messages.length === 1 && role === 'user') {
        session.title = content.slice(0, 30) + (content.length > 30 ? '...' : '')
      }
    }
    return msg
  }

  function updateMessage(messageId: string, content: string) {
    const session = sessions.value.find((s) => s.id === currentSessionId.value)
    if (session) {
      const msg = session.messages.find((m) => m.id === messageId)
      if (msg) msg.content = content
    }
  }

  function updateMessageReasoning(messageId: string, reasoning: string) {
    const session = sessions.value.find((s) => s.id === currentSessionId.value)
    if (session) {
      const msg = session.messages.find((m) => m.id === messageId)
      if (msg) {
        msg.reasoning = (msg.reasoning || '') + reasoning
      }
    }
  }

  async function renameSession(id: string, title: string) {
    const session = sessions.value.find((s) => s.id === id)
    if (!session) return
    const trimmed = title.trim()
    if (!trimmed || trimmed === session.title) return
    const prevTitle = session.title
    session.title = trimmed.slice(0, 100)
    session.updatedAt = new Date().toISOString()
    try {
      await chatService.updateSessionTitle(id, session.title)
    } catch {
      session.title = prevTitle
      session.updatedAt = new Date().toISOString()
    }
  }

  function setStreaming(val: boolean) {
    streaming.value = val
  }

  function setAbortController(ctrl: AbortController | null) {
    abortController.value = ctrl
  }

  function clearChat() {
    sessions.value = []
    currentSessionId.value = null
    persistSessions()
  }

  function importSessions(newSessions: Session[]) {
    sessions.value = newSessions
    currentSessionId.value = newSessions[0]?.id || null
    persistSessions()
  }

  function stopStreaming() {
    abortController.value?.abort()
    streaming.value = false
    abortController.value = null
    persistSessions()
  }

  return {
    sessions,
    currentSessionId,
    streaming,
    currentSession,
    currentMessages,
    sessionList,
    loadSessions,
    createSession,
    deleteSession,
    switchSession,
    renameSession,
    removeLastPair,
    clearChat,
    importSessions,
    addMessage,
    updateMessage,
    updateMessageReasoning,
    setStreaming,
    setAbortController,
    stopStreaming,
    persistSessions,
  }
})
