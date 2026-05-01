import { useChatStore } from '../stores/chatStore'
import { useSettingsStore } from '../stores/settingsStore'
import { apiClient } from '../services/apiClient'
import { ref } from 'vue'

export function useChat() {
  const chatStore = useChatStore()
  const settingsStore = useSettingsStore()
  const sending = ref(false)
  const error = ref<string | null>(null)

  async function sendMessage(content: string, thinkingEnabled = false) {
    if (!content.trim() || sending.value) return

    if (!chatStore.currentSessionId) {
      await chatStore.createSession()
    }

    chatStore.addMessage('user', content.trim())
    error.value = null

    const assistantMsg = chatStore.addMessage('assistant', '')
    sending.value = true
    chatStore.setStreaming(true)

    const ctrl = new AbortController()
    chatStore.setAbortController(ctrl)

    try {
      // Only send non-empty messages to the backend (exclude the empty assistant placeholder)
      const conversationMessages = chatStore.currentMessages
        .filter((m) => !(m.role === 'assistant' && m.content === ''))
        .map((m) => ({ role: m.role, content: m.content }))

      await apiClient.postStream(
        '/api/chat/stream',
        {
          sessionId: chatStore.currentSessionId,
          messages: conversationMessages,
          model: settingsStore.settings.model,
          provider: settingsStore.settings.provider,
          temperature: settingsStore.settings.temperature,
          maxTokens: settingsStore.settings.maxTokens,
          reasoningEffort: thinkingEnabled ? 'high' : null,
        },
        (delta) => {
          const current =
            chatStore.currentMessages.find((m) => m.id === assistantMsg.id)?.content || ''
          chatStore.updateMessage(assistantMsg.id, current + delta)
        },
        ctrl.signal,
        (reasoning) => {
          chatStore.updateMessageReasoning(assistantMsg.id, reasoning)
        },
      )
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return

      const mockResponse =
        `这是 AI 的模拟回复。\n\n你说了: "${content.trim()}"\n\n> 后端服务未连接，请在设置中配置后端地址以获取真实回复。`
      chatStore.updateMessage(assistantMsg.id, mockResponse)
    } finally {
      sending.value = false
      chatStore.setStreaming(false)
      chatStore.setAbortController(null)
      // 方案 3: 消息已由后端 _persist_messages 持久化，不再每次对话后全量 sync
    }
  }

  async function retryMessage(content: string) {
    // Use store action to remove the last user+assistant message pair
    chatStore.removeLastPair()
    await sendMessage(content)
  }

  function stopGenerating() {
    chatStore.stopStreaming()
  }

  return { sendMessage, retryMessage, stopGenerating, sending, error }
}
