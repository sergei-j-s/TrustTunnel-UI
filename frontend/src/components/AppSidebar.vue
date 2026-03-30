<script setup lang="ts">
import { useRoute } from 'vue-router'

defineProps<{ open: boolean }>()
defineEmits<{ toggle: [] }>()

const route = useRoute()

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'i-carbon-dashboard' },
  { to: '/users', label: 'VPN Users', icon: 'i-carbon-user-multiple' },
  { to: '/configs', label: 'Configs', icon: 'i-carbon-settings-adjust' },
  { to: '/logs', label: 'Logs', icon: 'i-carbon-document' },
  { to: '/setup', label: 'Setup Wizard', icon: 'i-carbon-magic-wand' },
  { to: '/settings', label: 'Settings', icon: 'i-carbon-settings' },
]
</script>

<template>
  <aside
    :class="[
      'flex flex-col bg-surface-200 border-r border-surface-300 transition-all duration-300 shrink-0',
      open ? 'w-56' : 'w-16',
    ]"
  >
    <div class="flex items-center gap-3 px-4 py-4 h-14 border-b border-surface-300">
      <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
        <span class="i-carbon-vpn text-white text-base" />
      </div>
      <span v-if="open" class="font-semibold text-base text-sm truncate">TrustTunnel</span>
    </div>

    <nav class="flex-1 p-2 flex flex-col gap-1">
      <router-link
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :class="[
          'sidebar-link',
          route.path === item.to
            ? 'bg-primary/15 text-primary'
            : 'text-subtext hover:bg-surface-300 hover:text-base',
        ]"
      >
        <span :class="[item.icon, 'shrink-0 text-base']" />
        <span v-if="open" class="truncate">{{ item.label }}</span>
      </router-link>
    </nav>

    <div class="p-2 border-t border-surface-300">
      <div
        :class="['sidebar-link text-subtext hover:bg-surface-300 hover:text-base', !open && 'justify-center']"
        @click="$emit('toggle')"
      >
        <span :class="open ? 'i-carbon-chevron-left' : 'i-carbon-chevron-right'" class="shrink-0 text-base" />
        <span v-if="open" class="text-xs">Collapse</span>
      </div>
    </div>
  </aside>
</template>
