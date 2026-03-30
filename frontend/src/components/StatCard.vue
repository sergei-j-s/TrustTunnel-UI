<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  icon: string
  iconColor?: string
  sub?: string
}>()
</script>

<template>
  <div class="stat-card">
    <div class="flex items-start justify-between">
      <span class="text-xs text-subtext font-medium uppercase tracking-wide">{{ label }}</span>
      <div :class="['w-8 h-8 rounded-lg flex items-center justify-center', iconColor || 'bg-primary/15']">
        <span :class="[icon, 'text-primary text-base']" />
      </div>
    </div>
    <div class="mt-2">
      <span class="text-2xl font-semibold text-base">{{ value }}</span>
      <span v-if="sub" class="ml-2 text-xs text-subtext">{{ sub }}</span>
    </div>
  </div>
</template>
