<script setup>
import { ref, computed, watch } from 'vue'
import { useLocale } from '../../composables/useLocale.js'

const { t } = useLocale()

const props = defineProps({
  messages: { type: Array, default: () => [] },
  activeFileId: { type: [String, Number], default: null },
})

const emit = defineEmits(['close', 'highlight-file'])

const activeTab = ref('files')

// Auto-switch tab when a citation is selected from ChatMessage
watch(() => props.activeFileId, (id) => {
  if (typeof id === 'string' && id.startsWith('cite-')) {
    activeTab.value = 'refs'
  } else if (id) {
    activeTab.value = 'files'
  }
})

// Collect all unique files across messages
const allFiles = computed(() => {
  const seen = new Set()
  const result = []
  props.messages.forEach(msg => {
    if (msg.files?.length) {
      msg.files.forEach(f => {
        const key = `${f.name}-${f.size}`
        if (!seen.has(key)) {
          seen.add(key)
          result.push({ ...f, msgId: msg.id, msgRole: msg.role })
        }
      })
    }
  })
  return result
})

// Collect all citations across assistant messages
const allCitations = computed(() => {
  const result = []
  props.messages.forEach(msg => {
    if (msg.role === 'assistant' && msg.citations?.length) {
      msg.citations.forEach(c => {
        if (!result.find(x => x.id === c.id)) result.push(c)
      })
    }
  })
  return result
})

const hasContent = computed(() => allFiles.value.length > 0 || allCitations.value.length > 0)

function fileIcon(type = '') {
  if (type.includes('pdf'))   return '📄'
  if (type.includes('image')) return '🖼'
  if (type.includes('doc'))   return '📝'
  if (type.includes('csv') || type.includes('sheet')) return '📊'
  if (type.includes('text')) return '📃'
  return '📎'
}

function fmtSize(bytes = 0) {
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + ' KB'
  return bytes + ' B'
}

function selectFile(f) {
  emit('highlight-file', f)
}
</script>

<template>
  <aside class="artifact-panel">
    <!-- Header -->
    <div class="ap-header">
      <div class="ap-tabs">
        <button class="ap-tab" :class="{ active: activeTab === 'files' }" @click="activeTab = 'files'">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
          </svg>
          {{ t.artifacts }}
          <span v-if="allFiles.length" class="ap-count">{{ allFiles.length }}</span>
        </button>
        <button class="ap-tab" :class="{ active: activeTab === 'refs' }" @click="activeTab = 'refs'">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          {{ t.references }}
          <span v-if="allCitations.length" class="ap-count">{{ allCitations.length }}</span>
        </button>
      </div>
      <button class="btn-icon ap-close" @click="emit('close')" title="Close panel">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- Files tab -->
    <div v-if="activeTab === 'files'" class="ap-body">
      <div v-if="allFiles.length === 0" class="ap-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="1.5">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
        </svg>
        <p>{{ t.noFiles }}</p>
      </div>

      <div v-else class="file-list">
        <div
          v-for="(f, i) in allFiles"
          :key="i"
          class="file-entry"
          :class="{ highlighted: activeFileId === f.name }"
          @click="selectFile(f)"
        >
          <div class="file-entry-icon">{{ fileIcon(f.type) }}</div>
          <div class="file-entry-info">
            <div class="file-entry-name">{{ f.name }}</div>
            <div class="file-entry-meta">
              <span>{{ fmtSize(f.size) }}</span>
              <span class="meta-dot">·</span>
              <span :class="f.msgRole === 'user' ? 'source-user' : 'source-ai'">
                {{ f.msgRole === 'user' ? 'Uploaded by you' : 'From AI' }}
              </span>
            </div>
          </div>
          <div class="file-entry-type">{{ f.type?.split('/')[1]?.toUpperCase() || 'FILE' }}</div>
        </div>
      </div>
    </div>

    <!-- References tab -->
    <div v-if="activeTab === 'refs'" class="ap-body">
      <div v-if="allCitations.length === 0" class="ap-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="1.5">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <p>No references cited yet</p>
      </div>

      <div v-else class="ref-list">
        <div v-for="c in allCitations" :key="c.id" class="ref-entry" :class="{ highlighted: activeFileId === `cite-${c.id}` }">
          <div class="ref-num">[{{ c.id }}]</div>
          <div class="ref-content">
            <div class="ref-title">{{ c.title }}</div>
            <div class="ref-meta" v-if="c.page">p. {{ c.page }}</div>
            <blockquote v-if="c.excerpt" class="ref-excerpt">{{ c.excerpt }}</blockquote>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.artifact-panel {
  width: 300px;
  min-width: 300px;
  height: 100%;
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: background 0.25s, border-color 0.25s;
}

.ap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 0;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.ap-tabs {
  display: flex;
  gap: 0;
}

.ap-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  margin-bottom: -1px;
  transition: all 0.15s;
}
.ap-tab:hover { color: var(--text); }
.ap-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

.ap-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-3);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  width: 16px;
  height: 16px;
  border-radius: 99px;
}
.ap-tab.active .ap-count { background: var(--accent-dim); color: var(--accent); }

.ap-close { margin-left: auto; margin-bottom: 6px; }

.ap-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.ap-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 100%;
  color: var(--text-dim);
  font-size: 12px;
  text-align: center;
  padding: 0 16px;
}

/* file list */
.file-list { display: flex; flex-direction: column; gap: 6px; }

.file-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  cursor: pointer;
  transition: all 0.15s;
}
.file-entry:hover { border-color: var(--accent); background: var(--accent-glow); }
.file-entry.highlighted { border-color: var(--accent); background: var(--accent-glow); }

.file-entry-icon { font-size: 20px; flex-shrink: 0; }

.file-entry-info { flex: 1; min-width: 0; }

.file-entry-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-entry-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.meta-dot { color: var(--text-dim); }
.source-user { color: var(--accent); }

.file-entry-type {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  padding: 2px 5px;
  border-radius: 3px;
  background: var(--surface-3);
  flex-shrink: 0;
}

/* references */
.ref-list { display: flex; flex-direction: column; gap: 10px; }

.ref-entry {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
}

.ref-num {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  flex-shrink: 0;
  margin-top: 1px;
}

.ref-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  line-height: 1.4;
}

.ref-meta {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.ref-excerpt {
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
  border-left: 2px solid var(--border);
  padding-left: 8px;
  margin-top: 6px;
  line-height: 1.5;
}
</style>
