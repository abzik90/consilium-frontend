<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiJson } from '../services/api.js'
import { useAuth } from '../composables/useAuth.js'
import { useLocale } from '../composables/useLocale.js'

const router = useRouter()
const { setUser, fetchMe } = useAuth()
const { locale, t, setLocale } = useLocale()

// Already logged in → go straight to chat
onMounted(() => {
  if (localStorage.getItem('consilium_token')) router.replace('/chat')
})

const name     = ref('')
const email    = ref('')
const password = ref('')
const error    = ref('')
const loading  = ref(false)

async function submit() {
  error.value   = ''
  loading.value = true
  try {
    const data = await apiJson('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name:     name.value.trim(),
        email:    email.value.trim(),
        password: password.value,
      }),
    })
    localStorage.setItem('consilium_token', data.access_token ?? data.token)
    setUser('', data.access_token ?? data.token)
    await fetchMe()
    router.push('/chat')
  } catch (err) {
    error.value = err.message || t.value.auth.registerError
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-locale">
        <button
          v-for="lang in ['en','ru','kz']"
          :key="lang"
          class="lang-btn"
          :class="{ active: locale === lang }"
          @click="setLocale(lang)"
        >{{ lang.toUpperCase() }}</button>
      </div>

      <!-- Brand -->
      <div class="auth-brand">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
        <span>Consilium</span>
      </div>

      <h1 class="auth-title">{{ t.auth.registerTitle }}</h1>
      <p class="auth-sub">{{ t.auth.registerSubtitle }}</p>

      <form class="auth-form" @submit.prevent="submit">
        <div class="field">
          <label class="field-label">{{ t.auth.fullName }}</label>
          <input
            v-model="name"
            type="text"
            class="field-input"
            placeholder="Dr. Jane Smith"
            autocomplete="name"
            required
          />
        </div>

        <div class="field">
          <label class="field-label">{{ t.auth.email }}</label>
          <input
            v-model="email"
            type="email"
            class="field-input"
            placeholder="jane@hospital.org"
            autocomplete="email"
            required
          />
        </div>

        <div class="field">
          <label class="field-label">{{ t.auth.password }}</label>
          <input
            v-model="password"
            type="password"
            class="field-input"
            :placeholder="t.auth.passwordHint"
            autocomplete="new-password"
            minlength="8"
            required
          />
        </div>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <button type="submit" class="btn btn-primary auth-btn" :disabled="loading">
          <span v-if="loading" class="spinner" />
          {{ loading ? t.auth.registerLoading : t.auth.registerButton }}
        </button>
      </form>

      <p class="auth-footer">
        {{ t.auth.haveAccount }}
        <RouterLink to="/auth/login" class="auth-link">{{ t.auth.signIn }}</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: 24px;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) + 4px);
  padding: 36px 32px 28px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.auth-locale {
  align-self: flex-end;
  display: flex;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  padding: 2px;
  gap: 1px;
  margin-bottom: 8px;
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

.auth-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--accent);
  font-weight: 700;
  font-size: 16px;
  letter-spacing: -0.03em;
  margin-bottom: 10px;
}

.auth-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.03em;
  margin: 0;
}

.auth-sub {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0 0 16px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.field-input {
  height: 38px;
  font-size: 14px;
}

.auth-error {
  font-size: 13px;
  color: var(--error, #e55);
  margin: 0;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--error, #e55) 10%, transparent);
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--error, #e55) 30%, transparent);
}

.auth-btn {
  height: 40px;
  font-size: 14px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.spinner {
  width: 15px;
  height: 15px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.auth-footer {
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 12px;
}

.auth-link {
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}
.auth-link:hover { text-decoration: underline; }
</style>
