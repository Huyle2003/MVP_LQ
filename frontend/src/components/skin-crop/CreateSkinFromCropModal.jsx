import { useEffect, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'

import { getHeroes } from '../../services/heroService.js'
import { createSkinFromCropped } from '../../services/skinCropService.js'

export default function CreateSkinFromCropModal({ open, croppedItem, onClose, onSaved }) {
  const [heroes, setHeroes] = useState([])
  const [heroKeyword, setHeroKeyword] = useState('')
  const [selectedHero, setSelectedHero] = useState(null)

  const [name, setName] = useState('')
  const [skinCode, setSkinCode] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [sortOrder, setSortOrder] = useState(0)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadingHeroes, setLoadingHeroes] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setHeroKeyword('')
      setSelectedHero(null)
      setName('')
      setSkinCode('')
      setStatus('ACTIVE')
      setSortOrder(0)
      setError('')
      loadHeroes('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Load heroes with keyword
  async function loadHeroes(keyword) {
    try {
      setLoadingHeroes(true)
      const data = await getHeroes({ keyword: keyword || undefined })
      setHeroes(data)
    } catch (err) {
      console.error('Load heroes error:', err)
    } finally {
      setLoadingHeroes(false)
    }
  }

  function handleSearchChange(value) {
    setHeroKeyword(value)
    const timer = setTimeout(() => {
      loadHeroes(value)
    }, 300)
    return () => clearTimeout(timer)
  }

  function handleSelectHero(hero) {
    setSelectedHero(hero)
    setHeroKeyword('')
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!selectedHero) {
      setError('Vui lòng chọn tướng')
      return
    }

    if (!name.trim()) {
      setError('Vui lòng nhập tên skin')
      return
    }

    try {
      setSaving(true)
      setError('')

      const payload = {
        name: name.trim(),
        skin_code: skinCode.trim() || undefined,
        cropped_object_name: croppedItem.object_name,
        status,
        sort_order: sortOrder,
      }

      await createSkinFromCropped(selectedHero.id, payload)
      onSaved()
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Thêm skin từ ảnh đã cắt</h3>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Preview cropped image */}
        {croppedItem && (
          <div className="crop-modal-preview">
            <img src={croppedItem.image_url} alt={`Ảnh cắt ${croppedItem.index}`} />
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Hero selection */}
            <div className="field">
              <span>Chọn tướng *</span>
              {selectedHero ? (
                <div className="selected-hero-tag">
                  <span>{selectedHero.name} ({selectedHero.code})</span>
                  <button type="button" className="tag-remove" onClick={() => setSelectedHero(null)}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="hero-search-inline">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Tìm kiếm tướng..."
                    value={heroKeyword}
                    onChange={(e) => handleSearchChange(e.target.value)}
                  />
                </div>
              )}
              {!selectedHero && (
                <div className="hero-dropdown-list">
                  {loadingHeroes ? (
                    <div className="hero-dropdown-loading">
                      <Loader2 className="spin" size={18} />
                    </div>
                  ) : heroes.length === 0 ? (
                    <div className="hero-dropdown-empty">Không tìm thấy tướng</div>
                  ) : (
                    heroes.map((hero) => (
                      <div
                        key={hero.id}
                        className="hero-dropdown-item"
                        onClick={() => handleSelectHero(hero)}
                      >
                        <div className="hero-dropdown-name">{hero.name}</div>
                        <div className="hero-dropdown-code">{hero.code}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Skin fields */}
            <div className="field">
              <span>Tên skin *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên skin"
              />
            </div>
            <div className="field">
              <span>Mã skin</span>
              <input
                value={skinCode}
                onChange={(e) => setSkinCode(e.target.value)}
                placeholder="Để trống để tự sinh"
              />
            </div>
            <div className="field">
              <span>Trạng thái</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="modal-select">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
            <div className="field">
              <span>Thứ tự hiển thị</span>
              <input
                type="number"
                min="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />
            </div>

            {error && <div className="message error-modal">{error}</div>}
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Huỷ</button>
            <button type="submit" className="primary-button small" disabled={saving || !selectedHero}>
              {saving ? <Loader2 className="spin" size={18} /> : null}
              Thêm skin
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
