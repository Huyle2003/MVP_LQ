import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Pencil, Search, Trash2, X } from 'lucide-react'
import { getUsers, createUser, updateUser, deleteUser, getOnlineUsers } from '../services/apiClient.js'

function FormModal({ open, editItem, onClose, onSaved }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('USER')
  const [status, setStatus] = useState('ACTIVE')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setEmail(editItem ? editItem.email : '')
      setPassword('')
      setRole(editItem ? editItem.role : 'USER')
      setStatus(editItem ? editItem.status : 'ACTIVE')
      setError('')
    }
  }, [open, editItem])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) { setError('Vui lòng nhập email'); return }
    if (!editItem && !password) { setError('Vui lòng nhập mật khẩu'); return }
    try {
      setSaving(true); setError('')
      if (editItem) {
        const p = {}
        if (email !== editItem.email) p.email = email
        if (password) p.password = password
        if (role !== editItem.role) p.role = role
        if (status !== editItem.status) p.status = status
        await updateUser(editItem.id, p)
      } else {
        await createUser({ email, password, role, status })
      }
      onSaved()
    } catch (err) {
      try { const p = JSON.parse(err.message); setError(p.detail || 'Có lỗi') } catch { setError(err.message || 'Có lỗi') }
    } finally { setSaving(false) }
  }

  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editItem ? 'Sửa user' : 'Thêm user'}</h3>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field"><span>Email *</span><input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" /></div>
            <div className="field"><span>Mật khẩu {!editItem ? '*' : ''}</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={editItem ? 'Để trống nếu không đổi' : '••••••'} /></div>
            <div className="field"><span>Vai trò</span>
              <select className="modal-select" value={role} onChange={e => setRole(e.target.value)}>
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <div className="field"><span>Trạng thái</span>
              <select className="modal-select" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="LOCKED">LOCKED</option>
              </select>
            </div>
            {error && <div className="message error">{error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={onClose}>Huỷ</button>
            <button type="submit" className="primary-button" style={{ width: 'auto', padding: '0 24px' }} disabled={saving}>
              {saving ? <Loader2 className="spin" size={18} /> : null} {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [onlineIds, setOnlineIds] = useState(new Set())

  useEffect(() => { loadUsers() }, [])

  // Poll online users every 30s
  useEffect(() => {
    async function fetchOnline() {
      try {
        const list = await getOnlineUsers()
        setOnlineIds(new Set(list.map(u => u.id)))
      } catch {}
    }
    fetchOnline()
    const interval = setInterval(fetchOnline, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadUsers() {
    try { setLoading(true); const d = await getUsers(); setUsers(d) }
    catch (err) { setMessage(err.message) }
    finally { setLoading(false) }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return users
    const kw = search.trim().toLowerCase()
    return users.filter(u => u.email.toLowerCase().includes(kw))
  }, [users, search])

  const activeCount = useMemo(() => users.filter(u => u.status === 'ACTIVE').length, [users])

  function handleAdd() { setEditItem(null); setShowModal(true) }
  function handleEdit(u) { setEditItem(u); setShowModal(true) }

  function handleDelete(u) {
    setConfirm({
      title: 'Xoá user', msg: `Xoá user "${u.email}"?`,
      async onConfirm() {
        try { await deleteUser(u.id); setConfirm(null); loadUsers() }
        catch (err) { setMessage(err.message); setConfirm(null) }
      },
    })
  }

  return (
    <div className="page-section">
      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal-box confirm-box" onClick={e => e.stopPropagation()}>
            <h3>{confirm.title}</h3><p>{confirm.msg}</p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setConfirm(null)}>Huỷ</button>
              <button className="danger-button" onClick={confirm.onConfirm}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      <FormModal open={showModal} editItem={editItem} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); loadUsers() }} />

      <div className="page-header">
        <div>
          <h2>Quản lý user</h2>
          <p>Quản lý tài khoản người dùng hệ thống.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 14, color: '#64748b' }}>Đang hoạt động: <strong style={{ color: '#166534' }}>{activeCount}</strong> / {users.length}</div>
          <button className="primary-button" style={{ width: 'auto', padding: '0 24px' }} onClick={handleAdd}>
            <Plus size={18} /> Thêm user
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-search">
          <Search size={16} />
          <input placeholder="Tìm kiếm email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {message && <div className="message error">{message}</div>}

      <div className="table-card">
        {loading ? (
          <div className="loading-center" style={{ padding: 48, textAlign: 'center' }}><Loader2 className="spin" size={32} /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>Không tìm thấy user</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td><span className="tag">{u.role}</span></td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {onlineIds.has(u.id) && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} title="Đang online" />}
                      <span className={`status ${u.status === 'ACTIVE' ? 'active' : ''}`}>{u.status}</span>
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: '#64748b' }}>{new Date(u.created_at).toLocaleDateString('vi-VN')}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="table-action" onClick={() => handleEdit(u)}><Pencil size={14} /> Sửa</button>
                    <button className="table-action danger-action" onClick={() => handleDelete(u)}><Trash2 size={14} /> Xoá</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
