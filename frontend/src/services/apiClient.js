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
    throw new Error(text || `Request failed with status ${response.status}`)
  }

  return response.json()
}

export async function login(payload) {
  return request('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export async function register(payload) {
  return request('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export async function getMe() {
  return request('/api/auth/me')
}

export async function heartbeat() {
  return request('/api/auth/heartbeat', { method: 'POST' })
}

export async function getOnlineUsers() {
  return request('/api/auth/online')
}

export async function getUsers() {
  return request('/api/auth/users')
}

export async function createUser(payload) {
  return request('/api/auth/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export async function updateUser(id, payload) {
  return request(`/api/auth/users/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export async function deleteUser(id) {
  return request(`/api/auth/users/${id}`, {
    method: 'DELETE',
  })
}

export async function uploadImage(file) {
  const formData = new FormData()
  formData.append('file', file)

  return request('/api/uploads', {
    method: 'POST',
    body: formData,
  })
}

export async function createComposeJob(payload) {
  return request('/api/compose', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export async function getJob(jobId) {
  return request(`/api/jobs/${jobId}`)
}
