<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { configApi } from '@/api'

const activeTab = ref<'vpn' | 'hosts' | 'clients'>('vpn')
const vpnConfig = ref('')
const hostsConfig = ref('')
const clientConfigs = ref<any[]>([])
const loading = ref(false)
const saveLoading = ref(false)
const error = ref('')
const success = ref('')

async function loadVpnConfig() {
  loading.value = true
  try {
    const res = await configApi.getVpn()
    vpnConfig.value = JSON.stringify(res.data, null, 2)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load VPN config'
  } finally {
    loading.value = false
  }
}

async function loadHostsConfig() {
  loading.value = true
  try {
    const res = await configApi.getHosts()
    hostsConfig.value = JSON.stringify(res.data, null, 2)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load hosts config'
  } finally {
    loading.value = false
  }
}

async function loadClientConfigs() {
  const res = await configApi.listClientConfigs()
  clientConfigs.value = res.data
}

async function saveVpnConfig() {
  error.value = ''
  success.value = ''
  saveLoading.value = true
  try {
    const parsed = JSON.parse(vpnConfig.value)
    await configApi.updateVpn(parsed)
    success.value = 'VPN config saved successfully'
  } catch (e: any) {
    error.value = e.message || 'Failed to save'
  } finally {
    saveLoading.value = false
  }
}

async function saveHostsConfig() {
  error.value = ''
  success.value = ''
  saveLoading.value = true
  try {
    const parsed = JSON.parse(hostsConfig.value)
    await configApi.updateHosts(parsed)
    success.value = 'Hosts config saved successfully'
  } catch (e: any) {
    error.value = e.message || 'Failed to save'
  } finally {
    saveLoading.value = false
  }
}

async function deleteClientConfig(id: number) {
  await configApi.deleteClientConfig(id)
  await loadClientConfigs()
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text)
}

function onTabChange(tab: 'vpn' | 'hosts' | 'clients') {
  activeTab.value = tab
  error.value = ''
  success.value = ''
  if (tab === 'vpn') loadVpnConfig()
  else if (tab === 'hosts') loadHostsConfig()
  else loadClientConfigs()
}

onMounted(() => loadVpnConfig())
</script>

<template>
  <div class="flex flex-col gap-4 max-w-4xl">
    <div class="flex gap-1 p-1 bg-surface-300 rounded-lg w-fit">
      <button
        v-for="tab in ['vpn', 'hosts', 'clients'] as const"
        :key="tab"
        :class="['btn btn-sm', activeTab === tab ? 'bg-surface-100 text-base shadow-sm' : 'text-subtext hover:text-base']"
        @click="onTabChange(tab)"
      >
        {{ tab === 'vpn' ? 'VPN Config' : tab === 'hosts' ? 'TLS Hosts' : 'Client Configs' }}
      </button>
    </div>

    <div v-if="error" class="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{{ error }}</div>
    <div v-if="success" class="text-xs text-green-400 bg-green-500/10 px-3 py-2 rounded-lg">{{ success }}</div>

    <!-- VPN Config -->
    <div v-if="activeTab === 'vpn'" class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-semibold text-sm text-base">vpn.toml</h3>
          <p class="text-xs text-subtext">Main VPN endpoint configuration</p>
        </div>
        <div class="flex gap-2">
          <button class="btn-secondary btn-sm" @click="loadVpnConfig">
            <span class="i-carbon-renew" /> Reload
          </button>
          <button class="btn-primary btn-sm" :disabled="saveLoading" @click="saveVpnConfig">
            <span v-if="saveLoading" class="i-carbon-in-progress animate-spin" />
            <span v-else class="i-carbon-save" /> Save
          </button>
        </div>
      </div>
      <div v-if="loading" class="flex justify-center h-32 items-center">
        <span class="i-carbon-in-progress animate-spin text-3xl text-primary" />
      </div>
      <textarea
        v-else
        v-model="vpnConfig"
        class="input font-mono text-xs h-80 resize-y"
        spellcheck="false"
      />
    </div>

    <!-- Hosts Config -->
    <div v-else-if="activeTab === 'hosts'" class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-semibold text-sm text-base">hosts.toml</h3>
          <p class="text-xs text-subtext">TLS hosts configuration</p>
        </div>
        <div class="flex gap-2">
          <button class="btn-secondary btn-sm" @click="loadHostsConfig">
            <span class="i-carbon-renew" /> Reload
          </button>
          <button class="btn-primary btn-sm" :disabled="saveLoading" @click="saveHostsConfig">
            <span v-if="saveLoading" class="i-carbon-in-progress animate-spin" />
            <span v-else class="i-carbon-save" /> Save
          </button>
        </div>
      </div>
      <div v-if="loading" class="flex justify-center h-32 items-center">
        <span class="i-carbon-in-progress animate-spin text-3xl text-primary" />
      </div>
      <textarea
        v-else
        v-model="hostsConfig"
        class="input font-mono text-xs h-80 resize-y"
        spellcheck="false"
      />
    </div>

    <!-- Client Configs -->
    <div v-else class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-semibold text-sm text-base">Generated Client Configs</h3>
          <p class="text-xs text-subtext">Previously generated client configurations</p>
        </div>
        <button class="btn-secondary btn-sm" @click="loadClientConfigs">
          <span class="i-carbon-renew" /> Refresh
        </button>
      </div>

      <div v-if="!clientConfigs.length" class="card text-center py-8">
        <span class="i-carbon-document text-4xl text-overlay" />
        <p class="text-sm text-subtext mt-2">No configs generated yet</p>
        <p class="text-xs text-overlay mt-1">Generate configs from the Users page</p>
      </div>

      <div v-else class="flex flex-col gap-3">
        <div v-for="cfg in clientConfigs" :key="cfg.id" class="card-sm">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-mono text-xs text-primary font-semibold">{{ cfg.vpn_username }}</span>
                <span class="badge-blue">{{ cfg.format }}</span>
              </div>
              <p class="text-xs text-subtext mb-2">{{ cfg.address }} · {{ new Date(cfg.created_at).toLocaleString() }}</p>
              <div class="relative">
                <pre class="bg-surface-100 rounded px-3 py-2 text-xs font-mono overflow-x-auto text-subtext whitespace-pre-wrap break-all">{{ cfg.config_data }}</pre>
              </div>
            </div>
            <div class="flex gap-1 shrink-0">
              <button class="btn-ghost btn-sm" title="Copy" @click="copyToClipboard(cfg.config_data)">
                <span class="i-carbon-copy" />
              </button>
              <button class="btn-ghost btn-sm text-red-400" title="Delete" @click="deleteClientConfig(cfg.id)">
                <span class="i-carbon-trash-can" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
