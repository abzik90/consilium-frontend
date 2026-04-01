<script setup>
import { ref } from 'vue'

const props = defineProps({
  stagedFiles: { type: Array, default: () => [] },
})

const emit = defineEmits(['add-files', 'remove-file'])

const isDragging = ref(false)
const fileInput = ref(null)

function onDrop(e) {
  isDragging.value = false
  const files = Array.from(e.dataTransfer.files)
  if (files.length) emit('add-files', files)
}

function onFileInput(e) {
  const files = Array.from(e.target.files)
  if (files.length) emit('add-files', files)
  e.target.value = ''
}

function openPicker() {
  fileInput.value?.click()
}

const fileIcon = (type = '') => {
  if (type.includes('pdf'))   return '📄'
  if (type.includes('image')) return '🖼'
  if (type.includes('doc'))   return '📝'
  if (type.includes('csv') || type.includes('sheet')) return '📊'
  return '📎'
}
</script>

<template>
  <div
    class="drop-root"
    :class="{ dragging: isDragging }"
    @dragenter.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @dragover.prevent
    @drop.prevent="onDrop"
  >
    <!-- Staged files row -->
    <Transition name="fade">
      <div v-if="stagedFiles.length" class="staged-files">
        <div v-for="(f, i) in stagedFiles" :key="f.name + i" class="staged-chip">
          <span>{{ fileIcon(f.type) }}</span>
          <span class="staged-name">{{ f.name }}</span>
          <button class="remove-btn" @click.stop="emit('remove-file', i)" title="Remove">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Drop overlay hint -->
    <Transition name="fade">
      <div v-if="isDragging" class="drop-overlay">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
          <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
        </svg>
        <span>Drop files to attach</span>
      </div>
    </Transition>

    <!-- Hidden file input -->
    <input ref="fileInput" type="file" multiple hidden @change="onFileInput" />

    <!-- Attach button slot exposed via slot -->
    <slot :openPicker="openPicker" />
  </div>
</template>

<style scoped>
.drop-root {
  position: relative;
  transition: background 0.15s;
  border-radius: var(--radius);
}

.drop-root.dragging { background: var(--accent-glow); }

.staged-files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 12px 0;
}

.staged-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px 3px 8px;
  border-radius: 99px;
  background: var(--surface-3);
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-muted);
}

.staged-name {
  color: var(--text);
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.remove-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-dim);
  padding: 0;
  display: flex;
  align-items: center;
  transition: color 0.15s;
}
.remove-btn:hover { color: var(--danger); }

.drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: var(--accent-glow);
  border: 2px dashed var(--accent);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--accent);
  font-size: 14px;
  font-weight: 500;
  pointer-events: none;
}
</style>
