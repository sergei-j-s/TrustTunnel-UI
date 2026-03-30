import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('tt_token'))
  const username = ref<string | null>(localStorage.getItem('tt_username'))

  const isAuthenticated = computed(() => !!token.value)

  async function login(user: string, password: string) {
    const res = await authApi.login(user, password)
    token.value = res.data.token
    username.value = res.data.username
    localStorage.setItem('tt_token', res.data.token)
    localStorage.setItem('tt_username', res.data.username)
  }

  function logout() {
    token.value = null
    username.value = null
    localStorage.removeItem('tt_token')
    localStorage.removeItem('tt_username')
  }

  return { token, username, isAuthenticated, login, logout }
})
