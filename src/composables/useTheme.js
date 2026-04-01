import { ref, watch } from 'vue'

const theme = ref(localStorage.getItem('consilium-theme') || 'dark')

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t)
  localStorage.setItem('consilium-theme', t)
}

// Apply immediately on import
applyTheme(theme.value)

watch(theme, applyTheme)

export function useTheme() {
  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }
  return { theme, toggleTheme }
}
