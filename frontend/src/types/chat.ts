export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  role: MessageRole
  content: string
  reasoning?: string
  error?: boolean
  createdAt: string
}

export interface Session {
  id: string
  title: string
  messages: Message[]
  model?: string
  createdAt: string
  updatedAt: string
}

export interface ChatState {
  sessions: Session[]
  currentSessionId: string | null
  streaming: boolean
  abortController: AbortController | null
}
