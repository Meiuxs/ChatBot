import { ref } from 'vue'

export interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

const toasts = ref<ToastItem[]>([])
let toastId = 0

export function useToast() {
  function showToast(message: string, type: ToastItem['type'] = 'info') {
    const id = ++toastId
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, 3000)
  }

  function removeToast(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return { toasts, showToast, removeToast }
}
