<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

defineProps<{ sidebarOpen: boolean }>()
defineEmits<{ toggleSidebar: [] }>()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/users': 'VPN Users',
  '/configs': 'Configurations',
  '/logs': 'Service Logs',
  '/settings': 'Settings',
}

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <header class="h-14 flex items-center justify-between px-6 bg-surface-200 border-b border-surface-300 shrink-0">
    <div class="flex items-center gap-3">
      <h1 class="font-semibold text-base text-sm">{{ pageTitles[route.path] || 'TrustTunnel' }}</h1>
    </div>

    <div class="flex items-center gap-3">
      <span class="text-xs text-subtext">{{ auth.username }}</span>
      <button class="btn-ghost btn-sm" @click="logout">
        <span class="i-carbon-logout text-sm" />
        <span class="text-xs">Logout</span>
      </button>
    </div>
  </header>
</template>
