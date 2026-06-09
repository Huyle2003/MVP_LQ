const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8100'

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
      detail = parsed.detail || text
    } catch {
      // use text as is
    }
    throw new Error(detail || `Request failed with status ${response.status}`)
  }

  // 204 No Content
  if (response.status === 204) {
    return null
  }

  return response.json()
}

// ─── Heroes ────────────────────────────────────────────────

export async function getHeroes(params = {}) {
  const query = new URLSearchParams()
  if (params.keyword) query.set('keyword', params.keyword)
  if (params.status) query.set('status', params.status)
  const qs = query.toString()
  return request(`/api/heroes${qs ? `?${qs}` : ''}`)
}

export async function createHero(payload) {
  return request('/api/heroes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function updateHero(id, payload) {
  return request(`/api/heroes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function deleteHero(id) {
  return request(`/api/heroes/${id}`, {
    method: 'DELETE',
  })
}

// ─── Hero Skins ────────────────────────────────────────────

export async function getHeroSkins(heroId) {
  return request(`/api/heroes/${heroId}/skins`)
}

export async function createHeroSkin(heroId, formData) {
  return request(`/api/heroes/${heroId}/skins`, {
    method: 'POST',
    body: formData,
  })
}

export async function updateHeroSkin(skinId, formData) {
  return request(`/api/skins/${skinId}`, {
    method: 'PUT',
    body: formData,
  })
}

export async function deleteHeroSkin(skinId) {
  return request(`/api/skins/${skinId}`, {
    method: 'DELETE',
  })
}

export async function getSkinDetail(skinId) {
  return request(`/api/skins/${skinId}`)
}
