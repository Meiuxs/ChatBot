const CLIENT_TRACE_ID = generateId()

function generateId(): string {
  const chars = 'abcdef0123456789'
  let id = ''
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

type LogLevel = 'INFO' | 'WARN' | 'ERROR'

const isDev = import.meta.env.DEV

function formatMessage(level: LogLevel, message: string, data?: unknown): string {
  const ts = new Date().toISOString().slice(11, 23)
  const prefix = `[${CLIENT_TRACE_ID}] [${level}] [${ts}]`
  if (data !== undefined) {
    return `${prefix} ${message} ${typeof data === 'string' ? data : JSON.stringify(data)}`
  }
  return `${prefix} ${message}`
}

export const logger = {
  getTraceId: (): string => CLIENT_TRACE_ID,

  info: (message: string, data?: unknown): void => {
    if (isDev) {
      console.log(formatMessage('INFO', message, data))
    }
  },

  warn: (message: string, data?: unknown): void => {
    if (isDev) {
      console.warn(formatMessage('WARN', message, data))
    }
  },

  error: (message: string, data?: unknown): void => {
    const formatted = formatMessage('ERROR', message, data)
    if (isDev) {
      console.error(formatted)
    }
    // 生产环境保留日志供调试按需获取
    if (typeof window !== 'undefined') {
      const entries = (window as any).__log_entries ?? []
      entries.push(formatted)
      if (entries.length > 200) entries.shift()
      ;(window as any).__log_entries = entries
    }
  },
}
