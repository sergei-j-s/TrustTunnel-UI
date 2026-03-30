<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { dashboardApi, serviceApi } from '@/api'

const router = useRouter()
import StatCard from '@/components/StatCard.vue'
import ProgressBar from '@/components/ProgressBar.vue'

const data = ref<Record<string, any> | null>(null)
const loading = ref(true)
const actionLoading = ref(false)
let interval: ReturnType<typeof setInterval>

async function load() {
  try {
    const res = await dashboardApi.get()
    data.value = res.data
  } finally {
    loading.value = false
  }
}

async function serviceAction(action: 'start' | 'stop' | 'restart') {
  actionLoading.value = true
  try {
    await serviceApi.control(action)
    await load()
  } finally {
    actionLoading.value = false
  }
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatBytes(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb} MB`
}

onMounted(() => {
  load()
  interval = setInterval(load, 10000)
})

onUnmounted(() => clearInterval(interval))
</script>

<template>
  <div class="flex flex-col gap-6 max-w-6xl">
    <div v-if="loading" class="flex items-center justify-center h-40">
      <span class="i-carbon-loading animate-spin text-3xl text-primary" />
    </div>

    <template v-else-if="data">
      <!-- Setup CTA (если не настроено) -->
      <div v-if="data.installed && !data.service.active && !data.service.pid" class="flex items-center gap-4 px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl">
        <span class="i-carbon-wizard text-primary text-xl shrink-0" />
        <div class="flex-1">
          <p class="text-sm font-medium text-base">Endpoint not configured</p>
          <p class="text-xs text-subtext">Run the Setup Wizard to configure TrustTunnel before starting the service.</p>
        </div>
        <button class="btn-primary btn-sm shrink-0" @click="router.push('/setup')">
          Setup Wizard
        </button>
      </div>

      <!-- Service Status -->
      <div class="card">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-4">
            <div :class="[
              'w-10 h-10 rounded-xl flex items-center justify-center',
              data.service.active ? 'bg-green-500/15' : 'bg-red-500/15'
            ]">
              <span :class="['text-xl', data.service.active ? 'i-carbon-checkmark-filled text-green-400' : 'i-carbon-close-filled text-red-400']" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-semibold text-base">TrustTunnel Service</span>
                <span :class="data.service.active ? 'badge-green' : 'badge-red'">
                  {{ data.service.state }}
                </span>
                <span v-if="!data.installed" class="badge-yellow">Not installed</span>
              </div>
              <p v-if="data.service.pid" class="text-xs text-subtext mt-0.5">PID: {{ data.service.pid }}</p>
            </div>
          </div>

          <div class="flex gap-2">
            <button
              class="btn-success btn-sm"
              :disabled="data.service.active || actionLoading"
              @click="serviceAction('start')"
            >
              <span class="i-carbon-play-filled" /> Start
            </button>
            <button
              class="btn-secondary btn-sm"
              :disabled="!data.service.active || actionLoading"
              @click="serviceAction('restart')"
            >
              <span class="i-carbon-restart" /> Restart
            </button>
            <button
              class="btn-danger btn-sm"
              :disabled="!data.service.active || actionLoading"
              @click="serviceAction('stop')"
            >
              <span class="i-carbon-stop-filled" /> Stop
            </button>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="CPU Usage"
          :value="`${data.system.cpuUsage}%`"
          icon="i-carbon-chip"
        />
        <StatCard
          label="Memory"
          :value="`${data.system.mem.percent}%`"
          :sub="`${formatBytes(data.system.mem.used)} / ${formatBytes(data.system.mem.total)}`"
          icon="i-carbon-memory"
        />
        <StatCard
          label="Disk"
          :value="`${data.system.disk.percent}%`"
          :sub="`${data.system.disk.used}MB used`"
          icon="i-carbon-data-storage"
        />
        <StatCard
          label="Uptime"
          :value="formatUptime(data.system.uptime)"
          icon="i-carbon-time"
        />
      </div>

      <!-- Users & Resources -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="card">
          <h3 class="text-sm font-semibold text-base mb-4">VPN Users</h3>
          <div class="flex items-end gap-6">
            <div>
              <p class="text-3xl font-bold text-primary">{{ data.users.active }}</p>
              <p class="text-xs text-subtext">Active</p>
            </div>
            <div>
              <p class="text-3xl font-bold text-base">{{ data.users.total }}</p>
              <p class="text-xs text-subtext">Total</p>
            </div>
          </div>
          <div class="mt-4">
            <div class="flex justify-between text-xs text-subtext mb-1">
              <span>Active ratio</span>
              <span>{{ data.users.total ? Math.round(data.users.active / data.users.total * 100) : 0 }}%</span>
            </div>
            <ProgressBar :value="data.users.active" :max="data.users.total || 1" />
          </div>
        </div>

        <div class="card">
          <h3 class="text-sm font-semibold text-base mb-4">Resource Usage</h3>
          <div class="flex flex-col gap-3">
            <div>
              <div class="flex justify-between text-xs text-subtext mb-1">
                <span>CPU</span>
                <span>{{ data.system.cpuUsage }}%</span>
              </div>
              <ProgressBar
                :value="data.system.cpuUsage"
                :color="data.system.cpuUsage > 80 ? 'bg-red-500' : data.system.cpuUsage > 60 ? 'bg-yellow-500' : 'bg-primary'"
              />
            </div>
            <div>
              <div class="flex justify-between text-xs text-subtext mb-1">
                <span>Memory</span>
                <span>{{ data.system.mem.percent }}%</span>
              </div>
              <ProgressBar
                :value="data.system.mem.percent"
                :color="data.system.mem.percent > 80 ? 'bg-red-500' : data.system.mem.percent > 60 ? 'bg-yellow-500' : 'bg-green-500'"
              />
            </div>
            <div>
              <div class="flex justify-between text-xs text-subtext mb-1">
                <span>Disk</span>
                <span>{{ data.system.disk.percent }}%</span>
              </div>
              <ProgressBar
                :value="data.system.disk.percent"
                :color="data.system.disk.percent > 80 ? 'bg-red-500' : 'bg-blue-500'"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Network Interfaces -->
      <div v-if="data.network?.length" class="card">
        <h3 class="text-sm font-semibold text-base mb-4">Network Interfaces</h3>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div
            v-for="iface in data.network"
            :key="iface.name"
            class="bg-surface-300 rounded-lg p-3"
          >
            <p class="text-xs font-mono text-primary font-semibold">{{ iface.name }}</p>
            <div class="mt-1.5 flex flex-col gap-0.5">
              <p class="text-xs text-subtext">↓ {{ formatBytes(Math.round(iface.rx / 1024 / 1024)) }}</p>
              <p class="text-xs text-subtext">↑ {{ formatBytes(Math.round(iface.tx / 1024 / 1024)) }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
