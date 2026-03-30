<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { setupApi } from '@/api'

const router = useRouter()

// --- Статус ---
const status = ref<Record<string, any> | null>(null)
const statusLoading = ref(true)

// --- Шаги ---
const currentStep = ref(0)
const steps = ['Network', 'TLS Certificate', 'Filtering Rules', 'Users', 'Review']

// --- Step 1: Network ---
const listenAddress = ref('0.0.0.0:443')

// --- Step 2: TLS ---
type TlsMode = 'selfsigned' | 'letsencrypt' | 'existing'
const tlsMode = ref<TlsMode>('selfsigned')
const certPath = ref('')
const keyPath = ref('')
const serverName = ref('')
const selfSignedCN = ref('')
const leDomain = ref('')
const leEmail = ref('')
const certbotAvailable = ref(false)
const existingCerts = ref<{ domain: string; certPath: string; keyPath: string }[]>([])
const selectedExistingCert = ref<string>('')
const tlsLoading = ref(false)
const tlsOutput = ref('')
const tlsError = ref('')

// --- Step 3: Rules ---
const rulesMode = ref<'allow_all' | 'custom'>('allow_all')
const rulesEntries = ref<string[]>([''])

// --- Step 4: Users ---
const initialUsers = ref([{ username: '', password: '' }])

// --- Apply ---
const applyLoading = ref(false)
const applyError = ref('')
const applySuccess = ref(false)

// ---- Вычисления ---
const canProceed = computed(() => {
  if (currentStep.value === 0) return listenAddress.value.trim().length > 0
  if (currentStep.value === 1) return certPath.value && keyPath.value
  return true
})

const reviewData = computed(() => ({
  network: { listenAddress: listenAddress.value },
  tls: {
    serverName: serverName.value || listenAddress.value.split(':')[0],
    certPath: certPath.value,
    keyPath: keyPath.value,
  },
  rules: {
    entries: rulesMode.value === 'allow_all'
      ? []
      : rulesEntries.value.filter((r) => r.trim()),
  },
  initialUsers: initialUsers.value.filter((u) => u.username.trim() && u.password.trim()),
}))

// --- Методы TLS ---
async function generateSelfsigned() {
  tlsError.value = ''
  tlsOutput.value = ''
  tlsLoading.value = true
  try {
    const res = await setupApi.generateSelfsigned({
      commonName: selfSignedCN.value || listenAddress.value.split(':')[0] || 'trusttunnel',
      days: 3650,
    })
    certPath.value = res.data.certPath
    keyPath.value = res.data.keyPath
    tlsOutput.value = `Certificate generated:\n  Cert: ${certPath.value}\n  Key:  ${keyPath.value}`
  } catch (e: any) {
    tlsError.value = e.response?.data?.error || 'Failed to generate certificate'
  } finally {
    tlsLoading.value = false
  }
}

async function runCertbot() {
  tlsError.value = ''
  tlsOutput.value = ''
  tlsLoading.value = true
  try {
    const res = await setupApi.certbot(leDomain.value, leEmail.value)
    certPath.value = res.data.certPath
    keyPath.value = res.data.keyPath
    tlsOutput.value = res.data.output
  } catch (e: any) {
    tlsError.value = e.response?.data?.error || 'certbot failed'
  } finally {
    tlsLoading.value = false
  }
}

function selectExistingCert(val: string) {
  selectedExistingCert.value = val
  const found = existingCerts.value.find((c) => c.certPath === val)
  if (found) {
    certPath.value = found.certPath
    keyPath.value = found.keyPath
  }
}

// --- Методы Rules ---
function addRule() { rulesEntries.value.push('') }
function removeRule(i: number) { rulesEntries.value.splice(i, 1) }

// --- Методы Users ---
function addUser() { initialUsers.value.push({ username: '', password: '' }) }
function removeUser(i: number) { initialUsers.value.splice(i, 1) }

// --- Apply ---
async function applyConfig() {
  applyError.value = ''
  applyLoading.value = true
  try {
    await setupApi.apply(reviewData.value)
    applySuccess.value = true
  } catch (e: any) {
    applyError.value = e.response?.data?.error || 'Failed to apply configuration'
  } finally {
    applyLoading.value = false
  }
}

async function loadStatus() {
  try {
    const res = await setupApi.status()
    status.value = res.data
    if (res.data.vpnData?.listen_address) {
      listenAddress.value = res.data.vpnData.listen_address
    }
  } finally {
    statusLoading.value = false
  }
}

async function loadTlsData() {
  const [cbRes, certsRes] = await Promise.all([
    setupApi.checkCertbot(),
    setupApi.existingCerts(),
  ])
  certbotAvailable.value = cbRes.data.available
  existingCerts.value = certsRes.data
  if (!certbotAvailable.value && tlsMode.value === 'letsencrypt') {
    tlsMode.value = 'selfsigned'
  }
}

function onStepChange(next: number) {
  if (next === 1 && currentStep.value === 0) loadTlsData()
  currentStep.value = next
}

onMounted(loadStatus)
</script>

<template>
  <div class="max-w-2xl mx-auto flex flex-col gap-6">
    <!-- Header -->
    <div>
      <h2 class="text-lg font-semibold text-base">Endpoint Setup Wizard</h2>
      <p class="text-sm text-subtext mt-0.5">Configure TrustTunnel endpoint without using the terminal</p>
    </div>

    <!-- Текущий статус -->
    <div v-if="!statusLoading && status" :class="[
      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm border',
      status.configured
        ? 'bg-green-500/10 border-green-500/20 text-green-400'
        : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
    ]">
      <span :class="status.configured ? 'i-carbon-checkmark-filled' : 'i-carbon-warning-filled'" />
      <span v-if="status.configured">
        Endpoint is configured. You can re-run the wizard to update settings.
      </span>
      <span v-else-if="!status.installed">
        TrustTunnel is not installed. Install it in
        <button class="underline ml-1" @click="router.push('/settings')">Settings</button>
        first.
      </span>
      <span v-else>
        Endpoint is not configured yet. Complete the wizard to get started.
      </span>
    </div>

    <!-- Success state -->
    <div v-if="applySuccess" class="card text-center py-10">
      <div class="w-14 h-14 rounded-2xl bg-green-500/15 flex items-center justify-center mx-auto mb-4">
        <span class="i-carbon-checkmark-filled text-green-400 text-3xl" />
      </div>
      <h3 class="font-semibold text-base text-lg mb-1">Configuration applied!</h3>
      <p class="text-sm text-subtext mb-5">vpn.toml, hosts.toml, rules.toml and credentials have been written.</p>
      <div class="flex gap-3 justify-center">
        <button class="btn-primary" @click="router.push('/dashboard')">
          <span class="i-carbon-dashboard" /> Go to Dashboard
        </button>
        <button class="btn-secondary" @click="applySuccess = false">
          <span class="i-carbon-settings-adjust" /> Edit again
        </button>
      </div>
    </div>

    <template v-else>
      <!-- Stepper -->
      <div class="flex items-center gap-0">
        <template v-for="(step, i) in steps" :key="i">
          <div class="flex flex-col items-center">
            <div :class="[
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors',
              i < currentStep
                ? 'bg-primary border-primary text-white'
                : i === currentStep
                  ? 'border-primary text-primary bg-transparent'
                  : 'border-surface-400 text-overlay bg-transparent'
            ]">
              <span v-if="i < currentStep" class="i-carbon-checkmark text-sm" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span :class="[
              'text-xs mt-1 whitespace-nowrap',
              i === currentStep ? 'text-primary font-medium' : 'text-overlay'
            ]">{{ step }}</span>
          </div>
          <div v-if="i < steps.length - 1" :class="[
            'flex-1 h-0.5 mb-5 mx-1 transition-colors',
            i < currentStep ? 'bg-primary' : 'bg-surface-300'
          ]" />
        </template>
      </div>

      <!-- Step content -->
      <div class="card min-h-64">

        <!-- Step 0: Network -->
        <div v-if="currentStep === 0" class="flex flex-col gap-4">
          <div>
            <h3 class="font-semibold text-sm text-base mb-1">Network Settings</h3>
            <p class="text-xs text-subtext">Address and port the VPN endpoint will listen on.</p>
          </div>
          <div>
            <label class="label">Listen Address</label>
            <input v-model="listenAddress" class="input font-mono" placeholder="0.0.0.0:443" />
            <p class="text-xs text-overlay mt-1">
              Use <code class="font-mono bg-surface-300 px-1 rounded">0.0.0.0:443</code> to listen on all interfaces.
              For Docker with port mapping <code class="font-mono bg-surface-300 px-1 rounded">443:8443</code>
              use <code class="font-mono bg-surface-300 px-1 rounded">0.0.0.0:8443</code>.
            </p>
          </div>
          <div>
            <label class="label">Server Name (for TLS SNI, optional)</label>
            <input v-model="serverName" class="input" placeholder="example.com" />
            <p class="text-xs text-overlay mt-1">Leave empty to use the IP from the listen address.</p>
          </div>
        </div>

        <!-- Step 1: TLS Certificate -->
        <div v-else-if="currentStep === 1" class="flex flex-col gap-4">
          <div>
            <h3 class="font-semibold text-sm text-base mb-1">TLS Certificate</h3>
            <p class="text-xs text-subtext">TrustTunnel traffic is indistinguishable from HTTPS — a valid TLS certificate is required.</p>
          </div>

          <!-- Mode selector -->
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="mode in (['selfsigned', 'letsencrypt', 'existing'] as TlsMode[])"
              :key="mode"
              :class="[
                'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-xs font-medium transition-colors cursor-pointer',
                tlsMode === mode
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-surface-300 text-subtext hover:border-surface-400',
                mode === 'letsencrypt' && !certbotAvailable ? 'opacity-50 cursor-not-allowed' : ''
              ]"
              :disabled="mode === 'letsencrypt' && !certbotAvailable"
              @click="tlsMode = mode; certPath = ''; keyPath = ''; tlsOutput = ''; tlsError = ''"
            >
              <span :class="{
                'i-carbon-locked': mode === 'selfsigned',
                'i-carbon-certificate': mode === 'letsencrypt',
                'i-carbon-document': mode === 'existing',
              }" class="text-xl" />
              <span>{{ mode === 'selfsigned' ? 'Self-signed' : mode === 'letsencrypt' ? "Let's Encrypt" : 'Existing' }}</span>
            </button>
          </div>
          <p v-if="!certbotAvailable" class="text-xs text-yellow-400 -mt-2">
            certbot not found. Install it to use Let's Encrypt.
          </p>

          <!-- Self-signed -->
          <div v-if="tlsMode === 'selfsigned'" class="flex flex-col gap-3">
            <div>
              <label class="label">Common Name (CN)</label>
              <input v-model="selfSignedCN" class="input" :placeholder="listenAddress.split(':')[0] || 'trusttunnel'" />
              <p class="text-xs text-overlay mt-1">Usually your server IP or domain. Valid for 10 years.</p>
            </div>
            <button class="btn-primary w-fit" :disabled="tlsLoading" @click="generateSelfsigned">
              <span v-if="tlsLoading" class="i-carbon-in-progress animate-spin" />
              <span v-else class="i-carbon-locked" />
              Generate Certificate
            </button>
          </div>

          <!-- Let's Encrypt -->
          <div v-else-if="tlsMode === 'letsencrypt'" class="flex flex-col gap-3">
            <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 text-xs text-blue-400">
              <span class="i-carbon-information mr-1" />
              Port 80 must be accessible from the internet (HTTP-01 challenge).
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label">Domain</label>
                <input v-model="leDomain" class="input" placeholder="vpn.example.com" />
              </div>
              <div>
                <label class="label">Email</label>
                <input v-model="leEmail" class="input" type="email" placeholder="admin@example.com" />
              </div>
            </div>
            <button
              class="btn-primary w-fit"
              :disabled="tlsLoading || !leDomain || !leEmail"
              @click="runCertbot"
            >
              <span v-if="tlsLoading" class="i-carbon-in-progress animate-spin" />
              <span v-else class="i-carbon-certificate" />
              {{ tlsLoading ? 'Requesting...' : 'Request Certificate' }}
            </button>
          </div>

          <!-- Existing cert -->
          <div v-else class="flex flex-col gap-3">
            <div v-if="existingCerts.length" class="flex flex-col gap-2">
              <label class="label">Found certificates</label>
              <div
                v-for="c in existingCerts"
                :key="c.certPath"
                :class="[
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors',
                  selectedExistingCert === c.certPath
                    ? 'border-primary bg-primary/10'
                    : 'border-surface-300 hover:border-surface-400'
                ]"
                @click="selectExistingCert(c.certPath)"
              >
                <span class="i-carbon-certificate text-primary" />
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium text-base truncate">{{ c.domain }}</p>
                  <p class="text-xs text-overlay truncate font-mono">{{ c.certPath }}</p>
                </div>
                <span v-if="selectedExistingCert === c.certPath" class="i-carbon-checkmark-filled text-primary" />
              </div>
            </div>
            <div class="divider" />
            <div class="grid grid-cols-1 gap-3">
              <div>
                <label class="label">Certificate path (.pem / .crt)</label>
                <input v-model="certPath" class="input font-mono text-xs" placeholder="/etc/ssl/certs/server.crt" />
              </div>
              <div>
                <label class="label">Private key path (.pem / .key)</label>
                <input v-model="keyPath" class="input font-mono text-xs" placeholder="/etc/ssl/private/server.key" />
              </div>
            </div>
          </div>

          <!-- Output / error -->
          <div v-if="tlsError" class="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{{ tlsError }}</div>
          <pre v-if="tlsOutput" class="bg-surface-100 rounded px-3 py-2 text-xs font-mono text-green-400 whitespace-pre-wrap">{{ tlsOutput }}</pre>

          <!-- Итоговые пути (если заполнены) -->
          <div v-if="certPath && keyPath" class="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
            <p class="text-xs text-green-400 font-medium mb-1">Certificate configured</p>
            <p class="text-xs font-mono text-subtext">cert: {{ certPath }}</p>
            <p class="text-xs font-mono text-subtext">key:  {{ keyPath }}</p>
          </div>
        </div>

        <!-- Step 2: Filtering Rules -->
        <div v-else-if="currentStep === 2" class="flex flex-col gap-4">
          <div>
            <h3 class="font-semibold text-sm text-base mb-1">Connection Filtering Rules</h3>
            <p class="text-xs text-subtext">Filter incoming connections by client IP, TLS random prefix, or TLS random with mask.</p>
          </div>

          <div class="flex gap-3">
            <button
              :class="['flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-xs font-medium transition-colors', rulesMode === 'allow_all' ? 'border-primary bg-primary/10 text-primary' : 'border-surface-300 text-subtext hover:border-surface-400']"
              @click="rulesMode = 'allow_all'"
            >
              <span class="i-carbon-checkmark-outline text-base" />
              Allow all connections
            </button>
            <button
              :class="['flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-xs font-medium transition-colors', rulesMode === 'custom' ? 'border-primary bg-primary/10 text-primary' : 'border-surface-300 text-subtext hover:border-surface-400']"
              @click="rulesMode = 'custom'"
            >
              <span class="i-carbon-filter text-base" />
              Custom rules
            </button>
          </div>

          <div v-if="rulesMode === 'custom'" class="flex flex-col gap-2">
            <div v-for="(_, i) in rulesEntries" :key="i" class="flex gap-2">
              <input
                v-model="rulesEntries[i]"
                class="input flex-1 font-mono text-xs"
                placeholder="192.168.1.0/24  or  prefix:abc123"
              />
              <button class="btn-ghost btn-sm text-red-400" @click="removeRule(i)">
                <span class="i-carbon-close" />
              </button>
            </div>
            <button class="btn-secondary btn-sm w-fit" @click="addRule">
              <span class="i-carbon-add" /> Add rule
            </button>
            <p class="text-xs text-overlay mt-1">
              Supports: IP (<code class="font-mono">1.2.3.4</code>), CIDR (<code class="font-mono">10.0.0.0/8</code>),
              prefix (<code class="font-mono">prefix:value</code>), mask (<code class="font-mono">mask:value/bits</code>).
            </p>
          </div>
        </div>

        <!-- Step 3: Initial Users -->
        <div v-else-if="currentStep === 3" class="flex flex-col gap-4">
          <div>
            <h3 class="font-semibold text-sm text-base mb-1">Initial VPN Users</h3>
            <p class="text-xs text-subtext">Optionally add users now. You can always add more later from the Users page.</p>
          </div>

          <div class="flex flex-col gap-2">
            <div v-for="(user, i) in initialUsers" :key="i" class="flex gap-2 items-end">
              <div class="flex-1">
                <label v-if="i === 0" class="label">Username</label>
                <input v-model="user.username" class="input" placeholder="alice" />
              </div>
              <div class="flex-1">
                <label v-if="i === 0" class="label">Password</label>
                <input v-model="user.password" class="input" placeholder="strong-password" />
              </div>
              <button class="btn-ghost btn-sm text-red-400 mb-0.5" @click="removeUser(i)">
                <span class="i-carbon-close" />
              </button>
            </div>
          </div>
          <button class="btn-secondary btn-sm w-fit" @click="addUser">
            <span class="i-carbon-add" /> Add user
          </button>
        </div>

        <!-- Step 4: Review -->
        <div v-else-if="currentStep === 4" class="flex flex-col gap-4">
          <div>
            <h3 class="font-semibold text-sm text-base mb-1">Review & Apply</h3>
            <p class="text-xs text-subtext">The following files will be written to disk:</p>
          </div>

          <div class="flex flex-col gap-2 text-xs">
            <div class="bg-surface-100 rounded-lg p-3">
              <p class="font-mono text-primary font-medium mb-2">vpn.toml</p>
              <pre class="text-subtext whitespace-pre">listen_address = "{{ reviewData.network.listenAddress }}"
credentials = "{{ $route ? '/opt/trusttunnel/credentials' : '' }}"
rules       = "{{ $route ? '/opt/trusttunnel/rules.toml' : '' }}"</pre>
            </div>
            <div class="bg-surface-100 rounded-lg p-3">
              <p class="font-mono text-primary font-medium mb-2">hosts.toml</p>
              <pre class="text-subtext whitespace-pre">[[hosts]]
name = "{{ reviewData.tls.serverName }}"
cert = "{{ reviewData.tls.certPath }}"
key  = "{{ reviewData.tls.keyPath }}"</pre>
            </div>
            <div class="bg-surface-100 rounded-lg p-3">
              <p class="font-mono text-primary font-medium mb-2">rules.toml</p>
              <pre class="text-subtext">rules = [{{ reviewData.rules.entries.length ? `\n  ${reviewData.rules.entries.map(r => `"${r}"`).join(',\n  ')}\n` : '' }}]</pre>
            </div>
            <div v-if="reviewData.initialUsers.length" class="bg-surface-100 rounded-lg p-3">
              <p class="font-mono text-primary font-medium mb-2">credentials</p>
              <pre class="text-subtext">{{ reviewData.initialUsers.map(u => `${u.username}:***`).join('\n') }}</pre>
            </div>
          </div>

          <div v-if="applyError" class="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{{ applyError }}</div>

          <button class="btn-primary w-fit" :disabled="applyLoading" @click="applyConfig">
            <span v-if="applyLoading" class="i-carbon-in-progress animate-spin" />
            <span v-else class="i-carbon-save" />
            {{ applyLoading ? 'Applying...' : 'Apply Configuration' }}
          </button>
        </div>
      </div>

      <!-- Navigation -->
      <div class="flex justify-between">
        <button
          class="btn-secondary"
          :disabled="currentStep === 0"
          @click="onStepChange(currentStep - 1)"
        >
          <span class="i-carbon-arrow-left" /> Back
        </button>
        <button
          v-if="currentStep < steps.length - 1"
          class="btn-primary"
          :disabled="!canProceed"
          @click="onStepChange(currentStep + 1)"
        >
          Next <span class="i-carbon-arrow-right" />
        </button>
      </div>
    </template>
  </div>
</template>
