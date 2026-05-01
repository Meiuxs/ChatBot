import { useUserStore } from '../stores/userStore'
import { useRouter } from 'vue-router'

export function useAuth() {
  const store = useUserStore()
  const router = useRouter()

  async function login(email: string, password: string) {
    await store.login(email, password)
    router.push('/chat')
  }

  async function register(email: string, password: string) {
    await store.register(email, password)
    router.push('/chat')
  }

  async function logout() {
    await store.logout()
    router.push('/login')
  }

  return {
    login,
    register,
    logout,
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    loading: store.loading,
  }
}
