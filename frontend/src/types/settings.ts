export interface Settings {
  apiKey: string
  model: string
  provider: string
  temperature: number
  maxTokens: number
  theme: 'light' | 'dark'
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'gpt-4o',
  provider: 'openai',
  temperature: 0.7,
  maxTokens: 2000,
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

export const MODELS_BY_PROVIDER: Record<string, ModelOption[]> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'o1-mini', label: 'o1 Mini' },
    { value: 'o1-preview', label: 'o1 Preview' },
  ],
  deepseek: [
    { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
    { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  ],
}

export function getModelsForProvider(provider: string): ModelOption[] {
  return MODELS_BY_PROVIDER[provider] || []
}

export function getProviderDisplayName(provider: string): string {
  const p = PROVIDER_OPTIONS.find((o) => o.value === provider)
  return p?.label ?? provider
}

/** 获取某个模型所属的默认厂商 */
export function getDefaultProviderForModel(model: string): string {
  for (const [provider, models] of Object.entries(MODELS_BY_PROVIDER)) {
    if (models.some((m) => m.value === model)) return provider
  }
  if (model.startsWith('deepseek-')) return 'deepseek'
  return 'openai'
}

/** 各模型的最大输出 token 上限 */
export const MODEL_MAX_OUTPUT_TOKENS: Record<string, number> = {
  'gpt-4o': 16384,
  'gpt-4o-mini': 16384,
  'gpt-4-turbo': 4096,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 4096,
  'o1-mini': 65536,
  'o1-preview': 32768,
  'deepseek-v4-flash': 1_000_000,
  'deepseek-v4-pro': 1_000_000,
}

/** 获取模型的最大输出 token 上限，未知模型返回 1,000,000 */
export function getModelMaxTokens(model: string): number {
  return MODEL_MAX_OUTPUT_TOKENS[model] ?? 1_000_000
}
