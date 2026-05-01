<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  password: string
}>()

const activeBars = computed(() => {
  const len = props.password.length
  if (len === 0) return 0
  if (len <= 3) return 1
  if (len <= 5) return 2
  if (len <= 8) return 3
  if (len <= 11) return 4
  return 5
})
</script>

<template>
  <div class="password-strength" v-if="password.length > 0">
    <span
      v-for="i in 5"
      :key="i"
      class="password-strength-bar"
      :class="{
        active: i <= activeBars,
        weak: activeBars <= 2 && i <= activeBars,
        medium: activeBars === 3 && i <= activeBars,
        strong: activeBars >= 4 && i <= activeBars,
      }"
    />
  </div>
</template>

<style scoped>
.password-strength {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}

.password-strength-bar {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: var(--border);
  transition: background var(--transition);
}

.password-strength-bar.active.weak {
  background: var(--danger);
}

.password-strength-bar.active.medium {
  background: var(--warn);
}

.password-strength-bar.active.strong {
  background: var(--success);
}
</style>
