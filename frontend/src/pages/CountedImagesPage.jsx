import { Search, Plus, Pencil, Trash2, X, Loader2, FileImage, Image as ImageIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  getCountedImages, createCountedImage, updateCountedImage, deleteCountedImage,
} from '../services/countedImageService.js'

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

function FormModal({ open, editItem, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [defaultQuantity, setDefaultQuantity] = useState(0)
  const [status, setStatus] = useState('ACTIVE')
  const [sortOrder, setSortOrder] = useState(0)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      const e = editItem
      setName(e ? e.name : '')
      setCode(e ? e.code : '')
      setDefaultQuantity(e ? e.default_quantity : 0)
      setStatus(e ? e.status : 'ACTIVE')
      setSortOrder(e ? e.sort_order : 0)
      setImageFile(null)
      setImagePreview('')
      setError('')
    }
  }, [open, editItem])

  function handleImageChange(e) {
    const f = e.target.files?.[0] || null
    setImageFile(f)
    setImagePreview(f ? URL.createObjectURL(f) : '')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Vui lòng nhập tên ảnh'); return }
    if (!editItem && !imageFile) { setError('Vui lòng chọn ảnh'); return }

    try {
      setSaving(true); setError('')
      const fd = new FormData()
      fd.append('name', name.trim())
      if (code.trim()) fd.append('code', code.trim())
      fd.append('default_quantity', String(defaultQuantity))
      fd.append('status', status)
      fd.append('sort_order', String(sortOrder))
      if (imageFile) fd.append('image', imageFile)

      if (editItem) await updateCountedImage(editItem.id, fd)
      else await createCountedImage(fd)
      onSaved()
    } catch (err) { setError(err.message || 'Có lỗi') }
    finally { setSaving(false) }
  }

  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editItem ? 'Sửa ảnh' : 'Thêm ảnh'}</h3>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field"><span>Tên ảnh *</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Tên ảnh" />
            </div>
            <div className="field"><span>Mã code</span>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="Để trống tự sinh" />
            </div>
            <div className="field"><span>Số lượng mặc định</span>
              <input type="number" min={0} value={defaultQuantity} onChange={e => setDefaultQuantity(Number(e.target.value))} />
            </div>
            <div className="field"><span>Trạng thái</span>
              <select className="modal-select" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
            <div className="field"><span>Thứ tự</span>
              <input type="number" min={0} value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
            </div>
            <div className="field">
              <span>Ảnh {!editItem ? '*' : ''}</span>
              <div className="modal-upload-row">
                <label className="crop-upload-btn">
                  <Plus size={16} /><span>Chọn ảnh</span>
                  <input type="file" accept="image/*" onChange={handleImageChange} hidden />
                </label>
                {editItem?.image_url && !imageFile && (
                  <div className="modal-current-img">
                    <img src={editItem.image_url} alt="current" />
                  </div>
                )}
              </div>
              {imagePreview && (
                <div className="modal-preview-img"><img src={imagePreview} alt="preview" /></div>
              )}
            </div>
            {error && <div className="message error">{error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={onClose}>Huỷ</button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? <Loader2 className="spin" size={18} /> : null}
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CountedImagesPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => { loadItems() }, [])

  async function loadItems() {
    try {
      setLoading(true)
      const data = await getCountedImages({ keyword: keyword || undefined, status: statusFilter || undefined })
      setItems(data)
    } catch (err) { setMessage(err.message) }
    finally { setLoading(false) }
  }

  function handleSearch() { loadItems() }

  function handleAdd() { setEditItem(null); setShowModal(true) }
  function handleEdit(item) { setEditItem(item); setShowModal(true) }

  function handleDelete(item) {
    setConfirm({
      title: 'Xoá ảnh',
      msg: `Bạn có chắc muốn xoá "${item.name}"?`,
      async onConfirm() {
        try {
          await deleteCountedImage(item.id)
          setConfirm(null)
          loadItems()
        } catch (err) { setMessage(err.message); setConfirm(null) }
      },
    })
  }

  function handleSaved() { setShowModal(false); loadItems() }

  const filtered = items

  return (
    <div className="page-section">
      <Confirm open={!!confirm} title={confirm?.title || ''} msg={confirm?.msg || ''}
        onConfirm={confirm?.onConfirm || (() => {})}
        onCancel={() => setConfirm(null)} />

      <FormModal open={showModal} editItem={editItem} onClose={() => setShowModal(false)}
        onSaved={handleSaved} />

      <div className="page-header">
        <div>
          <h2>Danh mục ảnh có số lượng</h2>
          <p>Quản lý các icon/vật phẩm có số lượng để chèn vào layout ghép ảnh.</p>
        </div>
        <div className="page-header-actions">
          <button className="primary-button" onClick={handleAdd}>
            <Plus size={18} /> Thêm ảnh
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-search">
          <Search size={16} />
          <input placeholder="Tìm kiếm tên ảnh / code..."
            value={keyword} onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()} />
        </div>
        <select className="filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setTimeout(loadItems, 0) }}>
          <option value="">Tất cả</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
        <button className="secondary-button" onClick={handleSearch}>
          <Search size={16} /> Tìm
        </button>
      </div>

      {message && <div className="message error">{message}</div>}

      {loading ? (
        <div className="loading-center"><Loader2 className="spin" size={32} /></div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <FileImage size={48} />
          <p>Chưa có ảnh nào.</p>
        </div>
      ) : (
        <div className="skin-grid">
          {items.map(item => (
            <div key={item.id} className="skin-card">
              <div className="skin-card-img">
                {item.image_url
                  ? <img src={item.image_url} alt={item.name} />
                  : <div className="skin-card-placeholder"><ImageIcon size={32} /></div>
                }
              </div>
              <div className="skin-card-info">
                <div className="skin-card-name">{item.name}</div>
                <div className="skin-card-code">{item.code}</div>
                <div className="skin-card-meta">
                  <span className="skin-card-quantity">SL: {item.default_quantity}</span>
                  <span className={`status-badge ${item.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                    {item.status}
                  </span>
                  <span className="skin-card-order">#{item.sort_order}</span>
                </div>
              </div>
              <div className="skin-card-actions">
                <button className="icon-button" onClick={() => handleEdit(item)} title="Sửa"><Pencil size={16} /></button>
                <button className="icon-button danger" onClick={() => handleDelete(item)} title="Xoá"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
