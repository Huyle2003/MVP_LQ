const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8100'

function getToken() {
  return localStorage.getItem('access_token')
}

async function request(path, options = {}) {
  const token = getToken()
  const headers = { ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  if (!response.ok) {
    const text = await response.text()
    let detail = text
    try { const p = JSON.parse(text); detail = p.detail || text } catch {}
    throw new Error(detail || `Request failed with status ${response.status}`)
  }
  if (response.status === 204) return null
  return response.json()
}

export async function getOtherImages(params = {}) {
  const q = new URLSearchParams()
  if (params.keyword) q.set('keyword', params.keyword)
  if (params.status) q.set('status', params.status)
  const qs = q.toString()
  return request(`/api/other-images${qs ? `?${qs}` : ''}`)
}

export async function getOtherImageDetail(id) {
  return request(`/api/other-images/${id}`)
}

export async function createOtherImage(formData) {
  return request('/api/other-images', { method: 'POST', body: formData })
}

export async function updateOtherImage(id, formData) {
  return request(`/api/other-images/${id}`, { method: 'PUT', body: formData })
}

export async function deleteOtherImage(id) {
  return request(`/api/other-images/${id}`, { method: 'DELETE' })
}
