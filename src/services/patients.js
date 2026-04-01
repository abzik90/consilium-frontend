import { apiJson } from './api.js'

/**
 * Search patients by name or patient ID.
 * GET /api/patients?q=:query
 * @returns {Promise<{ patients: Patient[] }>}
 */
export const searchPatients = (q = '') =>
  apiJson(`/patients?q=${encodeURIComponent(q)}`)

/**
 * Get a single patient record.
 * GET /api/patients/:id
 * @returns {Promise<{ patient: Patient }>}
 */
export const getPatient = (id) => apiJson(`/patients/${id}`)
