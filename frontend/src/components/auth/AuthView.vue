<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '../../composables/useAuth'
import PasswordStrength from './PasswordStrength.vue'

const { login, register } = useAuth()

const isLogin = ref(true)
const loginEmail = ref('')
const loginPassword = ref('')
const regEmail = ref('')
const regPassword = ref('')
const regConfirm = ref('')
const errorMessage = ref('')
const loading = ref(false)
const showLoginPassword = ref(false)
const showRegPassword = ref(false)
const shakeKey = ref(0)

function switchToRegister() {
  isLogin.value = false
  errorMessage.value = ''
}

function switchToLogin() {
  isLogin.value = true
  errorMessage.value = ''
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function handleLogin() {
  errorMessage.value = ''
  if (!loginEmail.value.trim() || !loginPassword.value) {
    errorMessage.value = '请填写邮箱和密码'
    shakeKey.value++
    return
  }
  if (!validateEmail(loginEmail.value)) {
    errorMessage.value = '邮箱格式不正确'
    shakeKey.value++
    return
  }
  loading.value = true
  try {
    await login(loginEmail.value.trim(), loginPassword.value)
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : '登录失败'
    shakeKey.value++
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  errorMessage.value = ''
  if (!regEmail.value.trim() || !regPassword.value) {
    errorMessage.value = '请填写邮箱和密码'
    shakeKey.value++
    return
  }
  if (!validateEmail(regEmail.value)) {
    errorMessage.value = '邮箱格式不正确'
    shakeKey.value++
    return
  }
  if (regPassword.value.length < 6) {
    errorMessage.value = '密码至少 6 位'
    shakeKey.value++
    return
  }
  if (regPassword.value !== regConfirm.value) {
    errorMessage.value = '两次密码不一致'
    shakeKey.value++
    return
  }
  loading.value = true
  try {
    await register(regEmail.value.trim(), regPassword.value)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '注册失败'
    // Local mode: save succeeded, switch to login
    if (msg.includes('已保存到本地')) {
      errorMessage.value = msg
      setTimeout(() => switchToLogin(), 1500)
    } else {
      errorMessage.value = msg
    }
    shakeKey.value++
  } finally {
    loading.value = false
  }
}


</script>

<template>
  <div class="auth-view">
    <div class="auth-card" :key="shakeKey">
      <div class="auth-logo">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <h1 class="auth-title">ChatBot</h1>
      <p class="auth-subtitle">智能对话系统</p>

      <!-- Login Form -->
      <form
        v-if="isLogin"
        class="auth-form"
        @submit.prevent="handleLogin"
      >
        <div class="auth-field">
          <label for="loginEmail">邮箱</label>
          <input
            id="loginEmail"
            v-model="loginEmail"
            type="email"
            class="auth-input"
            placeholder="your@email.com"
            autocomplete="email"
            required
          >
        </div>
        <div class="auth-field">
          <label for="loginPassword">密码</label>
          <div class="input-with-action">
            <input
              id="loginPassword"
              v-model="loginPassword"
              :type="showLoginPassword ? 'text' : 'password'"
              class="auth-input"
              placeholder="输入密码"
              autocomplete="current-password"
              required
            >
            <button
              type="button"
              class="btn-toggle-visibility"
              @click="showLoginPassword = !showLoginPassword"
            >
              <svg v-if="!showLoginPassword" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          </div>
        </div>
        <div v-if="errorMessage" class="auth-error">{{ errorMessage }}</div>
        <button
          type="submit"
          class="btn-primary auth-submit"
          :disabled="loading"
        >
          {{ loading ? '登录中...' : '登录' }}
        </button>
        <p class="auth-switch">
          还没有账号？
          <button type="button" class="auth-switch-btn" @click="switchToRegister">注册</button>
        </p>
      </form>

      <!-- Register Form -->
      <form
        v-else
        class="auth-form"
        @submit.prevent="handleRegister"
      >
        <div class="auth-field">
          <label for="regEmail">邮箱</label>
          <input
            id="regEmail"
            v-model="regEmail"
            type="email"
            class="auth-input"
            placeholder="your@email.com"
            autocomplete="email"
            required
          >
        </div>
        <div class="auth-field">
          <label for="regPassword">密码</label>
          <div class="input-with-action">
            <input
              id="regPassword"
              v-model="regPassword"
              :type="showRegPassword ? 'text' : 'password'"
              class="auth-input"
              placeholder="至少 6 位"
              autocomplete="new-password"
              required
              minlength="6"
            >
            <button
              type="button"
              class="btn-toggle-visibility"
              @click="showRegPassword = !showRegPassword"
              tabindex="-1"
            >
              <svg v-if="!showRegPassword" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          </div>
          <PasswordStrength :password="regPassword" />
        </div>
        <div class="auth-field">
          <label for="regConfirm">确认密码</label>
          <input
            id="regConfirm"
            v-model="regConfirm"
            type="password"
            class="auth-input"
            placeholder="再次输入密码"
            autocomplete="new-password"
            required
          >
        </div>
        <div v-if="errorMessage" class="auth-error">{{ errorMessage }}</div>
        <button
          type="submit"
          class="btn-primary auth-submit"
          :disabled="loading"
        >
          {{ loading ? '注册中...' : '注册' }}
        </button>
        <p class="auth-switch">
          已有账号？
          <button type="button" class="auth-switch-btn" @click="switchToLogin">登录</button>
        </p>
      </form>
    </div>
  </div>
</template>

<style scoped>
.auth-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, var(--accent), #7c3aed);
  padding: 20px;
}

.auth-card {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  padding: 40px 36px;
  width: 100%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  animation: authSlideIn 0.4s ease-out;
}

.auth-logo {
  margin-bottom: 12px;
  animation: logoFloat 3s ease-in-out infinite;
}

.auth-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.auth-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 28px;
}

.auth-form {
  text-align: left;
}

.auth-field {
  margin-bottom: 16px;
}

.auth-field label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.auth-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.auth-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.input-with-action {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-action .auth-input {
  padding-right: 40px;
}

.btn-toggle-visibility {
  position: absolute;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--text-tertiary);
  border-radius: 4px;
  transition: color var(--transition);
  flex-shrink: 0;
}

.btn-toggle-visibility:hover {
  color: var(--text-secondary);
}

.auth-error {
  font-size: 13px;
  color: var(--danger);
  margin-bottom: 12px;
  padding: 8px 10px;
  background: var(--danger-light);
  border-radius: var(--radius-sm);
  border: 1px solid var(--danger-border);
  animation: errorShake 0.4s ease;
}

.btn-primary {
  width: 100%;
  padding: 12px 20px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background var(--transition), opacity var(--transition);
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-submit {
  margin-top: 4px;
}

.auth-hint {
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 10px;
}

.auth-switch {
  text-align: center;
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 16px;
}

.auth-switch-btn {
  color: var(--accent);
  font-weight: 500;
  background: none;
  border: none;
  cursor: pointer;
  font-size: inherit;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.auth-switch-btn:hover {
  color: var(--accent-hover);
}

@keyframes authSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes logoFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

@keyframes errorShake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

@media (prefers-reduced-motion: reduce) {
  .auth-card {
    animation: none;
  }
  .auth-logo {
    animation: none;
  }
}
</style>
