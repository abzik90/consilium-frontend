/**
 * Shared reactive auth state (module-level singleton).
 * All components read the same `userName` ref, so updating it
 * in one place (e.g. after login) instantly reflects everywhere.
 */
import { ref } from 'vue'
import { apiJson } from '../services/api.js'

const userName = ref(localStorage.getItem('consilium_user') || '')
const token    = ref(localStorage.getItem('consilium_token') || '')

export function useAuth() {
  function setUser(name, accessToken) {
    userName.value = name  || ''
    token.value    = accessToken || ''
    if (name)        localStorage.setItem('consilium_user',  name)
    if (accessToken) localStorage.setItem('consilium_token', accessToken)
  }

  function clearUser() {
    userName.value = ''
    token.value    = ''
    localStorage.removeItem('consilium_user')
    localStorage.removeItem('consilium_token')
  }

  /** Fetch /auth/me and update userName from the API response. */
  async function fetchMe() {
    if (!localStorage.getItem('consilium_token')) return
    try {
      const data = await apiJson('/auth/me')
      const name = data.name || data.full_name || data.username || data.email || ''
      if (name) {
        userName.value = name
        localStorage.setItem('consilium_user', name)
      }
    } catch {
      // silently ignore – token may be expired, router guard will redirect
    }
  }

  return { userName, token, setUser, clearUser, fetchMe }
}
