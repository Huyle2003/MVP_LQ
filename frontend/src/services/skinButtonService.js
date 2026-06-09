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

export async function getSkinButtons(params = {}) {
  const q = new URLSearchParams()
  if (params.keyword) q.set('keyword', params.keyword)
  if (params.hero_id) q.set('hero_id', params.hero_id)
  if (params.skin_id) q.set('skin_id', params.skin_id)
  if (params.status) q.set('status', params.status)
  const qs = q.toString()
  return request(`/api/skin-buttons${qs ? `?${qs}` : ''}`)
}

export async function createSkinButton(formData) {
  return request('/api/skin-buttons', { method: 'POST', body: formData })
}

export async function updateSkinButton(id, formData) {
  return request(`/api/skin-buttons/${id}`, { method: 'PUT', body: formData })
}

export async function deleteSkinButton(id) {
  return request(`/api/skin-buttons/${id}`, { method: 'DELETE' })
}

export async function getSkinButtonDetail(id) {
  return request(`/api/skin-buttons/${id}`)
}
