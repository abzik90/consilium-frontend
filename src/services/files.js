import { apiJson, apiUpload } from './api.js'

/**
 * Upload a file attached to a chat message.
 * POST /api/files  (multipart/form-data)
 *
 * @param  {File}    file
 * @returns {Promise<{ file: ChatFile }>}
 *
 * ChatFile: { id, name, size, type, url }
 * The returned `id` is passed as an element of `file_ids` when sending a message.
 */
export const uploadChatFile = (file) => apiUpload('/upload', file)

/**
 * Get a signed download URL for a chat file.
 * GET /api/files/:id
 * @returns {Promise<{ file: ChatFile }>}
 */
export const getChatFile = (id) => apiJson(`/files/${id}`)
