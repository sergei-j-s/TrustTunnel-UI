<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { authApi, serviceApi, api } from '@/api'

// --- Panel Port ---
const panelPort = ref<number>(8080)
const currentPort = ref<number>(8080)
const portLoading = ref(false)
const portError = ref('')
const portRestarting = ref(false)

async function loadPanelSettings() {
  try {
    const res = await api.get('/settings/panel')
    panelPort.value = res.data.port
    currentPort.value = res.data.currentPort
  } catch {}
}

async function savePort() {
  portError.value = ''
  portRestarting.value = false
  if (panelPort.value < 1 || panelPort.value > 65535) {
    portError.value = 'Port must be between 1 and 65535'
    return
  }
  portLoading.value = true
  try {
    await api.put('/settings/panel', { port: panelPort.value })
    portRestarting.value = true
    // Через 2 сек пробуем редирект на новый порт
    setTimeout(() => {
      const url = new URL(window.location.href)
      url.port = String(panelPort.value)
      window.location.href = url.toString()
    }, 2000)
  } catch (e: any) {
    portError.value = e.response?.data?.error || 'Failed to save port'
  } finally {
    portLoading.value = false
  }
}

onMounted(loadPanelSettings)

// --- Password ---
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const pwLoading = ref(false)
const pwError = ref('')
const pwSuccess = ref('')

const installLoading = ref(false)
const installOutput = ref('')
const installError = ref('')
const alreadyInstalled = ref(false)

async function changePassword() {
  pwError.value = ''
  pwSuccess.value = ''
  if (newPassword.value !== confirmPassword.value) {
    pwError.value = 'Passwords do not match'
    return
  }
  if (newPassword.value.length < 6) {
    pwError.value = 'Password must be at least 6 characters'
    return
  }
  pwLoading.value = true
  try {
    await authApi.changePassword(currentPassword.value, newPassword.value)
    pwSuccess.value = 'Password changed successfully'
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e: any) {
    pwError.value = e.response?.data?.error || 'Failed to change password'
  } finally {
    pwLoading.value = false
  }
}

async function installTrustTunnel(force = false) {
  installError.value = ''
  installOutput.value = ''
  alreadyInstalled.value = false
  installLoading.value = true
  try {
    const res = await serviceApi.install(force)
    installOutput.value = res.data.output
  } catch (e: any) {
    if (e.response?.status === 409) {
      alreadyInstalled.value = true
    }
    installError.value = e.response?.data?.error || 'Installation failed'
  } finally {
    installLoading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-2xl">
    <!-- Panel Port -->
    <div class="card">
      <h3 class="font-semibold text-sm text-base mb-1 flex items-center gap-2">
        <span class="i-carbon-network-4 text-primary" />
        Panel Port
      </h3>
      <p class="text-xs text-subtext mb-4">
        Current port: <code class="font-mono bg-surface-300 px-1 rounded">{{ currentPort }}</code>.
        After saving the panel will restart and redirect you automatically.
      </p>

      <div v-if="portRestarting" class="flex items-center gap-3 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-3 py-2.5 rounded-lg mb-3">
        <span class="i-carbon-in-progress animate-spin shrink-0" />
        Panel is restarting on port {{ panelPort }}… redirecting in 2s
      </div>

      <div class="flex gap-3 items-end">
        <div class="w-40">
          <label class="label">New Port</label>
          <input
            v-model.number="panelPort"
            type="number"
            class="input"
            min="1"
            max="65535"
            :disabled="portRestarting"
          />
        </div>
        <button
          class="btn-primary"
          :disabled="portLoading || portRestarting || panelPort === currentPort"
          @click="savePort"
        >
          <span v-if="portLoading" class="i-carbon-in-progress animate-spin" />
          <span v-else class="i-carbon-save" />
          Apply
        </button>
      </div>

      <div v-if="portError" class="mt-3 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{{ portError }}</div>
    </div>

    <!-- Change Password -->
    <div class="card">
      <h3 class="font-semibold text-sm text-base mb-4 flex items-center gap-2">
        <span class="i-carbon-password text-primary" />
        Change Admin Password
      </h3>
      <form class="flex flex-col gap-3" @submit.prevent="changePassword">
        <div>
          <label class="label">Current Password</label>
          <input v-model="currentPassword" type="password" class="input" required />
        </div>
        <div>
          <label class="label">New Password</label>
          <input v-model="newPassword" type="password" class="input" required />
        </div>
        <div>
          <label class="label">Confirm New Password</label>
          <input v-model="confirmPassword" type="password" class="input" required />
        </div>
        <div v-if="pwError" class="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{{ pwError }}</div>
        <div v-if="pwSuccess" class="text-xs text-green-400 bg-green-500/10 px-3 py-2 rounded-lg">{{ pwSuccess }}</div>
        <div class="flex justify-end">
          <button type="submit" class="btn-primary" :disabled="pwLoading">
            <span v-if="pwLoading" class="i-carbon-in-progress animate-spin" />
            <span v-else class="i-carbon-save" />
            Save Password
          </button>
        </div>
      </form>
    </div>

    <!-- Install TrustTunnel -->
    <div class="card">
      <h3 class="font-semibold text-sm text-base mb-1 flex items-center gap-2">
        <span class="i-carbon-download text-primary" />
        Install / Update TrustTunnel
      </h3>
      <p class="text-xs text-subtext mb-4">
        Downloads and installs the latest TrustTunnel endpoint to <code class="font-mono bg-surface-300 px-1 rounded">/opt/trusttunnel</code>
      </p>

      <div class="flex items-center gap-3">
        <button class="btn-primary" :disabled="installLoading" @click="installTrustTunnel(false)">
          <span v-if="installLoading" class="i-carbon-in-progress animate-spin" />
          <span v-else class="i-carbon-download" />
          {{ installLoading ? 'Installing...' : 'Install / Update' }}
        </button>
        <button
          v-if="alreadyInstalled"
          class="btn-secondary"
          :disabled="installLoading"
          @click="installTrustTunnel(true)"
        >
          <span class="i-carbon-restart" />
          Reinstall (force)
        </button>
      </div>

      <div v-if="installError" class="mt-3 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{{ installError }}</div>
      <pre v-if="installOutput" class="mt-3 bg-surface-100 rounded px-3 py-2 text-xs font-mono text-subtext overflow-x-auto max-h-48">{{ installOutput }}</pre>
    </div>

    <!-- Info -->
    <div class="card bg-primary/5 border-primary/20">
      <h3 class="font-semibold text-sm text-primary mb-3 flex items-center gap-2">
        <span class="i-carbon-information" />
        About TrustTunnel UI
      </h3>
      <div class="flex flex-col gap-1.5 text-xs text-subtext">
        <div class="flex gap-2">
          <span class="text-overlay w-28">Version</span>
          <span>1.0.0</span>
        </div>
        <div class="flex gap-2">
          <span class="text-overlay w-28">Backend</span>
          <span>Node.js + Fastify</span>
        </div>
        <div class="flex gap-2">
          <span class="text-overlay w-28">Frontend</span>
          <span>Vue 3 + UnoCSS</span>
        </div>
        <div class="flex gap-2">
          <span class="text-overlay w-28">TT Docs</span>
          <a href="https://github.com/TrustTunnel/TrustTunnel" target="_blank" class="text-primary hover:underline">
            github.com/TrustTunnel
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
