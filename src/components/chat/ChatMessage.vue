<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true, gfm: true })

const props = defineProps({
  message: {
    type: Object,
    required: true,
    // { id, role, content, files:[], time, thinking, streaming, citations:[{id,title,page,excerpt}] }
  },
  highlightQuery: { type: String, default: '' },
})

const emit = defineEmits(['open-file', 'open-citation'])

function renderMarkdown(raw) {
  if (!raw) return ''
  return DOMPurify.sanitize(marked.parse(raw))
}

function highlightInHtml(html, query) {
  if (!query || !html) return html
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html.replace(
    new RegExp(`(<[^>]*>)|(${escaped})`, 'gi'),
    (m, tag, text) => tag ? tag : `<mark class="search-mark">${text}</mark>`,
  )
}

// Throttled HTML output — parses markdown at most every 80ms during streaming
const renderedHtml = ref(renderMarkdown(props.message.content))
let throttleTimer = null

function flushRender() {
  renderedHtml.value = renderMarkdown(props.message.content)
  throttleTimer = null
}

watch(
  () => props.message.content,
  () => {
    if (props.message.streaming) {
      // Throttle: schedule a render if one isn't pending
      if (!throttleTimer) {
        throttleTimer = setTimeout(flushRender, 80)
      }
    } else {
      // Not streaming — render immediately
      clearTimeout(throttleTimer)
      throttleTimer = null
      flushRender()
    }
  },
)

// Final render when streaming flag turns off
watch(
  () => props.message.streaming,
  (val) => {
    if (!val) {
      clearTimeout(throttleTimer)
      throttleTimer = null
      flushRender()
    }
  },
)

onBeforeUnmount(() => clearTimeout(throttleTimer))

const highlightedHtml = computed(() => highlightInHtml(renderedHtml.value, props.highlightQuery))
const highlightedUserContent = computed(() => highlightInHtml(props.message.content || '', props.highlightQuery))

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const fileIcon = (type = '') => {
  if (type.includes('pdf'))   return '📄'
  if (type.includes('image')) return '🖼'
  if (type.includes('doc'))   return '📝'
  if (type.includes('csv') || type.includes('sheet')) return '📊'
  return '📎'
}

function fmtSize(bytes = 0) {
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  return (bytes / 1024).toFixed(0) + ' KB'
}
</script>

<template>
  <!-- ── User message ──────────────────────────── -->
  <div v-if="message.role === 'user'" class="msg-user">
    <div class="msg-user-inner">
      <!-- Attached files -->
      <div v-if="message.files?.length" class="user-files">
        <button
          v-for="f in message.files"
          :key="f.name"
          class="file-pill"
          @click="emit('open-file', f)"
          :title="f.name"
        >
          <span class="fp-icon">{{ fileIcon(f.type) }}</span>
          <span class="fp-name">{{ f.name }}</span>
          <span class="fp-size">{{ fmtSize(f.size) }}</span>
        </button>
      </div>
      <div v-if="message.content" class="user-bubble" v-html="highlightedUserContent" />
      <span class="msg-time">{{ formatTime(message.time) }}</span>
    </div>
  </div>

  <!-- ── Assistant message ─────────────────────── -->
  <div v-else class="msg-ai">
    <div class="ai-avatar">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    </div>

    <div class="ai-body">
      <!-- Thinking animation -->
      <div v-if="message.thinking" class="thinking">
        <span class="thinking-dot" /><span class="thinking-dot" /><span class="thinking-dot" />
      </div>

      <!-- Content -->
      <div v-else class="ai-content" v-html="highlightedHtml" />

      <!-- Streaming cursor -->
      <span v-if="message.streaming" class="streaming-cursor" />

      <!-- Citations footnotes -->
      <div v-if="!message.thinking && message.citations?.length" class="citations">
        <div class="citations-label">Sources</div>
        <div class="citation-chips">
          <button
            v-for="c in message.citations"
            :key="c.id"
            class="citation-chip"
            :title="c.excerpt || c.title"
            @click="emit('open-citation', c)"
          >
            <span class="cite-num">{{ c.id }}</span>
            <span class="cite-title">{{ c.title }}</span>
            <span v-if="c.page" class="cite-page">p.{{ c.page }}</span>
          </button>
        </div>
      </div>

      <span class="msg-time ai-time">{{ formatTime(message.time) }}</span>
    </div>
  </div>
</template>

<style scoped>
/* ── User ─────────────────────────────────────── */
.msg-user {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0;
}

.msg-user-inner {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  max-width: 85%;
}

.user-files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.file-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--border);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.file-pill:hover { border-color: var(--accent); background: var(--accent-glow); }
.fp-icon { font-size: 14px; }
.fp-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fp-size { font-size: 11px; color: var(--text-muted); }

.user-bubble {
  background: var(--msg-user-bg);
  color: var(--text);
  padding: 10px 15px;
  border-radius: 14px 14px 4px 14px;
  font-size: 14px;
  line-height: 1.65;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  border: 1px solid var(--border-soft);
}

/* ── Assistant ─────────────────────────────────── */
.msg-ai {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  align-items: flex-start;
}

.ai-avatar {
  width: 28px;
  height: 28px;
  min-width: 28px;
  border-radius: 8px;
  background: var(--accent-dim);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 3px;
  flex-shrink: 0;
}

.ai-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-content {
  font-size: 14.5px;
  line-height: 1.75;
  color: var(--text);
  word-break: break-word;
}

/* rich content inside AI responses */
.ai-content :deep(strong) { font-weight: 600; color: var(--text); }
.ai-content :deep(em) { font-style: italic; }
.ai-content :deep(ul), .ai-content :deep(ol) {
  padding-left: 20px;
  margin: 6px 0;
}
.ai-content :deep(li) { margin: 3px 0; }
.ai-content :deep(code) {
  background: var(--surface-3);
  border: 1px solid var(--border);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
  font-size: 12.5px;
  color: var(--accent);
}
.ai-content :deep(pre) {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  overflow-x: auto;
  margin: 8px 0;
}
.ai-content :deep(pre code) {
  background: none;
  border: none;
  padding: 0;
  font-size: 13px;
  color: var(--text);
}
/* Inline citation superscripts from LLM */
.ai-content :deep(sup) {
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  cursor: pointer;
  padding: 0 1px;
}

/* headings */
.ai-content :deep(h1) { font-size: 1.35em; font-weight: 700; margin: 16px 0 8px; color: var(--text); }
.ai-content :deep(h2) { font-size: 1.15em; font-weight: 650; margin: 14px 0 6px; color: var(--text); }
.ai-content :deep(h3) { font-size: 1.05em; font-weight: 600; margin: 12px 0 4px; color: var(--text); }

/* horizontal rule */
.ai-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 14px 0;
}

/* blockquote */
.ai-content :deep(blockquote) {
  border-left: 3px solid var(--accent-dim);
  margin: 8px 0;
  padding: 4px 12px;
  color: var(--text-muted);
  font-style: italic;
}

/* tables */
.ai-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 13.5px;
}
.ai-content :deep(th),
.ai-content :deep(td) {
  border: 1px solid var(--border);
  padding: 6px 10px;
  text-align: left;
}
.ai-content :deep(th) {
  background: var(--surface-2);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}
.ai-content :deep(tr:nth-child(even)) {
  background: var(--surface-2);
}

/* paragraphs */
.ai-content :deep(p) {
  margin: 6px 0;
}

/* search highlight */
:deep(.search-mark) {
  background: #facc15;
  color: #1a1a1a;
  border-radius: 2px;
  padding: 0 1px;
}

/* citations section */
.citations {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  margin-top: 4px;
}

.citations-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-dim);
}

.citation-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.citation-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  max-width: 340px;
  text-align: left;
}
.citation-chip:hover { border-color: var(--accent); background: var(--accent-glow); }

.cite-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: var(--accent-dim);
  color: var(--accent);
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}

.cite-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cite-page {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

/* time */
.msg-time {
  font-size: 11px;
  color: var(--text-dim);
}

.ai-time { align-self: flex-start; }

/* streaming cursor */
.streaming-cursor {
  display: inline-block;
  width: 7px;
  height: 16px;
  background: var(--accent);
  border-radius: 1px;
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: cursor-blink 0.8s steps(2) infinite;
}

@keyframes cursor-blink {
  0%   { opacity: 1; }
  100% { opacity: 0; }
}

/* thinking */
.thinking {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 0;
}

.thinking-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: blink 1.2s infinite;
}
.thinking-dot:nth-child(2) { animation-delay: 0.2s; }
.thinking-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes blink {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
  40%           { opacity: 1;   transform: scale(1); }
}
</style>
