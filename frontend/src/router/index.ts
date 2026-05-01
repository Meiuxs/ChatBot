import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/userStore'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../components/auth/AuthView.vue'),
    },
    {
      path: '/chat',
      name: 'chat',
      component: () => import('../views/ChatView.vue'),
    },
    {
      path: '/chat/:id',
      name: 'chat-session',
      component: () => import('../views/ChatView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/chat',
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const userStore = useUserStore()
  if (to.path !== '/login' && !userStore.isAuthenticated) {
    next('/login')
  } else if (to.path === '/login' && userStore.isAuthenticated) {
    next('/chat')
  } else {
    next()
  }
})

export default router
