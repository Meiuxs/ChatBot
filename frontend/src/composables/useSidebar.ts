import { ref } from 'vue'

export function useSidebar() {
  const isOpen = ref(window.innerWidth > 768)
  const isMobile = ref(window.innerWidth <= 768)

  function toggle() {
    isOpen.value = !isOpen.value
  }

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  function handleResize() {
    isMobile.value = window.innerWidth <= 768
    if (window.innerWidth > 768) {
      isOpen.value = true
    } else {
      isOpen.value = false
    }
  }

  return { isOpen, isMobile, toggle, open, close, handleResize }
}
