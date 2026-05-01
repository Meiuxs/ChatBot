import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '../types/user'
import { authService } from '../services/authService'

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = ref(false)
  const loading = ref(true)

  async function checkAuth() {
    loading.value = true
    try {
      const u = await authService.checkAuth()
      if (u) {
        user.value = u
        isAuthenticated.value = true
      }
    } finally {
      loading.value = false
    }
  }

  async function login(email: string, password: string) {
    const { user: u } = await authService.login(email, password)
    user.value = u
    isAuthenticated.value = true
  }

  async function register(email: string, password: string) {
    const { user: u } = await authService.register(email, password)
    user.value = u
    isAuthenticated.value = true
  }

  async function logout() {
    await authService.logout()
    user.value = null
    isAuthenticated.value = false
  }

  return { user, isAuthenticated, loading, checkAuth, login, register, logout }
})
