import { Search, Plus, Pencil, Trash2, X, Loader2, FileImage } from 'lucide-react'
import { useEffect, useState } from 'react'

import { getHeroes, getHeroSkins } from '../services/heroService.js'
import {
  getSkinButtons, createSkinButton, updateSkinButton, deleteSkinButton,
} from '../services/skinButtonService.js'

/* ─── Confirm Dialog ─────────────────── */
function Confirm({ open, title, msg, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box confirm-box" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{msg}</p>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onCancel}>Huỷ</button>
          <button className="danger-button" onClick={onConfirm}>Xác nhận</button>
        </div>
      </div>
    </div>
  )
}

/* ─── Modal ──────────────────────────── */
function FormModal({ open, editItem, heroes, onClose, onSaved }) {
  const [selectedHero, setSelectedHero] = useState(null)
  const [skins, setSkins] = useState([])
  const [skinId, setSkinId] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [sortOrder, setSortOrder] = useState(0)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadingSkins, setLoadingSkins] = useState(false)

  useEffect(() => {
    if (open) {
      const e = editItem
      setSelectedHero(e ? { id: e.hero_id, name: e.hero_name } : null)
      setSkinId(e ? e.skin_id : '')
      setName(e ? e.name : '')
      setCode(e ? e.code : '')
      setStatus(e ? e.status : 'ACTIVE')
      setSortOrder(e ? e.sort_order : 0)
      setImageFile(null)
      setImagePreview('')
      setError('')
      if (e?.hero_id) loadSkins(e.hero_id)
    }
  }, [open, editItem]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSkins(heroId) {
    try { setLoadingSkins(true); setSkins(await getHeroSkins(heroId)) }
    catch { setSkins([]) }
    finally { setLoadingSkins(false) }
  }

  function handleHeroChange(e) {
    const id = e.target.value
    const hero = heroes.find(h => h.id === id)
    setSelectedHero(hero)
    setSkinId('')
    setSkins([])
    if (id) loadSkins(id)
  }

  function handleImageChange(e) {
    const f = e.target.files?.[0] || null
    setImageFile(f)
    setImagePreview(f ? URL.createObjectURL(f) : '')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!skinId) { setError('Vui lòng chọn skin'); return }
    if (!name.trim()) { setError('Vui lòng nhập tên'); return }
    if (!editItem && !imageFile) { setError('Vui lòng chọn ảnh'); return }

    try {
      setSaving(true); setError('')
      const fd = new FormData()
      fd.append('skin_id', skinId)
      fd.append('name', name.trim())
      if (code.trim()) fd.append('code', code.trim())
      fd.append('status', status)
      fd.append('sort_order', String(sortOrder))
      if (imageFile) fd.append('image', imageFile)

      if (editItem) await updateSkinButton(editItem.id, fd)
      else await createSkinButton(fd)
      onSaved()
    } catch (err) { setError(err.message || 'Có lỗi') }
    finally { setSaving(false) }
  }

  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editItem ? 'Sửa nút bấm' : 'Thêm nút bấm'}</h3>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field"><span>Tướng *</span>
              <select className="modal-select" value={selectedHero?.id || ''} onChange={handleHeroChange}>
                <option value="">-- Chọn tướng --</option>
                {heroes.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div className="field"><span>Skin *</span>
              <select className="modal-select" value={skinId} onChange={e => setSkinId(e.target.value)}
                disabled={!selectedHero}>
                <option value="">-- Chọn skin --</option>
                {loadingSkins ? <option>Đang tải...</option> : skins.map(s =>
                  <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field"><span>Tên nút bấm *</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Tên nút bấm" /></div>
            <div className="field"><span>Mã code</span>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="Để trống tự sinh" /></div>
            <div className="field"><span>Trạng thái</span>
              <select className="modal-select" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
            <div className="field"><span>Thứ tự</span>
              <input type="number" min="0" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} /></div>
            <div className="field"><span>{editItem ? 'Ảnh (để trống giữ ảnh cũ)' : 'Ảnh *'}</span>
              <input className="file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} /></div>
            {(imagePreview || (editItem?.image_url && !imageFile)) &&
              <div className="modal-image-preview">
                <img src={imagePreview || editItem.image_url} alt="preview" /></div>}
            {error && <div className="message error-modal">{error}</div>}
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Huỷ</button>
            <button type="submit" className="primary-button small" disabled={saving}>
              {saving ? <Loader2 className="spin" size={18} /> : null}
              {editItem ? 'Cập nhật' : 'Thêm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Page ────────────────────────────── */
export default function ButtonCategoryPage() {
  const [items, setItems] = useState([])
  const [heroes, setHeroes] = useState([])
  const [keyword, setKeyword] = useState('')
  const [filterHeroId, setFilterHeroId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [confirm, setConfirm] = useState({ open: false })

  useEffect(() => { loadHeroes(); loadData() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => loadData(), 300); return () => clearTimeout(t) }, [keyword, filterHeroId, filterStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadHeroes() { try { setHeroes(await getHeroes()) } catch {} }
  async function loadData() {
    try {
      setLoading(true)
      setItems(await getSkinButtons({
        keyword: keyword || undefined,
        hero_id: filterHeroId || undefined,
        status: filterStatus || undefined,
      }))
    } finally { setLoading(false) }
  }

  function handleAdd() { setEditItem(null); setModalOpen(true) }
  function handleEdit(item) { setEditItem(item); setModalOpen(true) }
  function handleDelete(item) {
    setConfirm({ open: true, title: 'Xoá nút bấm', msg: `Xoá "${item.name}"?`,
      onConfirm: async () => {
        try { await deleteSkinButton(item.id); loadData() }
        catch (e) { alert(e.message) }
        finally { setConfirm({ open: false }) }
      }
    })
  }
  async function handleSaved() { setModalOpen(false); setEditItem(null); loadData() }

  return (
    <div className="page-section">
      <div className="page-header">
        <div>
          <h2>Danh mục nút bấm</h2>
          <p>Quản lý ảnh nút bấm liên kết theo từng skin.</p>
        </div>
        <button className="secondary-button" onClick={handleAdd}><Plus size={16} /> Thêm nút bấm</button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-search"><Search size={16} />
          <input placeholder="Tìm kiếm..." value={keyword} onChange={e => setKeyword(e.target.value)} /></div>
        <select className="filter-select" value={filterHeroId} onChange={e => setFilterHeroId(e.target.value)}>
          <option value="">Tất cả tướng</option>
          {heroes.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? <div className="skin-loading"><Loader2 className="spin" size={24} /></div>
        : items.length === 0 ? <div className="empty-state"><FileImage size={40} /><h3>Chưa có nút bấm nào</h3></div>
        : <table><thead><tr>
            <th>Ảnh</th><th>Tên</th><th>Code</th><th>Tướng</th><th>Skin</th><th>TT</th><th>STT</th><th></th>
          </tr></thead><tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td><img className="table-thumb" src={item.image_url} alt="" /></td>
                <td><strong>{item.name}</strong></td>
                <td><span className="tag">{item.code}</span></td>
                <td>{item.hero_name}</td>
                <td>{item.skin_name}</td>
                <td><span className={`status ${item.status === 'ACTIVE' ? 'active' : ''}`}>{item.status}</span></td>
                <td>{item.sort_order}</td>
                <td>
                  <button className="table-action" onClick={() => handleEdit(item)}><Pencil size={14} /></button>
                  <button className="table-action danger-action" onClick={() => handleDelete(item)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody></table>}
      </div>

      <FormModal open={modalOpen} editItem={editItem} heroes={heroes}
        onClose={() => { setModalOpen(false); setEditItem(null) }} onSaved={handleSaved} />
      <Confirm open={confirm.open} title={confirm.title} msg={confirm.msg}
        onConfirm={confirm.onConfirm} onCancel={() => setConfirm({ open: false })} />
    </div>
  )
}
