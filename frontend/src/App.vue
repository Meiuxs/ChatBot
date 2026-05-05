<script setup lang="ts">
import { RouterView } from 'vue-router'
import { Analytics } from '@vercel/analytics/vue'
import { SpeedInsights } from '@vercel/speed-insights/vue'
import ToastNotification from './components/common/ToastNotification.vue'
</script>

<template>
  <Analytics />
  <SpeedInsights />
  <RouterView />
  <ToastNotification />
</template>
