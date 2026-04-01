<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useLocale } from '../../composables/useLocale.js'
import { getSessions, deleteSession } from '../../services/sessions.js'

const { t } = useLocale()

const props = defineProps({
  visible: Boolean,
  refreshKey: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['select', 'new-chat'])

const router = useRouter()
const route = useRoute()

const search   = ref('')
const loading  = ref(true)
const sessions = ref([])

// Normalize API response to the shape the template expects
function normalizeSession(s) {
  const patientName = s.patientName || s.name || 'Unknown'
  const patientId = s.patientId || s.patient_id || ''
  const patientAge = s.patientAge ?? s.age
  const status = s.status || 'active'
  const lastMessage = s.lastMessage || s.lastMsg || ''
  const lastMessageAt = s.lastMessageAt || s.time || ''

  const formattedTime = typeof lastMessageAt === 'string' && lastMessageAt
    ? (lastMessageAt.includes('T')
      ? new Date(lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : lastMessageAt)
    : ''

  return {
    id:        s.id,
    patientId,
    name:      patientName,
    age:       patientAge,
    status,
    lastMsg:   lastMessage,
    time:      formattedTime,
  }
}

function upsertSession(session) {
  const normalized = normalizeSession(session)
  const existingIndex = sessions.value.findIndex(item => item.id === normalized.id)

  if (existingIndex === -1) {
    sessions.value = [normalized, ...sessions.value]
    return
  }

  const existingSession = sessions.value[existingIndex]
  const nextSessions = [...sessions.value]
  nextSessions.splice(existingIndex, 1)
  sessions.value = [
    {
      ...existingSession,
      ...normalized,
    },
    ...nextSessions,
  ]
}

async function loadSessions() {
  try {
    const data = await getSessions()
    sessions.value = (data.sessions || []).map(normalizeSession)
  } catch (err) {
    console.warn('[ChatSidebar] Failed to load sessions from API:', err.message)
  } finally {
    loading.value = false
  }
}

onMounted(loadSessions)

watch(() => props.refreshKey, loadSessions)

watch(() => props.visible, (visible) => {
  if (visible) loadSessions()
})

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return sessions.value
  return sessions.value.filter(s =>
    (s.name || '').toLowerCase().includes(q) || (s.patientId || '').includes(q)
  )
})

function selectSession(s) {
  emit('select', s)
  router.push(`/chat/${s.id}`)
}

async function removeSession(s, event) {
  event.stopPropagation()
  if (!confirm(`Delete session for ${s.name}?`)) return
  try {
    await deleteSession(s.id)
    sessions.value = sessions.value.filter(x => x.id !== s.id)
    // If deleted session was active, navigate to /chat
    if (route.params.id === s.id) {
      emit('new-chat')
      router.push('/chat')
    }
  } catch (err) {
    console.error('[ChatSidebar] Delete failed:', err.message)
  }
}

function newChat() {
  emit('new-chat')
  router.push('/chat')
}

defineExpose({
  upsertSession,
})
</script>

<template>
  <Transition name="slide-left">
    <aside v-if="visible" class="sidebar">
      <!-- Header -->
      <div class="sidebar-header">
        <span class="sidebar-title">{{ t.patients }}</span>
        <button class="btn btn-primary btn-sm" @click="newChat">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {{ t.newChat }}
        </button>
      </div>

      <!-- Search -->
      <div class="sidebar-search">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input v-model="search" :placeholder="t.search" class="search-input" />
      </div>

      <!-- List -->
      <ul class="session-list">
        <li
          v-for="s in filtered"
          :key="s.id"
          class="session-item"
          :class="{ active: route.params.id === s.id }"
          @click="selectSession(s)"
        >
          <div class="session-avatar">{{ (s.name || '?').split(' ').map(w => w[0]).join('').slice(0,2) }}</div>
          <div class="session-info">
            <div class="session-top">
              <span class="session-name">{{ s.name }}</span>
              <span class="session-time">{{ s.time }}</span>
            </div>
            <div class="session-bottom">
              <span class="session-pid">id:{{ s.patientId }}</span>
              <span class="session-preview">{{ s.lastMsg }}</span>
            </div>
          </div>
          <button class="delete-btn" @click="removeSession(s, $event)" title="Delete session">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
          <span
            class="session-dot"
            :class="s.status === 'active' ? 'dot-active' : 'dot-done'"
          />
        </li>
        <li v-if="filtered.length === 0" class="empty-state">
          No patients found
        </li>
      </ul>
    </aside>
  </Transition>
</template>

<style scoped>
.sidebar {
  width: 280px;
  min-width: 280px;
  height: 100%;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: background 0.25s, border-color 0.25s;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.btn-sm { padding: 4px 10px; font-size: 12px; }

.sidebar-search {
  position: relative;
  padding: 0 12px 10px;
  flex-shrink: 0;
}

.search-icon {
  position: absolute;
  left: 22px;
  top: 50%;
  transform: translateY(-60%);
  color: var(--text-dim);
  pointer-events: none;
}

.search-input {
  padding-left: 32px;
  font-size: 13px;
  height: 32px;
}

.session-list {
  list-style: none;
  overflow-y: auto;
  flex: 1;
  padding: 4px 8px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  position: relative;
  transition: background 0.12s;
}
.session-item:hover { background: var(--surface-2); }
.session-item.active { background: var(--accent-glow); }

.session-avatar {
  width: 34px;
  height: 34px;
  min-width: 34px;
  border-radius: 50%;
  background: var(--surface-3);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.session-info { flex: 1; min-width: 0; }

.session-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.session-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-time { font-size: 11px; color: var(--text-dim); flex-shrink: 0; }

.session-bottom {
  display: flex;
  align-items: center;
  gap: 6px;
}

.session-pid {
  font-size: 11px;
  color: var(--accent);
  font-weight: 600;
  flex-shrink: 0;
}

.session-preview {
  font-size: 12px;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-dot {
  width: 7px;
  height: 7px;
  min-width: 7px;
  border-radius: 50%;
  position: absolute;
  top: 9px;
  right: 10px;
}
.dot-active { background: var(--success); box-shadow: 0 0 6px var(--success); }
.dot-done   { background: var(--text-dim); }

.delete-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}
.session-item:hover .delete-btn { display: flex; }
.delete-btn:hover { background: var(--danger, #e5484d); color: #fff; }

.empty-state {
  text-align: center;
  padding: 32px 0;
  color: var(--text-dim);
  font-size: 13px;
}
</style>
