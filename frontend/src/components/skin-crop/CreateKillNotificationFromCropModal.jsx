import { useEffect, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'

import { getHeroes, getHeroSkins } from '../../services/heroService.js'
import { createSkinKillNotificationFromCropped } from '../../services/skinKillNotificationService.js'

export default function CreateKillNotificationFromCropModal({ open, croppedItem, onClose, onSaved }) {
  const [heroes, setHeroes] = useState([])
  const [heroKeyword, setHeroKeyword] = useState('')
  const [selectedHero, setSelectedHero] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)

  const [skins, setSkins] = useState([])
  const [loadingSkins, setLoadingSkins] = useState(false)
  const [skinId, setSkinId] = useState('')

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [sortOrder, setSortOrder] = useState(0)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadingHeroes, setLoadingHeroes] = useState(false)

  useEffect(() => {
    if (!open || !croppedItem) return

    setHeroKeyword('')
    setSelectedHero(null)
    setShowDropdown(true)
    setSkins([])
    setSkinId('')
    setName('')
    setCode('')
    setStatus('ACTIVE')
    setSortOrder(0)
    setError('')

    loadHeroes('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, croppedItem])

  async function loadHeroes(keyword) {
    try {
      setLoadingHeroes(true)
      const data = await getHeroes({ keyword: keyword || undefined })
      setHeroes(data)
    } catch (err) {
      console.error('[Hero load] error:', err)
    } finally {
      setLoadingHeroes(false)
    }
  }

  async function loadSkins(heroId) {
    try {
      setLoadingSkins(true)
      setSkins(await getHeroSkins(heroId))
    } catch {
      setSkins([])
    } finally {
      setLoadingSkins(false)
    }
  }

  function handleHeroSearchChange(value) {
    setHeroKeyword(value)
    setShowDropdown(true)
    loadHeroes(value)
  }

  function handleSelectHero(hero) {
    setSelectedHero(hero)
    setHeroKeyword('')
    setShowDropdown(false)
    setSkinId('')
    setName('')
    loadSkins(hero.id)
  }

  // The element being added belongs to a specific skin, and in practice is
  // always named after it — so picking a skin fills the name in. Still
  // editable afterwards for the occasional exception.
  function handleSelectSkin(value) {
    setSkinId(value)
    const skin = skins.find((s) => s.id === value)
    if (skin) setName(skin.name)
  }

  function handleClearHero() {
    setSelectedHero(null)
    setHeroKeyword('')
    setShowDropdown(true)
    setSkins([])
    setSkinId('')
    setName('')
    loadHeroes('')
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!selectedHero) {
      setError('Vui lòng chọn tướng')
      return
    }
    if (!skinId) {
      setError('Vui lòng chọn skin')
      return
    }
    if (!name.trim()) {
      setError('Vui lòng nhập tên thông báo hạ')
      return
    }

    try {
      setSaving(true)
      setError('')
      await createSkinKillNotificationFromCropped({
        skin_id: skinId,
        name: name.trim(),
        code: code.trim() || undefined,
        cropped_object_name: croppedItem.object_name,
        status,
        sort_order: sortOrder,
      })
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
          <h3>Thêm thông báo hạ từ ảnh đã cắt</h3>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        {croppedItem && (
          <div className="crop-modal-preview">
            <img src={croppedItem.image_url} alt="Đã xoá nền" />
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
                  <button type="button" className="tag-remove" onClick={handleClearHero}>
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
                    onChange={(e) => handleHeroSearchChange(e.target.value)}
                    onFocus={() => { setShowDropdown(true); if (!heroes.length) loadHeroes(heroKeyword) }}
                  />
                </div>
              )}

              {!selectedHero && showDropdown && (
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

            {/* Skin selection */}
            {selectedHero && (
              <div className="field">
                <span>Skin *</span>
                <select className="modal-select" value={skinId} onChange={(e) => handleSelectSkin(e.target.value)}>
                  <option value="">-- Chọn skin --</option>
                  {loadingSkins ? (
                    <option>Đang tải...</option>
                  ) : (
                    skins.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)
                  )}
                </select>
              </div>
            )}

            <div className="field">
              <span>Tên thông báo hạ *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên thông báo hạ"
              />
            </div>

            <div className="field">
              <span>Mã code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
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
            <button
              type="submit"
              className="primary-button small"
              disabled={saving || !selectedHero || !skinId}
            >
              {saving ? <Loader2 className="spin" size={18} /> : null}
              Thêm thông báo hạ
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
