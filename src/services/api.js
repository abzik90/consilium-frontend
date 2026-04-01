/**
 * Base HTTP client for Consilium API.
 *
 * VITE_API_BASE_URL – set in .env.local (or .env.production) to point at your
 * backend.  Leave empty in development and the Vite dev-server proxy will
 * forward /api/* to API_TARGET (default http://localhost:8000).
 */

const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

// ── Custom error ────────────────────────────────────────────────────────────
export class ApiError extends Error {
  /**
   * @param {string}  message
   * @param {number}  status  HTTP status code
   * @param {object}  data    Parsed response body
   */
  constructor(message, status, data) {
    super(message)
    this.name   = 'ApiError'
    this.status = status
    this.data   = data
  }
}

// ── Auth helper ─────────────────────────────────────────────────────────────
function authHeaders() {
  const token = localStorage.getItem('consilium_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Core fetch wrapper ───────────────────────────────────────────────────────
/**
 * Fetch `BASE + /api + path` and throw ApiError on non-2xx.
 * Returns the raw Response so callers can choose how to consume it.
 */
export async function apiFetch(path, options = {}) {
  const url = `${BASE}/api/v1${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(),
      ...options.headers,
    },
  })

  if (!res.ok) {
    let data = {}
    try { data = await res.clone().json() } catch {}
    // Redirect to login on 401 (expired/invalid token)
    if (res.status === 401 && !path.startsWith('/auth/')) {
      localStorage.removeItem('consilium_token')
      localStorage.removeItem('consilium_user')
      window.location.href = '/auth/login'
      return
    }
    // FastAPI can return detail as an array of validation error objects
    let msg = res.statusText
    if (typeof data.detail === 'string') {
      msg = data.detail
    } else if (Array.isArray(data.detail)) {
      msg = data.detail.map(e => e.msg || JSON.stringify(e)).join('; ')
    } else if (typeof data.message === 'string') {
      msg = data.message
    } else if (res.status === 401) {
      msg = 'Invalid email or password'
    } else if (res.status === 409) {
      msg = 'An account with this email already exists'
    }
    throw new ApiError(msg, res.status, data)
  }

  return res
}

/**
 * Redirect to login on 401 – call from catch blocks if needed.
 */
export function handleAuthError(err) {
  if (err?.status === 401) {
    localStorage.removeItem('consilium_token')
    localStorage.removeItem('consilium_user')
    window.location.href = '/auth/login'
  }
}

/**
 * Shorthand: fetch JSON and return parsed body.
 */
export async function apiJson(path, options = {}) {
  const res = await apiFetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  return res.json()
}

/**
 * Upload a file (multipart/form-data).
 * `fields`  – additional FormData fields: { category: 'Textbooks', … }
 */
export async function apiUpload(path, file, fields = {}) {
  const form = new FormData()
  form.append('file', file)
  Object.entries(fields).forEach(([k, v]) => form.append(k, v))

  const res = await fetch(`${BASE}/api/v1${path}`, {
    method: 'POST',
    headers: { ...authHeaders() },   // No Content-Type – browser sets boundary
    body: form,
  })

  if (!res.ok) {
    let data = {}
    try { data = await res.clone().json() } catch {}
    let msg = res.statusText
    if (typeof data.detail === 'string') {
      msg = data.detail
    } else if (Array.isArray(data.detail)) {
      msg = data.detail.map(e => e.msg || JSON.stringify(e)).join('; ')
    } else if (typeof data.message === 'string') {
      msg = data.message
    } else if (res.status === 401) {
      msg = 'Invalid email or password'
    } else if (res.status === 409) {
      msg = 'An account with this email already exists'
    }
    throw new ApiError(msg, res.status, data)
  }

  return res.json()
}

/**
 * Consume a Server-Sent Events stream from a POST endpoint.
 * Yields each parsed `data:` event until `data: [DONE]`.
 *
 * @param {string}              path     e.g. `/sessions/sess_abc/messages`
 * @param {object}              body     JSON body
 * @param {AbortSignal | null}  signal   Optional cancel signal
 */
export async function* apiStream(path, body, signal = null) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let data = {}
    try { data = await res.clone().json() } catch {}
    if (res.status === 401 && !path.startsWith('/auth/')) {
      localStorage.removeItem('consilium_token')
      localStorage.removeItem('consilium_user')
      window.location.href = '/auth/login'
      return
    }
    throw new ApiError(
      data.detail || data.message || res.statusText,
      res.status,
      data,
    )
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let   buffer  = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()   // keep incomplete last line for next chunk

    let eventName = null
    for (const line of lines) {
      // Named event: "event: delta"
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
        continue
      }
      if (!line.startsWith('data:')) {
        // blank line resets event name per SSE spec
        if (line.trim() === '') eventName = null
        continue
      }
      const raw = line.slice(5).trim()
      if (raw === '[DONE]') return
      try {
        const parsed = JSON.parse(raw)
        // Attach the event name if present
        if (eventName && !parsed.type) parsed.type = eventName
        yield parsed
      } catch {
        // malformed event – skip
      }
      eventName = null
    }
  }
}
