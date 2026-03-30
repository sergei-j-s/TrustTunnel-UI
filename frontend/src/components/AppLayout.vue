<script setup lang="ts">
import { ref } from 'vue'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'

const sidebarOpen = ref(true)
</script>

<template>
  <div class="flex h-screen bg-surface-100 font-sans text-base overflow-hidden">
    <AppSidebar :open="sidebarOpen" @toggle="sidebarOpen = !sidebarOpen" />

    <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
      <AppHeader :sidebar-open="sidebarOpen" @toggle-sidebar="sidebarOpen = !sidebarOpen" />

      <main class="flex-1 overflow-y-auto p-6">
        <router-view />
      </main>
    </div>
  </div>
</template>
