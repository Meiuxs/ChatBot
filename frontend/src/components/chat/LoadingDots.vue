<script setup lang="ts">
// LoadingDots - Animated loading indicator for streaming responses
</script>

<template>
  <div class="loading-dots" aria-label="加载中" role="status">
    <span class="dot" />
    <span class="dot" />
    <span class="dot" />
  </div>
</template>

<style scoped>
.loading-dots {
  display: flex;
  gap: 5px;
  align-items: center;
}

.dot {
  width: 6px;
  height: 6px;
  background: var(--text-tertiary);
  border-radius: 50%;
  animation: bounce 1.4s ease-in-out infinite;
}

.dot:nth-child(1) {
  animation-delay: 0s;
}

.dot:nth-child(2) {
  animation-delay: 0.16s;
}

.dot:nth-child(3) {
  animation-delay: 0.32s;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dot {
    animation: none;
    opacity: 0.5;
  }
}
</style>
