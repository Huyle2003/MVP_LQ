import { useEffect, useState } from 'react'
import {
  FileImage,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'

import {
  getHeroes,
  createHero,
  updateHero,
  deleteHero,
  getHeroSkins,
  createHeroSkin,
  updateHeroSkin,
  deleteHeroSkin,
} from '../services/heroService.js'
import { capitalizeWords } from '../utils/text.js'

/* ─────────────────────────────────────────── */
/*  Confirm dialog                             */
/* ─────────────────────────────────────────── */
function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box confirm-box" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onCancel}>Huỷ</button>
          <button className="danger-button" onClick={onConfirm}>Xác nhận</button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────── */
/*  Hero Modal                                 */
/* ─────────────────────────────────────────── */
function HeroModal({ open, hero, onClose, onSave }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName(hero ? hero.name : '')
      setCode(hero ? hero.code : '')
      setStatus(hero ? hero.status : 'ACTIVE')
      setError('')
    }
  }, [open, hero])

  if (!open) return null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Vui lòng nhập tên tướng')
      return
    }
    try {
      setSaving(true)
      setError('')
      const payload = { name: name.trim(), code: code.trim() || undefined, status }
      if (hero) {
        await updateHero(hero.id, payload)
      } else {
        await createHero(payload)
      }
      onSave()
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{hero ? 'Sửa tướng' : 'Thêm tướng'}</h3>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field">
              <span>Tên tướng *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên tướng" />
            </div>
            <div className="field">
              <span>Mã tướng</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Để trống để tự sinh" />
            </div>
            <div className="field">
              <span>Trạng thái</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="modal-select">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
            {error && <div className="message error-modal">{error}</div>}
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Huỷ</button>
            <button type="submit" className="primary-button small" disabled={saving}>
              {saving ? <Loader2 className="spin" size={18} /> : null}
              {hero ? 'Cập nhật' : 'Thêm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────── */
/*  Skin Modal                                 */
/* ─────────────────────────────────────────── */
function SkinModal({ open, hero, skin, onClose, onSave }) {
  const [name, setName] = useState('')
  const [skinCode, setSkinCode] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [sortOrder, setSortOrder] = useState(0)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName(skin ? skin.name : '')
      setSkinCode(skin ? skin.skin_code : '')
      setStatus(skin ? skin.status : 'ACTIVE')
      setSortOrder(skin ? skin.sort_order : 0)
      setImageFile(null)
      setImagePreview('')
      setError('')
    }
  }, [open, skin])

  if (!open) return null

  function handleImageChange(e) {
    const file = e.target.files?.[0] || null
    setImageFile(file)
    if (file) {
      setImagePreview(URL.createObjectURL(file))
    } else {
      setImagePreview('')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Vui lòng nhập tên skin')
      return
    }
    if (!skin && !imageFile) {
      setError('Vui lòng chọn ảnh skin')
      return
    }

    try {
      setSaving(true)
      setError('')

      const formData = new FormData()
      formData.append('name', name.trim())

      if (skinCode.trim()) {
        formData.append('skin_code', skinCode.trim())
      }

      formData.append('status', status)
      formData.append('sort_order', String(sortOrder))

      if (imageFile) {
        formData.append('image', imageFile)
      }

      if (skin) {
        await updateHeroSkin(skin.id, formData)
      } else {
        await createHeroSkin(hero.id, formData)
      }
      onSave()
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{skin ? 'Sửa skin' : 'Thêm skin'}</h3>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field">
              <span>Tên skin *</span>
              <input value={name} onChange={(e) => setName(capitalizeWords(e.target.value))} placeholder="Nhập tên skin" />
            </div>
            <div className="field">
              <span>Mã skin</span>
              <input value={skinCode} onChange={(e) => setSkinCode(e.target.value)} placeholder="Để trống để tự sinh" />
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
              <input type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
            </div>
            <div className="field">
              <span>{skin ? 'Ảnh skin (để trống nếu giữ ảnh cũ)' : 'Ảnh skin *'}</span>
              <input className="file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} />
            </div>
            {(imagePreview || (skin && skin.image_url)) && (
              <div className="modal-image-preview">
                <img src={imagePreview || skin.image_url} alt="Preview" />
              </div>
            )}
            {error && <div className="message error-modal">{error}</div>}
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Huỷ</button>
            <button type="submit" className="primary-button small" disabled={saving}>
              {saving ? <Loader2 className="spin" size={18} /> : null}
              {skin ? 'Cập nhật' : 'Thêm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────── */
/*  Skin Card                                  */
/* ─────────────────────────────────────────── */
function SkinCard({ skin, onEdit, onDelete }) {
  return (
    <div className="skin-card">
      <div className="skin-card-image">
        {skin.image_url ? (
          <img src={skin.image_url} alt={skin.name} />
        ) : (
          <div className="skin-card-placeholder"><FileImage size={32} /></div>
        )}
      </div>
      <div className="skin-card-body">
        <div className="skin-card-name">{skin.name}</div>
        <div className="skin-card-code">{skin.skin_code}</div>
        <div className="skin-card-meta">
          <span className={`status ${skin.status === 'ACTIVE' ? 'active' : ''}`}>
            {skin.status}
          </span>
          <span className="skin-order">#{skin.sort_order}</span>
        </div>
      </div>
      <div className="skin-card-actions">
        <button className="table-action" onClick={() => onEdit(skin)} title="Sửa">
          <Pencil size={14} />
        </button>
        <button className="table-action danger-action" onClick={() => onDelete(skin)} title="Xoá">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────── */
/*  Main Page                                  */
/* ─────────────────────────────────────────── */
export default function SkinCategoryPage() {
  const [heroes, setHeroes] = useState([])
  const [selectedHero, setSelectedHero] = useState(null)
  const [skins, setSkins] = useState([])

  const [heroKeyword, setHeroKeyword] = useState('')

  const [loadingHeroes, setLoadingHeroes] = useState(false)
  const [loadingSkins, setLoadingSkins] = useState(false)

  // Modals
  const [heroModal, setHeroModal] = useState(false)
  const [editingHero, setEditingHero] = useState(null)
  const [skinModal, setSkinModal] = useState(false)
  const [editingSkin, setEditingSkin] = useState(null)

  // Confirm
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null })

  // ─── Load heroes ────────────────────────────
  async function loadHeroes() {
    try {
      setLoadingHeroes(true)
      const data = await getHeroes({ keyword: heroKeyword || undefined })
      setHeroes(data)
    } catch (err) {
      console.error('Load heroes error:', err)
    } finally {
      setLoadingHeroes(false)
    }
  }

  useEffect(() => {
    loadHeroes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadHeroes()
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroKeyword])

  // ─── Load skins ─────────────────────────────
  async function loadSkins(heroId) {
    try {
      setLoadingSkins(true)
      const data = await getHeroSkins(heroId)
      setSkins(data)
    } catch (err) {
      console.error('Load skins error:', err)
      setSkins([])
    } finally {
      setLoadingSkins(false)
    }
  }

  useEffect(() => {
    if (selectedHero) {
      loadSkins(selectedHero.id)
    } else {
      setSkins([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHero])

  // ─── Hero CRUD ──────────────────────────────
  function handleAddHero() {
    setEditingHero(null)
    setHeroModal(true)
  }

  function handleEditHero(hero) {
    setEditingHero(hero)
    setHeroModal(true)
  }

  function handleDeleteHero(hero) {
    setConfirm({
      open: true,
      title: 'Xoá tướng',
      message: `Bạn có chắc muốn xoá tướng "${hero.name}"?`,
      onConfirm: async () => {
        try {
          await deleteHero(hero.id)
          if (selectedHero?.id === hero.id) {
            setSelectedHero(null)
          }
          await loadHeroes()
        } catch (err) {
          alert(err.message || 'Không thể xoá tướng')
        } finally {
          setConfirm({ open: false, title: '', message: '', onConfirm: null })
        }
      },
    })
  }

  async function handleHeroSaved() {
    setHeroModal(false)
    setEditingHero(null)
    await loadHeroes()
  }

  // ─── Skin CRUD ──────────────────────────────
  function handleAddSkin() {
    if (!selectedHero) return
    setEditingSkin(null)
    setSkinModal(true)
  }

  function handleEditSkin(skin) {
    setEditingSkin(skin)
    setSkinModal(true)
  }

  function handleDeleteSkin(skin) {
    setConfirm({
      open: true,
      title: 'Xoá skin',
      message: `Bạn có chắc muốn xoá skin "${skin.name}"?`,
      onConfirm: async () => {
        try {
          await deleteHeroSkin(skin.id)
          await loadSkins(selectedHero.id)
        } catch (err) {
          alert(err.message || 'Không thể xoá skin')
        } finally {
          setConfirm({ open: false, title: '', message: '', onConfirm: null })
        }
      },
    })
  }

  async function handleSkinSaved() {
    setSkinModal(false)
    setEditingSkin(null)
    await loadSkins(selectedHero.id)
  }

  // ─── Render ─────────────────────────────────
  return (
    <div className="page-section">
      <div className="page-header">
        <div>
          <h2>Danh mục ảnh skin</h2>
          <p>Quản lý tướng và skin. Click vào tướng để xem danh sách skin.</p>
        </div>
      </div>

      <div className="skin-layout">
        {/* ─── Left column: Heroes ──────────────── */}
        <div className="skin-left">
          <div className="skin-left-header">
            <h3>Danh mục tướng ({heroes.length})</h3>
            <button className="secondary-button" onClick={handleAddHero}>
              <Plus size={16} /> Thêm tướng
            </button>
          </div>

          <div className="skin-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Tìm kiếm tướng..."
              value={heroKeyword}
              onChange={(e) => setHeroKeyword(e.target.value)}
            />
          </div>

          <div className="hero-list">
            {loadingHeroes ? (
              <div className="skin-loading">
                <Loader2 className="spin" size={24} />
              </div>
            ) : heroes.length === 0 ? (
              <div className="empty-state small">
                <p>Chưa có tướng nào</p>
              </div>
            ) : (
              heroes.map((hero) => (
                <div
                  key={hero.id}
                  className={`hero-item ${selectedHero?.id === hero.id ? 'active' : ''}`}
                  onClick={() => setSelectedHero(hero)}
                >
                  <div className="hero-item-info">
                    <div className="hero-item-name">{hero.name}</div>
                    <div className="hero-item-code">{hero.code}</div>
                    <div className="hero-item-meta">
                      <span className={`status ${hero.status === 'ACTIVE' ? 'active' : ''}`}>
                        {hero.status}
                      </span>
                      <span className="hero-skin-count">{hero.skin_count} skin</span>
                    </div>
                  </div>
                  <div className="hero-item-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="table-action" onClick={() => handleEditHero(hero)} title="Sửa">
                      <Pencil size={14} />
                    </button>
                    <button
                      className="table-action danger-action"
                      onClick={() => handleDeleteHero(hero)}
                      title="Xoá"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ─── Right column: Skins ─────────────── */}
        <div className="skin-right">
          {!selectedHero ? (
            <div className="empty-state">
              <FileImage size={48} />
              <h3>Vui lòng chọn một tướng</h3>
              <p>Click vào tướng bên trái để xem danh sách skin.</p>
            </div>
          ) : (
            <>
              <div className="skin-right-header">
                <h3>Skin của {selectedHero.name} ({skins.length})</h3>
                <button className="secondary-button" onClick={handleAddSkin}>
                  <ImagePlus size={16} /> Thêm skin
                </button>
              </div>

              {loadingSkins ? (
                <div className="skin-loading">
                  <Loader2 className="spin" size={24} />
                </div>
              ) : skins.length === 0 ? (
                <div className="empty-state">
                  <FileImage size={48} />
                  <h3>Chưa có skin nào</h3>
                  <p>Thêm skin đầu tiên cho {selectedHero.name}.</p>
                </div>
              ) : (
                <div className="skin-grid">
                  {skins.map((skin) => (
                    <SkinCard
                      key={skin.id}
                      skin={skin}
                      onEdit={handleEditSkin}
                      onDelete={handleDeleteSkin}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <HeroModal
        open={heroModal}
        hero={editingHero}
        onClose={() => { setHeroModal(false); setEditingHero(null) }}
        onSave={handleHeroSaved}
      />

      {selectedHero && (
        <SkinModal
          open={skinModal}
          hero={selectedHero}
          skin={editingSkin}
          onClose={() => { setSkinModal(false); setEditingSkin(null) }}
          onSave={handleSkinSaved}
        />
      )}

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm({ open: false, title: '', message: '', onConfirm: null })}
      />
    </div>
  )
}
