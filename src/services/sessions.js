import { apiJson, apiUpload, apiStream } from './api.js'

// ── Session CRUD ─────────────────────────────────────────────────────────────

/**
 * List all sessions for the current user.
 * GET /api/sessions
 * @returns {Promise<{ sessions: Session[] }>}
 */
export const getSessions = () => apiJson('/sessions')

/**
 * Fetch a single session by ID.
 * GET /api/sessions/:id
 * @returns {Promise<{ session: Session }>}
 */
export const getSession = (id) => apiJson(`/sessions/${id}`)

/**
 * Create a new session (starts a new consultation).
 * POST /api/sessions
 * @param {string} patientId
 * @returns {Promise<{ session: Session }>}
 */
export const createSession = (patientId) =>
  apiJson('/sessions', {
    method: 'POST',
    body: JSON.stringify({ patientId }),
  })

/**
 * Delete a session and its messages.
 * DELETE /api/sessions/:id
 * @returns {Promise<{ deleted: true }>}
 */
export const deleteSession = (id) =>
  apiJson(`/sessions/${id}`, { method: 'DELETE' })

// ── Messages ─────────────────────────────────────────────────────────────────

/**
 * Fetch full message history for a session.
 * GET /api/sessions/:id/messages
 * @returns {Promise<{ messages: Message[] }>}
 */
export const getMessages = (sessionId) =>
  apiJson(`/sessions/${sessionId}/messages`)

/**
 * Send a message and stream the assistant reply.
 * POST /api/sessions/:id/messages/stream  →  SSE stream
 *
 * Yields event objects:
 *   { type: 'user_message', ... }   Full MessageOut for the user message
 *   { type: 'delta', content: '...' }
 *   { type: 'done', ... }           Full MessageOut for assistant (with citations)
 *   { type: 'error', message: '...' }
 *
 * @param {string}        sessionId
 * @param {string}        content
 * @param {string[]}      fileIds    IDs returned by uploadChatFile()
 * @param {AbortSignal?}  signal
 */
export function streamMessage(sessionId, content, fileIds = [], signal = null) {
  return apiStream(
    `/sessions/${sessionId}/messages/stream`,
    { content, file_ids: fileIds },
    signal,
  )
}
