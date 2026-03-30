<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { vpnUsersApi, configApi } from '@/api'
import ConfirmModal from '@/components/ConfirmModal.vue'

interface VpnUser {
  id: number
  username: string
  password: string
  enabled: number
  traffic_limit_gb: number
  traffic_used_gb: number
  expires_at: string | null
  created_at: string
  last_seen: string | null
  note: string
}

const users = ref<VpnUser[]>([])
const loading = ref(true)
const showModal = ref(false)
const showGenModal = ref(false)
const editingUser = ref<Partial<VpnUser> | null>(null)
const deleteTarget = ref<number | null>(null)
const actionLoading = ref(false)
const genAddress = ref('')
const genFormat = ref<'deeplink' | 'toml'>('deeplink')
const genUserId = ref<number | null>(null)
const generatedConfig = ref('')
const searchQuery = ref('')

const filteredUsers = computed(() =>
  users.value.filter(u =>
    u.username.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
)

const form = ref({
  username: '',
  password: '',
  trafficLimitGb: 0,
  expiresAt: '',
  note: '',
})

async function load() {
  try {
    const res = await vpnUsersApi.list()
    users.value = res.data
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingUser.value = null
  form.value = { username: '', password: '', trafficLimitGb: 0, expiresAt: '', note: '' }
  showModal.value = true
}

function openEdit(user: VpnUser) {
  editingUser.value = user
  form.value = {
    username: user.username,
    password: user.password,
    trafficLimitGb: user.traffic_limit_gb,
    expiresAt: user.expires_at || '',
    note: user.note,
  }
  showModal.value = true
}

async function saveUser() {
  actionLoading.value = true
  try {
    const payload = {
      username: form.value.username,
      password: form.value.password,
      trafficLimitGb: form.value.trafficLimitGb,
      expiresAt: form.value.expiresAt || null,
      note: form.value.note,
    }
    if (editingUser.value?.id) {
      await vpnUsersApi.update(editingUser.value.id, payload)
    } else {
      await vpnUsersApi.create(payload)
    }
    showModal.value = false
    await load()
  } finally {
    actionLoading.value = false
  }
}

async function toggleUser(user: VpnUser) {
  await vpnUsersApi.update(user.id, { enabled: user.enabled ? 0 : 1 })
  await load()
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  await vpnUsersApi.delete(deleteTarget.value)
  deleteTarget.value = null
  await load()
}

async function resetTraffic(id: number) {
  await vpnUsersApi.resetTraffic(id)
  await load()
}

function openGenConfig(userId: number) {
  genUserId.value = userId
  genAddress.value = ''
  generatedConfig.value = ''
  showGenModal.value = true
}

async function generateConfig() {
  if (!genUserId.value || !genAddress.value) return
  actionLoading.value = true
  try {
    const res = await configApi.generateClient({
      vpnUserId: genUserId.value,
      address: genAddress.value,
      format: genFormat.value,
    })
    generatedConfig.value = res.data.config
  } finally {
    actionLoading.value = false
  }
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString()
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-4 max-w-6xl">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <input
          v-model="searchQuery"
          type="text"
          class="input max-w-xs"
          placeholder="Search users..."
        />
        <span class="text-xs text-subtext">{{ filteredUsers.length }} users</span>
      </div>
      <button class="btn-primary btn-sm" @click="openCreate">
        <span class="i-carbon-add" /> Add User
      </button>
    </div>

    <div v-if="loading" class="flex justify-center h-32 items-center">
      <span class="i-carbon-in-progress animate-spin text-3xl text-primary" />
    </div>

    <div v-else-if="!filteredUsers.length" class="card text-center py-10">
      <span class="i-carbon-user-multiple text-4xl text-overlay" />
      <p class="text-sm text-subtext mt-2">No users found</p>
      <button class="btn-primary btn-sm mt-4" @click="openCreate">Add first user</button>
    </div>

    <div v-else class="card p-0 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-surface-300 text-left">
            <th class="px-4 py-3 text-xs font-medium text-subtext">Username</th>
            <th class="px-4 py-3 text-xs font-medium text-subtext">Status</th>
            <th class="px-4 py-3 text-xs font-medium text-subtext">Traffic</th>
            <th class="px-4 py-3 text-xs font-medium text-subtext">Expires</th>
            <th class="px-4 py-3 text-xs font-medium text-subtext">Created</th>
            <th class="px-4 py-3 text-xs font-medium text-subtext">Note</th>
            <th class="px-4 py-3 text-xs font-medium text-subtext text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in filteredUsers"
            :key="user.id"
            class="border-b border-surface-300 last:border-0 hover:bg-surface-300/30 transition-colors"
          >
            <td class="px-4 py-3 font-mono text-xs text-base font-medium">{{ user.username }}</td>
            <td class="px-4 py-3">
              <span :class="user.enabled ? 'badge-green' : 'badge-red'">
                {{ user.enabled ? 'Active' : 'Disabled' }}
              </span>
            </td>
            <td class="px-4 py-3 text-xs text-subtext">
              <span>{{ user.traffic_used_gb.toFixed(2) }} GB</span>
              <span v-if="user.traffic_limit_gb > 0"> / {{ user.traffic_limit_gb }} GB</span>
              <span v-else> / ∞</span>
            </td>
            <td class="px-4 py-3 text-xs text-subtext">{{ formatDate(user.expires_at) }}</td>
            <td class="px-4 py-3 text-xs text-subtext">{{ formatDate(user.created_at) }}</td>
            <td class="px-4 py-3 text-xs text-subtext max-w-24 truncate">{{ user.note || '—' }}</td>
            <td class="px-4 py-3">
              <div class="flex gap-1 justify-end">
                <button class="btn-ghost btn-sm" title="Generate config" @click="openGenConfig(user.id)">
                  <span class="i-carbon-qr-code" />
                </button>
                <button class="btn-ghost btn-sm" title="Toggle" @click="toggleUser(user)">
                  <span :class="user.enabled ? 'i-carbon-pause-filled' : 'i-carbon-play-filled'" />
                </button>
                <button class="btn-ghost btn-sm" title="Reset traffic" @click="resetTraffic(user.id)">
                  <span class="i-carbon-reset" />
                </button>
                <button class="btn-ghost btn-sm" title="Edit" @click="openEdit(user)">
                  <span class="i-carbon-edit" />
                </button>
                <button class="btn-ghost btn-sm text-red-400 hover:text-red-300" title="Delete" @click="deleteTarget = user.id">
                  <span class="i-carbon-trash-can" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Create/Edit Modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60" @click="showModal = false" />
        <div class="relative card w-full max-w-md shadow-2xl">
          <h3 class="font-semibold text-base mb-4">{{ editingUser ? 'Edit User' : 'Add VPN User' }}</h3>
          <form class="flex flex-col gap-3" @submit.prevent="saveUser">
            <div>
              <label class="label">Username</label>
              <input
                v-model="form.username"
                class="input"
                :disabled="!!editingUser"
                required
              />
            </div>
            <div>
              <label class="label">Password</label>
              <input v-model="form.password" class="input" type="text" required />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label">Traffic limit (GB, 0=∞)</label>
                <input v-model.number="form.trafficLimitGb" class="input" type="number" min="0" />
              </div>
              <div>
                <label class="label">Expires at</label>
                <input v-model="form.expiresAt" class="input" type="date" />
              </div>
            </div>
            <div>
              <label class="label">Note</label>
              <input v-model="form.note" class="input" placeholder="Optional" />
            </div>
            <div class="flex gap-3 justify-end mt-2">
              <button type="button" class="btn-secondary" @click="showModal = false">Cancel</button>
              <button type="submit" class="btn-primary" :disabled="actionLoading">
                <span v-if="actionLoading" class="i-carbon-in-progress animate-spin" />
                {{ editingUser ? 'Save' : 'Create' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Generate Config Modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="showGenModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60" @click="showGenModal = false" />
        <div class="relative card w-full max-w-lg shadow-2xl">
          <h3 class="font-semibold text-base mb-4">Generate Client Config</h3>
          <div class="flex flex-col gap-3">
            <div>
              <label class="label">Server address (IP or domain:port)</label>
              <input v-model="genAddress" class="input" placeholder="example.com:443" />
            </div>
            <div>
              <label class="label">Format</label>
              <select v-model="genFormat" class="input">
                <option value="deeplink">Deep Link (tt://)</option>
                <option value="toml">TOML (CLI client)</option>
              </select>
            </div>
            <button class="btn-primary" :disabled="!genAddress || actionLoading" @click="generateConfig">
              <span v-if="actionLoading" class="i-carbon-in-progress animate-spin" />
              Generate
            </button>

            <div v-if="generatedConfig">
              <label class="label">Result</label>
              <div class="relative">
                <textarea
                  :value="generatedConfig"
                  class="input font-mono text-xs h-24 resize-none"
                  readonly
                />
                <button
                  class="absolute top-2 right-2 btn-ghost btn-sm"
                  @click="copyToClipboard(generatedConfig)"
                >
                  <span class="i-carbon-copy" />
                </button>
              </div>
            </div>

            <div class="flex justify-end">
              <button class="btn-secondary" @click="showGenModal = false">Close</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <ConfirmModal
    :show="!!deleteTarget"
    title="Delete User"
    message="Are you sure you want to delete this VPN user? This action cannot be undone."
    confirm-label="Delete"
    :danger="true"
    @confirm="confirmDelete"
    @cancel="deleteTarget = null"
  />
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
