const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

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

export async function getCountedImages(params = {}) {
  const q = new URLSearchParams()
  if (params.keyword) q.set('keyword', params.keyword)
  if (params.status) q.set('status', params.status)
  const qs = q.toString()
  return request(`/api/counted-images${qs ? `?${qs}` : ''}`)
}

export async function getCountedImageDetail(id) {
  return request(`/api/counted-images/${id}`)
}

export async function createCountedImage(formData) {
  return request('/api/counted-images', { method: 'POST', body: formData })
}

export async function updateCountedImage(id, formData) {
  return request(`/api/counted-images/${id}`, { method: 'PUT', body: formData })
}

export async function deleteCountedImage(id) {
  return request(`/api/counted-images/${id}`, { method: 'DELETE' })
}
