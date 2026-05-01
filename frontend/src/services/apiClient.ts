const API_BASE = import.meta.env.VITE_API_BASE || ''

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

/** 清除登录态并跳转到登录页 */
function onUnauthorized(): void {
  localStorage.removeItem('chatbot_auth_token')
  localStorage.removeItem('chatbot_user')
  localStorage.setItem('chatbot_is_logged_in', 'false')
  window.location.href = '/login'
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
    const res = await fetch(`${API_BASE}${path}`, {
      headers: authHeaders(),
    })
    return handleResponse<T>(res)
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(res)
  },

  async put<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(res)
  },

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    return handleResponse<T>(res)
  },

  async postStream(
    path: string,
    body: unknown,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
    onReasoning?: (text: string) => void,
  ): Promise<void> {
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
            // Reasoning content (type: "reasoning")
            if (parsed.type === 'reasoning' && parsed.delta && onReasoning) {
              onReasoning(parsed.delta)
              continue
            }
            // Support both backend SSE format ({ delta: "..." }) and OpenAI wire format ({ choices: [{ delta: { content: "..." } }] })
            const delta = parsed.delta ?? parsed.content ?? parsed.choices?.[0]?.delta?.content
            if (delta) onChunk(delta)
          } catch {
            /* skip malformed chunk */
          }
        }
      }
    }
  },
}
