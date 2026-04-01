import { apiJson, apiUpload } from './api.js'

// ── Documents ────────────────────────────────────────────────────────────────

/**
 * List documents in a knowledge-base category.
 * GET /api/knowledge/documents?category=:cat
 * @returns {Promise<{ documents: KBDocument[] }>}
 */
export const getDocuments = (category) =>
  apiJson(`/knowledge/documents?category=${encodeURIComponent(category)}`)

/**
 * Upload a file to the knowledge base.
 * POST /api/knowledge/documents  (multipart/form-data)
 * @returns {Promise<{ document: KBDocument }>}
 */
export const uploadDocument = (file, category) =>
  apiUpload('/knowledge/documents', file, { category })

/**
 * Poll processing status for a document.
 * GET /api/knowledge/documents/:id/status
 * @returns {Promise<{ id, status: 'pending'|'processing'|'ready'|'failed', chunks: number|null }>}
 */
export const getDocumentStatus = (id) =>
  apiJson(`/knowledge/documents/${id}/status`)

/**
 * Rename a document (metadata only – does not reindex).
 * PATCH /api/knowledge/documents/:id
 * @returns {Promise<{ document: KBDocument }>}
 */
export const renameDocument = (id, name) =>
  apiJson(`/knowledge/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })

/**
 * Delete a document and all its index chunks.
 * DELETE /api/knowledge/documents/:id
 * @returns {Promise<{ deleted: true }>}
 */
export const deleteDocument = (id) =>
  apiJson(`/knowledge/documents/${id}`, { method: 'DELETE' })

// ── Stats ─────────────────────────────────────────────────────────────────────

/**
 * Aggregate stats for the dashboard.
 * GET /api/knowledge/stats
 * @returns {Promise<KBStats>}
 */
export const getKBStats = () => apiJson('/knowledge/stats')
