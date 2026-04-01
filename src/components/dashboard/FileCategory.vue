<script setup>
import { ref, onMounted } from 'vue'
import { useLocale } from '../../composables/useLocale.js'
import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  renameDocument,
  getDocumentStatus,
} from '../../services/knowledge.js'

const { t } = useLocale()

const props = defineProps({
  category: { type: String, required: true },
  icon:     { type: String, default: '📁' },
  color:    { type: String, default: 'blue' },
})

// Custom directive — auto-focus rename input
const vFocus = { mounted: (el) => el.focus() }

const isDragging = ref(false)
const fileInput  = ref(null)
const loading    = ref(true)

const files = ref([])

onMounted(loadFiles)

async function loadFiles() {
  loading.value = true
  try {
    const data = await getDocuments(props.category)
    files.value = (data.documents || []).map(normalizeDoc)
  } catch (err) {
    console.warn('[FileCategory] Could not load documents:', err.message)
    files.value = generateMockFiles(props.category)  // offline fallback
  } finally {
    loading.value = false
  }
}

function normalizeDoc(d) {
  return {
    id:     d.id,
    name:   d.name,
    size:   d.size,
    type:   d.type || 'application/pdf',
    date:   d.created_at ? d.created_at.slice(0, 10) : d.date,
    chunks: d.chunks ?? null,
    status: d.status || 'ready',
  }
}

// Offline fallback mock data
function generateMockFiles(cat) {
  const samples = {
    Textbooks: [
      { id: 1, name: 'Harrison\'s Principles of Internal Medicine 21e.pdf', size: 48200000, type: 'application/pdf', date: '2025-11-02', chunks: 1840 },
      { id: 2, name: 'Robbins Pathologic Basis of Disease 10e.pdf',         size: 36500000, type: 'application/pdf', date: '2025-10-15', chunks: 1120 },
    ],
    Protocols: [
      { id: 4, name: 'ACS Management Protocol 2024.pdf',   size: 1200000, type: 'application/pdf', date: '2025-12-08', chunks: 42 },
      { id: 5, name: 'Sepsis Bundle Clinical Pathway.pdf', size: 980000,  type: 'application/pdf', date: '2025-12-01', chunks: 35 },
    ],
    'Previous Histories': [
      { id: 8, name: 'Patient P-10118 — Discharge Summary Mar 2024.pdf', size: 340000, type: 'application/pdf', date: '2024-03-14', chunks: 12 },
    ],
  }
  return samples[cat] || []
}

function fmtSize(bytes) {
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + ' KB'
  return bytes + ' B'
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' })
}

// upload
function onDrop(e) {
  isDragging.value = false
  const dropped = Array.from(e.dataTransfer.files)
  ingestFiles(dropped)
}

function onInput(e) {
  ingestFiles(Array.from(e.target.files))
  e.target.value = ''
}

async function ingestFiles(list) {
  for (const f of list) {
    const tempId = `uploading-${Date.now()}-${Math.random()}`
    const entry = {
      id: tempId,
      name: f.name,
      size: f.size,
      type: f.type,
      date: new Date().toISOString().slice(0, 10),
      chunks: null,
      status: 'uploading',
      uploading: true,
    }
    files.value.unshift(entry)

    try {
      const result = await uploadDocument(f, props.category)
      const raw = result.document || result
      const doc = normalizeDoc(raw)
      const idx = files.value.findIndex(x => x.id === tempId)
      if (idx !== -1) files.value[idx] = { ...doc, uploading: doc.status !== 'ready' }
      if (doc.status !== 'ready') pollStatus(doc.id, tempId)
    } catch (err) {
      const idx = files.value.findIndex(x => x.id === tempId)
      if (idx !== -1) files.value[idx] = { ...files.value[idx], uploading: false, status: 'failed' }
      console.error('[FileCategory] Upload failed:', err.message)
    }
  }
}

async function pollStatus(docId, tempId) {
  let attempts = 0
  const poll = async () => {
    attempts++
    try {
      const data = await getDocumentStatus(docId)
      const idx = files.value.findIndex(x => x.id === docId || x.id === tempId)
      if (idx !== -1) {
        files.value[idx] = {
          ...files.value[idx],
          chunks:    data.chunks ?? files.value[idx].chunks,
          status:    data.status,
          uploading: data.status !== 'ready' && data.status !== 'failed',
        }
      }
      if (data.status !== 'ready' && data.status !== 'failed' && attempts < 30) {
        setTimeout(poll, 10000)
      }
    } catch { /* retry quietly */ }
  }
  setTimeout(poll, 10000)
}

// rename
const renamingId = ref(null)
const renameVal  = ref('')

function startRename(f) {
  renamingId.value = f.id
  renameVal.value  = f.name
}

async function commitRename(f) {
  const newName = renameVal.value.trim()
  renamingId.value = null
  if (!newName || newName === f.name) return
  const oldName = f.name
  f.name = newName  // optimistic update
  try {
    await renameDocument(f.id, newName)
  } catch (err) {
    f.name = oldName  // revert on failure
    console.error('[FileCategory] Rename failed:', err.message)
  }
}

// delete
async function deleteFile(id) {
  if (!confirm(t.value.dashboard.confirmDelete)) return
  files.value = files.value.filter(f => f.id !== id)  // optimistic
  try {
    await deleteDocument(id)
  } catch (err) {
    console.error('[FileCategory] Delete failed:', err.message)
    await loadFiles()  // refresh from server on failure
  }
}
</script>

<template>
  <div class="category">
    <!-- Header -->
    <div class="cat-header">
      <div class="cat-title">
        <span class="cat-icon">{{ icon }}</span>
        <h3>{{ category }}</h3>
        <span class="badge badge-blue">{{ files.length }}</span>
      </div>
      <label class="btn btn-ghost btn-sm" :for="`file-input-${category}`">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        {{ t.dashboard.upload }}
      </label>
      <input :id="`file-input-${category}`" type="file" multiple hidden @change="onInput" />
    </div>

    <!-- Drop zone (compact) -->
    <div
      class="drop-zone"
      :class="{ dragging: isDragging }"
      @dragenter.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
      </svg>
      <span>{{ t.dashboard.dropHint }} <strong>{{ t.dashboard.tabs[category] || category }}</strong></span>
    </div>

    <!-- File table -->
    <div class="file-table-wrap">
      <table class="file-table" v-if="files.length">
        <thead>
          <tr>
            <th>{{ t.dashboard.fileName }}</th>
            <th>{{ t.dashboard.size }}</th>
            <th>{{ t.dashboard.indexed }}</th>
            <th>{{ t.dashboard.added }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in files" :key="f.id" class="file-row">
            <!-- name / rename -->
            <td class="name-cell">
              <span class="file-type-dot" :class="`dot-${color}`" />
              <form v-if="renamingId === f.id" @submit.prevent="commitRename(f)" style="flex:1">
                <input
                  v-model="renameVal"
                  class="rename-input"
                  @blur="commitRename(f)"
                  @keydown.esc="renamingId = null"
                  v-focus
                />
              </form>
              <span v-else class="file-name" :class="{ uploading: f.uploading }">{{ f.name }}</span>
              <span v-if="f.uploading" class="upload-badge">processing…</span>
            </td>
            <td class="meta-cell">{{ fmtSize(f.size) }}</td>
            <td class="meta-cell">
              <span v-if="f.uploading" class="spinner-inline" />
              <span v-else-if="f.chunks != null" class="badge badge-green">{{ f.chunks }} chunks</span>
              <span v-else class="badge badge-yellow">pending</span>
            </td>
            <td class="meta-cell">{{ fmtDate(f.date) }}</td>
            <td class="actions-cell">
              <button class="btn-icon" title="Rename" @click="startRename(f)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="btn-icon" title="Download">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
              <button class="btn-icon btn-danger" title="Delete" @click="deleteFile(f.id)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="cat-empty">
        <span>{{ t.dashboard.noFiles }}</span>
      </div>
    </div>
  </div>
</template>

<!-- ── styles below ── -->

<style scoped>
.category {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.cat-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}

.cat-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.cat-icon { font-size: 18px; }

h3 { font-size: 14px; font-weight: 600; }

.btn-sm { padding: 5px 10px; font-size: 12px; }

/* drop zone */
.drop-zone {
  margin: 10px 16px;
  border: 1.5px dashed var(--border);
  border-radius: var(--radius-sm);
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-dim);
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.15s;
}
.drop-zone:hover, .drop-zone.dragging {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-glow);
}

/* file table */
.file-table-wrap { overflow-x: auto; }

.file-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.file-table thead th {
  padding: 7px 14px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid var(--border);
}

.file-row {
  border-bottom: 1px solid var(--border);
  transition: background 0.12s;
}
.file-row:last-child { border-bottom: none; }
.file-row:hover { background: var(--surface-2); }

.file-row td { padding: 9px 14px; vertical-align: middle; }

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-type-dot {
  width: 8px;
  height: 8px;
  min-width: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-blue   { background: var(--accent); }
.dot-green  { background: var(--success); }
.dot-yellow { background: var(--warn); }

.file-name {
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 340px;
}
.file-name.uploading { color: var(--text-dim); }

.upload-badge {
  font-size: 11px;
  color: var(--warn);
  white-space: nowrap;
}

.rename-input {
  font-size: 13px;
  padding: 3px 7px;
  height: 28px;
  border-radius: var(--radius-sm);
}

.meta-cell { color: var(--text-muted); white-space: nowrap; }

.actions-cell {
  display: flex;
  gap: 2px;
  justify-content: flex-end;
}

.cat-empty {
  padding: 28px 20px;
  text-align: center;
  font-size: 13px;
  color: var(--text-dim);
}

/* spinner */
.spinner-inline {
  display: inline-block;
  width: 13px;
  height: 13px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
