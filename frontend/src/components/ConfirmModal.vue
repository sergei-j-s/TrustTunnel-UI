<script setup lang="ts">
defineProps<{
  show: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60" @click="emit('cancel')" />
        <div class="relative card w-full max-w-md shadow-2xl">
          <h3 class="font-semibold text-base mb-2">{{ title }}</h3>
          <p class="text-sm text-subtext mb-5">{{ message }}</p>
          <div class="flex gap-3 justify-end">
            <button class="btn-secondary" @click="emit('cancel')">Cancel</button>
            <button :class="danger ? 'btn-danger' : 'btn-primary'" @click="emit('confirm')">
              {{ confirmLabel || 'Confirm' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
