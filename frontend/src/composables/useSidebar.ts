import { ref } from 'vue'

export function useSidebar() {
  const isOpen = ref(window.innerWidth > 768)
  const isMobile = ref(window.innerWidth <= 768)
  const touchStartX = ref(0)
  const touchStartY = ref(0)

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

  function handleTouchStart(event: TouchEvent) {
    touchStartX.value = event.touches[0].clientX
    touchStartY.value = event.touches[0].clientY
  }

  function handleTouchEnd(event: TouchEvent) {
    if (!isMobile.value) return
    const dx = event.changedTouches[0].clientX - touchStartX.value
    const dy = event.changedTouches[0].clientY - touchStartY.value
    // Horizontal swipe, more horizontal than vertical, threshold 60px
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
      if (dx > 0 && !isOpen.value) {
        // Swipe right to open
        isOpen.value = true
      } else if (dx < 0 && isOpen.value) {
        // Swipe left to close
        isOpen.value = false
      }
    }
  }

  return { isOpen, isMobile, toggle, open, close, handleResize, handleTouchStart, handleTouchEnd }
}
