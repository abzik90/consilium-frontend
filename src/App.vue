<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from './composables/useTheme.js'
import { useLocale } from './composables/useLocale.js'
import { useAuth } from './composables/useAuth.js'

const route  = useRoute()
const router = useRouter()
const { theme, toggleTheme } = useTheme()
const { locale, t, setLocale } = useLocale()
const { userName, clearUser, fetchMe } = useAuth()

const isAuthPage = computed(() => route.path.startsWith('/auth'))

// ── User info ────────────────────────────────────────────────────────────────
const displayName = computed(() => userName.value || 'Dr. Resident')
const userInitials = computed(() =>
  displayName.value
    .split(' ')
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join('')
)

// ── User dropdown ────────────────────────────────────────────────────────────
const menuOpen = ref(false)
const menuRef  = ref(null)

function toggleMenu() { menuOpen.value = !menuOpen.value }
function closeMenu()  { menuOpen.value = false }

function logout() {
  clearUser()
  menuOpen.value = false
  router.push('/auth/login')
}

function onWindowClick(e) {
  if (menuRef.value && !menuRef.value.contains(e.target)) closeMenu()
}
onMounted(() => {
  window.addEventListener('click', onWindowClick)
  fetchMe()
})
onUnmounted(() => window.removeEventListener('click', onWindowClick))
</script>

<template>
  <div id="app-shell">
    <!-- ── Top navbar (hidden on auth pages) ─────────────── -->
    <header v-if="!isAuthPage" class="navbar">
      <!-- Brand — clicking logo goes to /chat -->
      <RouterLink to="/chat" class="navbar-brand">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
        <span class="brand-name">Consilium</span>
      </RouterLink>

      <!-- Nav links -->
      <nav class="navbar-nav">
        <RouterLink to="/chat" class="nav-link" :class="{ active: route.path.startsWith('/chat') }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {{ t.chat }}
        </RouterLink>
        <RouterLink to="/dashboard" class="nav-link" :class="{ active: route.path === '/dashboard' }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          {{ t.knowledgeBase }}
        </RouterLink>
      </nav>

      <!-- Right controls -->
      <div class="navbar-end">
        <!-- Language switcher -->
        <div class="lang-switcher">
          <button
            v-for="lang in ['en','ru','kz']"
            :key="lang"
            class="lang-btn"
            :class="{ active: locale === lang }"
            @click="setLocale(lang)"
          >{{ lang.toUpperCase() }}</button>
        </div>

        <!-- Theme toggle -->
        <button class="btn-icon theme-btn" @click="toggleTheme" :title="theme === 'dark' ? 'Switch to light' : 'Switch to dark'">
          <!-- Sun icon (shown in dark mode → switch to light) -->
          <svg v-if="theme === 'dark'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <!-- Moon icon (shown in light mode → switch to dark) -->
          <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>

        <!-- Divider -->
        <div class="nav-divider" />

        <!-- User chip + dropdown -->
        <div class="user-menu" ref="menuRef" @click.stop>
          <button class="avatar-chip" @click="toggleMenu">
            <div class="avatar">{{ userInitials }}</div>
            <span>{{ displayName }}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <Transition name="dropdown">
            <div v-if="menuOpen" class="user-dropdown">
              <div class="dropdown-name">{{ displayName }}</div>
              <div class="dropdown-divider" />
              <button class="dropdown-item dropdown-logout" @click="logout">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign out
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </header>

    <!-- ── Page content ───────────────────────────── -->
    <main class="page" :class="{ 'page-auth': isAuthPage }">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
#app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* navbar */
.navbar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 52px;
  padding: 0 18px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  z-index: 100;
  transition: background 0.25s, border-color 0.25s;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--accent);
  font-weight: 700;
  font-size: 15px;
  letter-spacing: -0.03em;
  text-decoration: none;
  margin-right: 4px;
}
.navbar-brand:hover { opacity: 0.85; }
.brand-name { color: var(--text); }

.navbar-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s;
  text-decoration: none;
}
.nav-link:hover { color: var(--text); background: var(--surface-2); }
.nav-link.active { color: var(--accent); background: var(--accent-glow); }

.navbar-end {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* lang switcher */
.lang-switcher {
  display: flex;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  padding: 2px;
  gap: 1px;
}

.lang-btn {
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  letter-spacing: 0.05em;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.lang-btn:hover { color: var(--text); }
.lang-btn.active { background: var(--accent); color: #fff; }

/* theme button */
.theme-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.nav-divider {
  width: 1px;
  height: 20px;
  background: var(--border);
}

.user-menu {
  position: relative;
}

.avatar-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 3px 10px 3px 4px;
  border-radius: 99px;
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-muted);
  background: none;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.avatar-chip:hover { border-color: var(--accent); background: var(--surface-2); }

.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 180px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm, 0 4px 16px rgba(0,0,0,.12));
  z-index: 200;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropdown-name {
  padding: 6px 10px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: inherit;
  background: none;
  border: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  color: var(--text-muted);
  transition: background 0.12s, color 0.12s;
}
.dropdown-item:hover { background: var(--surface-2); color: var(--text); }

.dropdown-logout { color: var(--error, #e55); }
.dropdown-logout:hover { background: color-mix(in srgb, var(--error, #e55) 10%, transparent); color: var(--error, #e55); }

/* dropdown animation */
.dropdown-enter-active,
.dropdown-leave-active { transition: opacity 0.12s, transform 0.12s; }
.dropdown-enter-from,
.dropdown-leave-to { opacity: 0; transform: translateY(-6px); }

.avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--accent-dim);
  color: var(--accent);
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.page-auth {
  overflow-y: auto;
}
</style>
