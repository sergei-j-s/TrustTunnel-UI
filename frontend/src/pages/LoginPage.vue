<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const username = ref('admin')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(username.value, password.value)
    router.push('/dashboard')
  } catch {
    error.value = 'Invalid username or password'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-surface-100 flex items-center justify-center p-4 font-sans">
    <div class="w-full max-w-sm">
      <div class="flex flex-col items-center mb-8">
        <div class="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
          <span class="i-carbon-vpn text-white text-3xl" />
        </div>
        <h1 class="text-xl font-bold text-base">TrustTunnel UI</h1>
        <p class="text-sm text-subtext mt-1">Sign in to manage your VPN</p>
      </div>

      <form class="card shadow-xl" @submit.prevent="handleLogin">
        <div class="flex flex-col gap-4">
          <div>
            <label class="label">Username</label>
            <input
              v-model="username"
              type="text"
              class="input"
              placeholder="admin"
              autocomplete="username"
              required
            />
          </div>

          <div>
            <label class="label">Password</label>
            <input
              v-model="password"
              type="password"
              class="input"
              placeholder="••••••••"
              autocomplete="current-password"
              required
            />
          </div>

          <div v-if="error" class="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
            {{ error }}
          </div>

          <button type="submit" class="btn-primary w-full mt-1" :disabled="loading">
            <span v-if="loading" class="i-carbon-in-progress animate-spin" />
            <span v-else class="i-carbon-login" />
            {{ loading ? 'Signing in...' : 'Sign in' }}
          </button>
        </div>
      </form>

      <p class="text-center text-xs text-overlay mt-4">
        Default: admin / admin
      </p>
    </div>
  </div>
</template>
