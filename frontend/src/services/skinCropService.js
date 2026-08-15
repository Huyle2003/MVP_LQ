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
      detail = parsed.detail || text
    } catch {
      // use text as is
    }
    throw new Error(detail || `Request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

/**
 * Auto-detect skin cards using OpenCV and crop them.
 * @param {FormData} formData - Contains 'image' file
 * @returns {Promise<{image_width, image_height, detected_count, items: Array}>}
 */
export async function autoDetectCrop(formData) {
  return request('/api/skin-crop/auto-detect', {
    method: 'POST',
    body: formData,
  })
}

/**
 * Manual grid-based cropping (fallback).
 * @param {FormData} formData - Contains 'image' file + crop config fields
 * @returns {Promise<{items: Array}>}
 */
export async function manualCrop(formData) {
  return request('/api/skin-crop/manual-crop', {
    method: 'POST',
    body: formData,
  })
}

/**
 * Delete a cropped skin image from MinIO.
 * @param {string} objectName - The object_name of the cropped image
 */
export async function deleteCroppedSkin(objectName) {
  return request('/api/skin-crop/items', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ object_name: objectName }),
  })
}

/**
 * OCR a cropped skin image to detect hero name and skin name.
 * @param {string} objectName - The object_name of the cropped image
 * @returns {Promise<{lines: Array<{text: string, confidence: number}>, full_text: string, hero_name: string|null, skin_name: string|null}>}
 */
export async function ocrCroppedImage(objectName) {
  return request('/api/skin-crop/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ object_name: objectName }),
  })
}

/**
 * Create a hero_skin from a cropped image.
 * @param {string} heroId - UUID of the hero
 * @param {object} payload - { name, skin_code?, cropped_object_name, status, sort_order }
 * @returns {Promise<object>} The created hero skin
 */
export async function createSkinFromCropped(heroId, payload) {
  return request(`/api/skin-crop/heroes/${heroId}/skins/from-cropped`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
