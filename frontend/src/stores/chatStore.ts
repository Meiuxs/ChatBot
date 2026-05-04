import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session, Message } from '../types/chat'
import { chatService, generateId } from '../services/chatService'

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<Session[]>([])
  const currentSessionId = ref<string | null>(null)
  const streaming = ref(false)
  const abortController = ref<AbortController | null>(null)
  const dirtySessionIds = ref<Record<string, boolean>>({})

  function markDirty(sessionId: string | null) {
    if (!sessionId) return
    dirtySessionIds.value = { ...dirtySessionIds.value, [sessionId]: true }
  }

  function markAllClean() {
    dirtySessionIds.value = {}
  }

  function markAllDirty(sessionIds: string[]) {
    const map: Record<string, boolean> = {}
    sessionIds.forEach((id) => { map[id] = true })
    dirtySessionIds.value = map
  }

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
    const next = { ...dirtySessionIds.value }
    delete next[id]
    dirtySessionIds.value = next
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
      session.messages = session.messages.slice(0, -2)
      session.updatedAt = new Date().toISOString()
      markDirty(currentSessionId.value)
    }
  }

  async function persistSessions() {
    const dirtyIds = dirtySessionIds.value
    const dirtyIdList = Object.keys(dirtyIds).filter((id) => dirtyIds[id])
    if (dirtyIdList.length === 0) return

    const allSessions = sessions.value
    const dirtySessions = allSessions.filter((s) => dirtyIdList.includes(s.id))
    await chatService.saveSessions(dirtySessions, allSessions)

    markAllClean()
  }

  const AUTO_TITLE_MAX_LENGTH = 30

  function addMessage(role: Message['role'], content: string): Message {
    const msg: Message = {
      id: generateId(),
      role,
      content,
      createdAt: new Date().toISOString(),
    }
    const session = sessions.value.find((s) => s.id === currentSessionId.value)
    if (session) {
      session.messages = [...session.messages, msg]
      session.updatedAt = new Date().toISOString()
      if (session.messages.length === 1 && role === 'user') {
        session.title = content.slice(0, AUTO_TITLE_MAX_LENGTH) + (content.length > AUTO_TITLE_MAX_LENGTH ? '...' : '')
      }
      markDirty(currentSessionId.value)
    }
    return msg
  }

  function updateMessage(messageId: string, content: string) {
    const session = sessions.value.find((s) => s.id === currentSessionId.value)
    if (session) {
      session.messages = session.messages.map((m) =>
        m.id === messageId ? { ...m, content } : m
      )
      markDirty(currentSessionId.value)
    }
  }

  function markMessageError(messageId: string, isError: boolean) {
    const session = sessions.value.find((s) => s.id === currentSessionId.value)
    if (session) {
      session.messages = session.messages.map((m) =>
        m.id === messageId ? { ...m, error: isError } : m
      )
      markDirty(currentSessionId.value)
    }
  }

  function updateMessageReasoning(messageId: string, reasoning: string) {
    const session = sessions.value.find((s) => s.id === currentSessionId.value)
    if (session) {
      session.messages = session.messages.map((m) =>
        m.id === messageId ? { ...m, reasoning: (m.reasoning || '') + reasoning } : m
      )
      markDirty(currentSessionId.value)
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
    markAllClean()
  }

  function importSessions(newSessions: Session[]) {
    sessions.value = newSessions
    currentSessionId.value = newSessions[0]?.id || null
    markAllDirty(newSessions.map((s) => s.id))
    persistSessions()
  }

  function stopStreaming() {
    abortController.value?.abort()
    streaming.value = false
    abortController.value = null
    markDirty(currentSessionId.value)
    persistSessions().catch(() => {})
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
    markMessageError,
    updateMessageReasoning,
    setStreaming,
    setAbortController,
    stopStreaming,
    persistSessions,
  }
})
