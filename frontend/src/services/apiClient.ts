const API_BASE = import.meta.env.VITE_API_BASE || ''
const DEFAULT_TIMEOUT = 15_000 // 15 秒

function getToken(): string | null {
  try {
    const item = localStorage.getItem('chatbot_auth_token')
    return item ? JSON.parse(item) : null
  } catch {
    return null
  }
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** 清除登录态并派发事件，由 router guard 处理跳转 */
function onUnauthorized(): void {
  localStorage.removeItem('chatbot_auth_token')
  localStorage.removeItem('chatbot_user')
  localStorage.setItem('chatbot_is_logged_in', 'false')
  window.dispatchEvent(new CustomEvent('auth:unauthorized'))
}

function withTimeout(signal?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT)
  // 如果外部 signal 触发，也清理定时器
  if (signal) {
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      controller.abort()
    })
  }
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      onUnauthorized()
    }
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, body.error || body.detail || `HTTP ${response.status}`)
  }
  return response.json()
}

export const apiClient = {
  async get<T>(path: string): Promise<T> {
    const { signal, cleanup } = withTimeout()
    try {
      const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders(), signal })
      return await handleResponse<T>(res)
    } finally {
      cleanup()
    }
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const { signal, cleanup } = withTimeout()
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: authHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal,
      })
      return await handleResponse<T>(res)
    } finally {
      cleanup()
    }
  },

  async put<T>(path: string, body?: unknown): Promise<T> {
    const { signal, cleanup } = withTimeout()
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal,
      })
      return await handleResponse<T>(res)
    } finally {
      cleanup()
    }
  },

  async delete<T>(path: string): Promise<T> {
    const { signal, cleanup } = withTimeout()
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'DELETE',
        headers: authHeaders(),
        signal,
      })
      return await handleResponse<T>(res)
    } finally {
      cleanup()
    }
  },

  async postStream(
    path: string,
    body: unknown,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
    onReasoning?: (text: string) => void,
  ): Promise<void> {
    // 流式请求不使用 DEFAULT_TIMEOUT（15s），因为 AI 生成可能持续数分钟
    // 用户可通过 stopGenerating() 手动中止
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
        signal,
      })

      if (!res.ok) {
        if (res.status === 401) {
          onUnauthorized()
        }
        const errBody = await res.json().catch(() => ({}))
        throw new ApiError(res.status, errBody.error || errBody.detail || `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') return
            try {
              const parsed = JSON.parse(data)
              if (parsed.__event__ && parsed.type === 'save_error' && onReasoning) {
                onReasoning(parsed.content)
                continue
              }
              if (parsed.type === 'reasoning' && onReasoning) {
                const delta = parsed.delta ?? parsed.content ?? ''
                if (delta) onReasoning(delta)
                continue
              }
              const delta = parsed.delta ?? parsed.content ?? parsed.choices?.[0]?.delta?.content
              if (delta) onChunk(delta)
            } catch {
              /* skip malformed chunk */
            }
          }
        }
      }
    } finally {
      // 流式请求不使用 setTimeout 超时，无需 cleanup
    }
  },
}
