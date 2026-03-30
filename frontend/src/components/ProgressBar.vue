<script setup lang="ts">
defineProps<{ value: number; max?: number; color?: string }>()
</script>

<template>
  <div class="w-full bg-surface-300 rounded-full h-1.5 overflow-hidden">
    <div
      :class="['h-full rounded-full transition-all', color || 'bg-primary']"
      :style="{ width: `${Math.min((value / (max || 100)) * 100, 100)}%` }"
    />
  </div>
</template>
