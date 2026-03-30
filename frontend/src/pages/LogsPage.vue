<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { serviceApi } from '@/api'

const logs = ref('')
const loading = ref(false)
const autoRefresh = ref(false)
const linesCount = ref(200)
const logsContainer = ref<HTMLElement | null>(null)
let interval: ReturnType<typeof setInterval>

async function load() {
  loading.value = true
  try {
    const res = await serviceApi.logs(linesCount.value)
    logs.value = res.data.logs
    await nextTick()
    if (logsContainer.value) {
      logsContainer.value.scrollTop = logsContainer.value.scrollHeight
    }
  } finally {
    loading.value = false
  }
}

function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) {
    interval = setInterval(load, 3000)
  } else {
    clearInterval(interval)
  }
}

function downloadLogs() {
  const blob = new Blob([logs.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `trusttunnel-${new Date().toISOString().split('T')[0]}.log`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(load)
onUnmounted(() => clearInterval(interval))
</script>

<template>
  <div class="flex flex-col gap-4 h-full max-w-6xl">
    <div class="flex items-center gap-3 flex-wrap">
      <div class="flex items-center gap-2">
        <label class="label mb-0">Lines:</label>
        <select v-model.number="linesCount" class="input w-24 py-1.5" @change="load">
          <option :value="100">100</option>
          <option :value="200">200</option>
          <option :value="500">500</option>
          <option :value="1000">1000</option>
        </select>
      </div>

      <button class="btn-secondary btn-sm" :disabled="loading" @click="load">
        <span :class="loading ? 'i-carbon-in-progress animate-spin' : 'i-carbon-renew'" />
        Refresh
      </button>

      <button
        :class="autoRefresh ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'"
        @click="toggleAutoRefresh"
      >
        <span :class="autoRefresh ? 'i-carbon-pause-filled' : 'i-carbon-play-filled'" />
        {{ autoRefresh ? 'Pause' : 'Auto' }}
      </button>

      <button class="btn-secondary btn-sm ml-auto" :disabled="!logs" @click="downloadLogs">
        <span class="i-carbon-download" />
        Download
      </button>
    </div>

    <div class="card p-0 flex-1 overflow-hidden flex flex-col min-h-0">
      <div class="flex items-center gap-2 px-4 py-2.5 border-b border-surface-300 bg-surface-300/50">
        <span class="w-2 h-2 rounded-full" :class="autoRefresh ? 'bg-green-400 animate-pulse' : 'bg-overlay'" />
        <span class="text-xs text-subtext font-mono">journalctl -u trusttunnel</span>
        <span v-if="autoRefresh" class="text-xs text-green-400 ml-1">● live</span>
      </div>

      <div
        ref="logsContainer"
        class="flex-1 overflow-y-auto p-4 font-mono text-xs text-subtext leading-5 bg-surface-100"
      >
        <pre v-if="logs" class="whitespace-pre-wrap break-all">{{ logs }}</pre>
        <div v-else-if="loading" class="flex justify-center py-8">
          <span class="i-carbon-in-progress animate-spin text-2xl text-primary" />
        </div>
        <p v-else class="text-center text-overlay py-8">No log entries found</p>
      </div>
    </div>
  </div>
</template>
