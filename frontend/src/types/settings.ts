export interface Settings {
  apiKey: string
  model: string
  provider: string
  temperature: number
  theme: 'light' | 'dark'
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'gpt-4o',
  provider: 'openai',
  temperature: 0.7,
  theme: 'light',
}

export const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'deepseek', label: 'DeepSeek' },
] as const

export interface ModelOption {
  value: string
  label: string
}

/**
 * 模型分类：
 *  - chat     标准聊天模型（支持 temperature）
 *  - reasoning 推理模型（使用 reasoning_effort 替代 temperature）
 *  - latest   最新旗舰模型（GPT-5.x 系列,统一接口）
 */
export const MODELS_BY_PROVIDER: Record<string, ModelOption[]> = {
  openai: [
    // --- GPT-5 系列（最新旗舰）---
    { value: 'gpt-5.4', label: 'GPT-5.4（最新）' },
    { value: 'gpt-5.3', label: 'GPT-5.3' },
    { value: 'gpt-5.2', label: 'GPT-5.2' },
    { value: 'gpt-5.1', label: 'GPT-5.1' },
    { value: 'gpt-5', label: 'GPT-5' },
    // --- GPT-4.1 系列 ---
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
    // --- GPT-4o 系列 ---
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'chatgpt-4o-latest', label: 'ChatGPT-4o Latest' },
    // --- O 系列（推理模型）---
    { value: 'o4-mini', label: 'o4 Mini' },
    { value: 'o3', label: 'o3' },
    { value: 'o3-mini', label: 'o3 Mini' },
    { value: 'o1', label: 'o1' },
  ],
  deepseek: [
    { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
    { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  ],
}

/** 推理模型（使用 reasoning_effort 参数，不支持 temperature） */
export const REASONING_MODELS = new Set([
  'o1', 'o3', 'o3-mini', 'o4-mini',
])

export function getModelsForProvider(provider: string): ModelOption[] {
  return MODELS_BY_PROVIDER[provider] || []
}

export function getProviderDisplayName(provider: string): string {
  const p = PROVIDER_OPTIONS.find((o) => o.value === provider)
  return p?.label ?? provider
}

export function getDefaultProviderForModel(model: string): string {
  for (const [provider, models] of Object.entries(MODELS_BY_PROVIDER)) {
    if (models.some((m) => m.value === model)) return provider
  }
  if (model.startsWith('deepseek-')) return 'deepseek'
  return 'openai'
}
