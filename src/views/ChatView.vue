<script setup>
import { ref, computed, nextTick, watch, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import ChatSidebar   from '../components/chat/ChatSidebar.vue'
import ChatMessage   from '../components/chat/ChatMessage.vue'
import FileDropZone  from '../components/chat/FileDropZone.vue'
import ArtifactPanel from '../components/chat/ArtifactPanel.vue'
import { useLocale }     from '../composables/useLocale.js'
import { getMessages, getSession, streamMessage, createSession } from '../services/sessions.js'
import { uploadChatFile }             from '../services/files.js'

const { t } = useLocale()
const router = useRouter()
const route = useRoute()

const sidebarVisible = ref(true)
const inputText      = ref('')
const sidebarRefreshKey = ref(0)
const sidebarRef = ref(null)

function syncSidebarSession(session) {
  sidebarRef.value?.upsertSession(session)
}

function toggleSidebar() {
  sidebarVisible.value = !sidebarVisible.value
}

/* ── New chat: hide sidebar, clear messages ───────── */
function onNewChat() {
  messages.value = []
  stagedFiles.value = []
  activeSession.value = null
  router.push('/chat')
}

/* ── Current patient ──────────────────────────────── */
const activeSession = ref(null)

function onSelectSession(s) {
  // Keep UI responsive while route-based loading rehydrates from API.
  activeSession.value = s
  if (route.params.id === s.id) {
    loadSessionById(s.id)
  }
}

function normalizeSession(s) {
  return {
    id:        s.id,
    patientId: s.patientId || '',
    name:      s.patientName || 'Unknown',
    age:       s.patientAge,
    status:    s.status,
    lastMessage: s.lastMessage || '',
    lastMessageAt: s.lastMessageAt || '',
  }
}

async function loadSessionById(sessionId) {
  if (!sessionId) {
    activeSession.value = null
    messages.value = []
    return
  }

  try {
    const [sessionData, messagesData] = await Promise.all([
      getSession(sessionId),
      getMessages(sessionId),
    ])

    const session = sessionData.session || sessionData
    if (session?.id) {
      activeSession.value = normalizeSession(session)
      syncSidebarSession(activeSession.value)
    }

    messages.value = (messagesData.messages || []).map(normalizeMessage)
  } catch (err) {
    console.warn('[ChatView] Could not load session/messages:', err.message)
    messages.value = []
  }

  scrollToBottom()
}

/** Normalize API message shape to what ChatMessage.vue expects */
function normalizeMessage(m) {
  return {
    _key:      m.id,
    id:        m.id,
    role:      m.role,
    content:   m.content,
    files:     m.files     || [],
    citations: m.citations || [],
    time:      m.createdAt || m.created_at || new Date().toISOString(),
    thinking:  false,
    streaming: false,
  }
}

const messages    = ref([])   // populated by onSelectSession → getMessages()
const isThinking  = ref(false)
const stagedFiles = ref([])
const messagesEl  = ref(null)

watch(
  () => route.params.id,
  (sessionId) => {
    if (typeof sessionId === 'string' && sessionId) {
      loadSessionById(sessionId)
    } else {
      activeSession.value = null
      messages.value = []
    }
  },
  { immediate: true },
)

/* ── Artifact panel ─────────────────────────────── */
const artifactOpen     = ref(false)
const activeFileId     = ref(null)

function openArtifact(file) {
  activeFileId.value = file?.name ?? null
  artifactOpen.value = true
  // Auto-switch to files tab — handled inside ArtifactPanel via activeFileId
}

function closeArtifact() {
  artifactOpen.value = false
  activeFileId.value = null
}

function openCitation(citation) {
  artifactOpen.value = true
  activeFileId.value = null
  // Switch to refs tab via a brief delay so ArtifactPanel picks it up
  nextTick(() => {
    activeFileId.value = `cite-${citation.id}`
  })
}

// Open artifact panel automatically when files are attached in a message
watch(messages, (msgs) => {
  const hasFiles = msgs.some(m => m.files?.length)
  if (hasFiles && !artifactOpen.value) artifactOpen.value = true
}, { deep: true })

/* ── Scroll ─────────────────────────────────────── */
async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

/* ── In-flight abort controller ─────────────────────────────────────────── */
let abortCtrl = null
onUnmounted(() => abortCtrl?.abort())

/* ── Send ───────────────────────────────────────── */
async function sendMessage() {
  const text = inputText.value.trim()
  if (!text && stagedFiles.value.length === 0) return

  // ── 1. Upload staged files and collect server-side IDs ────────────────
  const fileIds  = []
  const fileMeta = []
  for (const f of stagedFiles.value) {
    try {
      const result = await uploadChatFile(f)
      fileIds.push(result.file.id)
      fileMeta.push({ id: result.file.id, name: result.file.name, size: result.file.size, type: result.file.type })
    } catch {
      // Keep for display even if upload failed
      fileMeta.push({ name: f.name, size: f.size, type: f.type })
    }
  }

  // ── 1b. Auto-create session if none is active ────────────────────────
  if (!activeSession.value) {
    try {
      const data = await createSession(null)
      const session = data.session || data
      activeSession.value = {
        id:        session.id,
        patientId: session.patientId,
        name:      session.patientName || t.newChat || 'New consultation',
        age:       session.patientAge,
        status:    session.status,
        lastMessage: '',
        lastMessageAt: new Date().toISOString(),
      }
      syncSidebarSession(activeSession.value)
      router.replace(`/chat/${session.id}`)
    } catch (err) {
      console.error('[ChatView] Failed to create session:', err.message)
      return
    }
  }

  // ── 2. Push user message into local list ──────────────────────────────
  messages.value.push({
    _key:      `user-${Date.now()}`,
    id:        `local-${Date.now()}`,
    role:      'user',
    content:   text,
    files:     fileMeta,
    citations: [],
    time:      new Date().toISOString(),
  })

  inputText.value   = ''
  stagedFiles.value = []
  scrollToBottom()

  // ── 3. Thinking placeholder ───────────────────────────────────────────
  const thinkingId  = `ai-${Date.now()}`
  const thinkingKey = `key-${Date.now()}`
  isThinking.value = true
  messages.value.push({
    _key: thinkingKey,
    id: thinkingId, role: 'assistant', content: '', files: [],
    citations: [], time: new Date().toISOString(), thinking: true, streaming: false,
  })
  scrollToBottom()

  // ── 4. Stream the assistant reply ────────────────────────────────────
  abortCtrl = new AbortController()
  let scrollRaf = 0
  try {
    // Mark thinking done so content starts rendering immediately
    const placeholderIdx = messages.value.findIndex(m => m.id === thinkingId)
    if (placeholderIdx !== -1) {
      messages.value[placeholderIdx].thinking = false
      messages.value[placeholderIdx].streaming = true
    }

    for await (const event of streamMessage(
      activeSession.value.id, text, fileIds, abortCtrl.signal,
    )) {
      const idx = messages.value.findIndex(m => m.id === thinkingId)
      if (idx === -1) break

      if (event.type === 'user_message') {
        // Server confirmed the user message — update its id if needed
        const userIdx = messages.value.findIndex(m => m._key === `user-${Date.now}` || m.role === 'user' && m.id?.startsWith('local-'))
        // not critical, just continue
      } else if (event.type === 'delta') {
        messages.value[idx].content += (event.content || event.delta || '')
        // Throttle scroll to animation frames
        if (!scrollRaf) {
          scrollRaf = requestAnimationFrame(() => {
            scrollRaf = 0
            if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
          })
        }
      } else if (event.type === 'citations') {
        messages.value[idx].citations = event.citations
      } else if (event.type === 'done') {
        // Full assistant MessageOut — update content, citations, id
        if (event.id) messages.value[idx].id = event.id
        if (event.content) messages.value[idx].content = event.content
        if (event.citations) messages.value[idx].citations = event.citations
        messages.value[idx].streaming = false
        break
      } else if (event.type === 'error') {
        messages.value[idx].streaming = false
        messages.value[idx].content = `⚠️ ${event.message || 'Unknown error'}`
        break
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      const idx = messages.value.findIndex(m => m.id === thinkingId)
      if (idx !== -1) {
        messages.value[idx].thinking  = false
        messages.value[idx].streaming = false
        messages.value[idx].content   = `⚠️ ${err.message}`
      }
    }
  } finally {
    // Mark streaming done for the message
    const idx = messages.value.findIndex(m => m.id === thinkingId)
    if (idx !== -1) messages.value[idx].streaming = false
    cancelAnimationFrame(scrollRaf)
    abortCtrl    = null
    isThinking.value = false
    scrollToBottom()

    // Refresh session to pick up patient name extracted from the first message
    if (activeSession.value?.id) {
      try {
        const data = await getSession(activeSession.value.id)
        const session = data.session || data
        if (session?.id) {
          activeSession.value = {
            ...activeSession.value,
            patientId: session.patientId || activeSession.value.patientId,
            name:      session.patientName || activeSession.value.name,
            age:       session.patientAge ?? activeSession.value.age,
            status:    session.status || activeSession.value.status,
            lastMessage: session.lastMessage ?? text,
            lastMessageAt: session.lastMessageAt || new Date().toISOString(),
          }
          syncSidebarSession(activeSession.value)
        }
      } catch {
        // non-critical — header just keeps the old name
      }
    }
  }
}

function autoResize(e) {
  const el = e.target
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
}

function addFiles(files) { stagedFiles.value.push(...files) }
function removeFile(i)   { stagedFiles.value.splice(i, 1) }

/* ── Chat search ────────────────────────────────── */
const chatSearchOpen  = ref(false)
const chatSearchQuery = ref('')
const chatSearchInput = ref(null)

function toggleChatSearch() {
  chatSearchOpen.value = !chatSearchOpen.value
  if (!chatSearchOpen.value) {
    chatSearchQuery.value = ''
  } else {
    nextTick(() => chatSearchInput.value?.focus())
  }
}

// Always show all messages; filtering is replaced by in-text highlighting + navigation
const displayMessages = computed(() => messages.value)

// Keys of messages that contain the search query, in order
const matchKeys = computed(() => {
  const q = chatSearchQuery.value.toLowerCase()
  if (!q) return []
  return messages.value
    .filter(m => (m.content || '').toLowerCase().includes(q))
    .map(m => m._key || m.id)
})

const matchIndex  = ref(0)
const matchCount  = computed(() => matchKeys.value.length)
const currentMatchKey = computed(() => matchKeys.value[matchIndex.value] ?? null)

watch(chatSearchQuery, async () => {
  matchIndex.value = 0
  await nextTick()
  scrollToMatch()
})

watch(matchIndex, scrollToMatch)

async function scrollToMatch() {
  const key = matchKeys.value[matchIndex.value]
  if (!key) return
  await nextTick()
  const el = messagesEl.value?.querySelector(`[data-msg-id="${CSS.escape(String(key))}"]`)
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function goNext() {
  if (!matchCount.value) return
  matchIndex.value = (matchIndex.value + 1) % matchCount.value
}

function goPrev() {
  if (!matchCount.value) return
  matchIndex.value = (matchIndex.value - 1 + matchCount.value) % matchCount.value
}
</script>

<template>
  <div class="chat-layout">
    <!-- Patient sidebar -->
    <ChatSidebar
      ref="sidebarRef"
      :visible="sidebarVisible"
      :refresh-key="sidebarRefreshKey"
      @select="onSelectSession"
      @new-chat="onNewChat"
    />

    <!-- Sidebar toggle (floating, shown when sidebar is hidden) -->
    <Transition name="fade">
      <button v-if="!sidebarVisible" class="sidebar-toggle btn-icon" @click="toggleSidebar" title="Show patients">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6"  x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
    </Transition>

    <!-- ── Main chat column ───────────────────────── -->
    <div class="chat-main">

      <!-- Chat top bar -->
      <div class="chat-header">
        <div class="patient-info">
          <div class="patient-avatar">
            {{ activeSession?.name?.split(' ').map(w => w[0]).join('').slice(0,2) ?? '?' }}
          </div>
          <div>
            <div class="patient-name">{{ activeSession?.name ?? t.noPatientSelected ?? 'No patient selected' }}</div>
            <div class="patient-meta" v-if="activeSession">{{ t.patientId }}:{{ activeSession.patientId }} · {{ activeSession.age }} y/o</div>
          </div>
        </div>

        <div class="chat-header-actions">
          <button class="btn btn-ghost btn-sm" :class="{ 'btn-active-accent': chatSearchOpen }" @click="toggleChatSearch">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            {{ t.searchChat }}
          </button>
          <button class="btn btn-ghost btn-sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {{ t.export }}
          </button>
          <!-- Artifact panel toggle -->
          <button
            class="btn btn-ghost btn-sm"
            :class="{ 'btn-active-accent': artifactOpen }"
            @click="artifactOpen = !artifactOpen"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
            </svg>
            {{ t.artifacts }}
          </button>
        </div>
      </div>

      <!-- Chat search bar -->
      <div v-if="chatSearchOpen" class="chat-search-bar">
        <svg class="chat-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref="chatSearchInput"
          v-model="chatSearchQuery"
          class="chat-search-input"
          :placeholder="t.searchChat || 'Search messages…'"
          @keydown.escape="toggleChatSearch"
          @keydown.enter.exact.prevent="goNext"
          @keydown.shift.enter.prevent="goPrev"
        />
        <span v-if="chatSearchQuery" class="chat-search-count">
          {{ matchCount ? matchIndex + 1 : 0 }} / {{ matchCount }}
        </span>
        <button class="btn-icon chat-search-nav" :disabled="!matchCount" title="Previous match (Shift+Enter)" @click="goPrev">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
        <button class="btn-icon chat-search-nav" :disabled="!matchCount" title="Next match (Enter)" @click="goNext">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <button class="btn-icon chat-search-close" @click="toggleChatSearch">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Drop zone wraps messages + input -->
      <FileDropZone
        class="drop-wrap"
        :staged-files="stagedFiles"
        @add-files="addFiles"
        @remove-file="removeFile"
      >
        <template #default="{ openPicker }">

          <!-- Messages scroll area -->
          <div ref="messagesEl" class="messages-area">
            <!-- Empty state -->
            <div v-if="messages.length === 0" class="empty-chat">
              <div class="empty-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </div>
              <h2 class="empty-title">{{ t.emptyChat }}</h2>
              <p class="empty-sub">Ask for a differential, review labs, or request a protocol summary</p>
              <!-- Quick-action chips -->
              <div class="empty-actions">
                <button class="empty-chip" @click="inputText = 'Suggest a differential diagnosis for '">Differential diagnosis</button>
                <button class="empty-chip" @click="inputText = 'Interpret these lab results: '">Interpret labs</button>
                <button class="empty-chip" @click="inputText = 'Summarise the protocol for '">Protocol summary</button>
                <button class="empty-chip" @click="inputText = 'Check drug interactions: '">Drug interactions</button>
              </div>
            </div>

            <div class="messages-inner">
              <div
                v-for="msg in displayMessages"
                :key="msg._key || msg.id"
                :data-msg-id="msg._key || msg.id"
                :class="{ 'msg-active-match': chatSearchQuery && (msg._key || msg.id) === currentMatchKey }"
              >
                <ChatMessage
                  :message="msg"
                  :highlight-query="chatSearchQuery"
                  @open-file="openArtifact"
                  @open-citation="openCitation"
                />
              </div>
            </div>
          </div>

          <!-- Input bar -->
          <div class="input-wrap">
            <div class="input-bar">
              <button class="btn-icon attach-btn" @click="openPicker" :title="t.attachFiles">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M21.44 11.05L12.25 20.24a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 0 1 18.18 8.8L9.64 17.35a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>
              <textarea
                v-model="inputText"
                rows="1"
                class="chat-input"
                :placeholder="t.sendPlaceholder"
                @input="autoResize"
                @keydown="onKeydown"
              />
              <button
                class="btn btn-primary send-btn"
                :disabled="!inputText.trim() && stagedFiles.length === 0"
                @click="sendMessage"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
            <div class="input-hint">Consilium may produce errors. Always verify with clinical judgment.</div>
          </div>

        </template>
      </FileDropZone>
    </div>

    <!-- ── Artifact panel ─────────────────────────── -->
    <Transition name="slide-right">
      <ArtifactPanel
        v-if="artifactOpen"
        :messages="messages"
        :active-file-id="activeFileId"
        @close="closeArtifact"
      />
    </Transition>
  </div>
</template>

<style scoped>
.chat-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
  position: relative;
  background: var(--bg);
  transition: background 0.25s;
}

/* floating sidebar toggle */
.sidebar-toggle {
  position: absolute;
  left: 12px;
  top: 12px;
  z-index: 50;
  background: var(--surface);
  border: 1px solid var(--border);
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
}

/* ── Main chat ───────────────────────────────────── */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* chat header */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
  transition: background 0.25s, border-color 0.25s;
}

.patient-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.patient-avatar {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--accent-dim);
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.patient-name { font-weight: 600; font-size: 14px; color: var(--text); }
.patient-meta { font-size: 12px; color: var(--text-muted); }

.chat-header-actions { display: flex; gap: 6px; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-active-accent { color: var(--accent); border-color: var(--accent-dim); background: var(--accent-glow); }

/* chat search bar */
.chat-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}
.chat-search-icon { color: var(--text-dim); flex-shrink: 0; }
.chat-search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--text);
  outline: none;
  padding: 4px 0;
}
.chat-search-count { font-size: 11px; color: var(--text-muted); flex-shrink: 0; min-width: 40px; text-align: right; }
.chat-search-nav {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
}
.chat-search-nav:hover:not(:disabled) { background: var(--surface-3); }
.chat-search-nav:disabled { opacity: 0.3; cursor: not-allowed; }
.chat-search-close { flex-shrink: 0; }

/* active match outline */
.msg-active-match {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* drop wrapper */
.drop-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* ── Messages ─────────────────────────────────────── */
.messages-area {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* Inner constrained width for comfortable reading on wide screens */
.messages-inner {
  width: 100%;
  max-width: min(900px, 85%);
  margin: 0 auto;
  padding: 28px 40px 12px;
  display: flex;
  flex-direction: column;
}

/* empty state */
.empty-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 0 20px 100px;
  text-align: center;
}

.empty-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
  letter-spacing: -0.02em;
}

.empty-sub {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 380px;
  line-height: 1.6;
}

.empty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 4px;
}

.empty-chip {
  padding: 7px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}
.empty-chip:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-glow); }

/* ── Input area ──────────────────────────────────── */
.input-wrap {
  padding: 10px 20px 14px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  transition: background 0.25s, border-color 0.25s;
}

/* center input with max-width matching messages */
.input-bar {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  max-width: min(900px, 85%);
  margin: 0 auto;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px 8px 8px 12px;
  transition: border-color 0.15s, background 0.25s;
}
.input-bar:focus-within { border-color: var(--accent); }

.attach-btn { flex-shrink: 0; color: var(--text-muted); }
.attach-btn:hover { color: var(--text); }

.chat-input {
  flex: 1;
  resize: none;
  max-height: 160px;
  min-height: 28px;
  background: transparent;
  border: none;
  font-size: 14px;
  line-height: 1.55;
  overflow-y: auto;
  padding: 0;
}
.chat-input:focus { border: none; outline: none; }

.send-btn {
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 8px;
  flex-shrink: 0;
}
.send-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.input-hint {
  text-align: center;
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 7px;
  max-width: min(900px, 85%);
  margin-left: auto;
  margin-right: auto;
}
</style>
