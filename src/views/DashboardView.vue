<script setup>
import { ref, computed, onMounted } from 'vue'
import FileCategory from '../components/dashboard/FileCategory.vue'
import { useLocale } from '../composables/useLocale.js'
import { getKBStats } from '../services/knowledge.js'

const { t } = useLocale()

const categories = [
  { key: 'Textbooks',          icon: '📚', color: 'blue'   },
  { key: 'Protocols',          icon: '📋', color: 'green'  },
  { key: 'Previous Histories', icon: '🗂',  color: 'yellow' },
]

const activeTab = ref('Textbooks')
const activecat = computed(() => categories.find(c => c.key === activeTab.value))

const statsData = ref({})

onMounted(async () => {
  try {
    const data = await getKBStats()
    statsData.value = data
  } catch (err) {
    console.warn('[DashboardView] Stats unavailable:', err.message)
  }
})

const stats = computed(() => [
  { label: t.value.dashboard.totalDocs,     value: statsData.value.total_documents  ?? '—' },
  { label: t.value.dashboard.indexedChunks, value: statsData.value.indexed_chunks != null ? Number(statsData.value.indexed_chunks).toLocaleString() : '—' },
  { label: t.value.dashboard.lastUpdated,   value: statsData.value.last_updated ? new Date(statsData.value.last_updated).toLocaleString() : '—' },
  { label: t.value.dashboard.model,         value: statsData.value.embedding_model  ?? '—' },
])
</script>

<template>
  <div class="dashboard">
    <!-- ── Page header ────────────────────────────── -->
    <div class="dash-header">
      <div>
        <h1 class="dash-title">{{ t.dashboard.title }}</h1>
        <p class="dash-sub">{{ t.dashboard.subtitle }}</p>
      </div>
    </div>

    <!-- ── Stats row ──────────────────────────────── -->
    <div class="stats-row">
      <div v-for="s in stats" :key="s.label" class="stat-card">
        <div class="stat-value">{{ s.value }}</div>
        <div class="stat-label">{{ s.label }}</div>
      </div>
    </div>

    <!-- ── Tab bar ────────────────────────────────── -->
    <div class="tab-bar">
      <button
        v-for="c in categories"
        :key="c.key"
        class="tab-btn"
        :class="{ active: activeTab === c.key }"
        @click="activeTab = c.key"
      >
        <span>{{ c.icon }}</span>
        {{ t.dashboard.tabs[c.key] }}
      </button>
    </div>

    <!-- ── Active category description ───────────── -->
    <p class="cat-desc">{{ t.dashboard.descs[activecat.key] }}</p>

    <!-- ── Category file manager ─────────────────── -->
    <Transition name="fade" mode="out-in">
      <FileCategory
        :key="activeTab"
        :category="activecat.key"
        :icon="activecat.icon"
        :color="activecat.color"
      />
    </Transition>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 28px 32px;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* header */
.dash-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.dash-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.03em;
}

.dash-sub {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 3px;
}

/* stats */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 18px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.03em;
}

.stat-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* tabs */
.tab-bar {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  margin-bottom: -1px;
  transition: all 0.15s;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}
.tab-btn:hover { color: var(--text); background: var(--surface); }
.tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); background: var(--surface); }

.cat-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin: -4px 0;
}
</style>
