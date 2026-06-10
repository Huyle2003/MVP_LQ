const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function getToken() {
  return localStorage.getItem('access_token')
}

async function request(path, options = {}) {
  const token = getToken()

  const headers = {
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const text = await response.text()
    let detail = text
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed.detail)) {
        detail = parsed.detail.map(e => e.msg || JSON.stringify(e)).join('; ')
      } else {
        detail = parsed.detail || text
      }
    } catch {
      // use text as is
    }
    console.error('[API Error]', response.status, text)
    throw new Error(detail || `Request failed with status ${response.status}`)
  }

  return response.json()
}

/**
 * Create a skin-board compose job.
 * @param {object} payload - { background_object, skin_object_names, options }
 * @returns {Promise<{job_id: string, status: string}>}
 */
export async function createSkinBoardComposeJob(payload) {
  return request('/api/compose/skin-board', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

/**
 * Get a job's status and result.
 * @param {string} jobId
 * @returns {Promise<{job_id, status, result_object, result_url, error}>}
 */
export async function getJob(jobId) {
  return request(`/api/jobs/${jobId}`)
}

/**
 * Upload an image file (background).
 * @param {File} file
 * @returns {Promise<{object_name: string, file_url: string}>}
 */
export async function uploadImage(file) {
  const formData = new FormData()
  formData.append('file', file)

  return request('/api/uploads', {
    method: 'POST',
    body: formData,
  })
}
