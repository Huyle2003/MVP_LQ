import { useState } from 'react'
import { ImagePlus, Lock, Mail, UserPlus } from 'lucide-react'

import { login, register } from '../services/apiClient.js'

export default function LoginPage({ onLogin }) {
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  async function handleLogin(event) {
    event.preventDefault()
    try {
      setLoading(true); setError('')
      const data = await login({ email, password })
      onLogin(data)
    } catch (err) {
      let msg = 'Email hoặc mật khẩu không đúng'
      try { const p = JSON.parse(err.message); msg = p.detail || msg } catch {}
      setError(msg)
    }
    finally { setLoading(false) }
  }

  async function handleRegister(event) {
    event.preventDefault()
    if (regPassword !== regConfirm) { setError('Mật khẩu xác nhận không khớp'); return }
    if (regPassword.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự'); return }
    try {
      setLoading(true); setError('')
      await register({ email: regEmail, password: regPassword })
      setTab('login')
      setEmail(regEmail)
      setPassword('')
      setRegEmail(''); setRegPassword(''); setRegConfirm('')
      setMsg('Đăng ký thành công! Vui lòng đăng nhập.')
    } catch (err) {
      let msg = 'Đăng ký thất bại'
      try { const p = JSON.parse(err.message); msg = p.detail || msg } catch {}
      setError(msg)
    }
    finally { setLoading(false) }
  }

  return (
    <main className="login-page">
      <section className="login-left">
        <div className="login-badge">
          <ImagePlus size={18} />
          Image Composer MVP
        </div>
        <h1>Hệ thống ghép skin</h1>
        <p>Quản lý ảnh skin, cấu hình nút bấm, thông báo hạ và xử lý ghép ảnh bằng Python Worker.</p>
      </section>

      <div className="login-card" style={{ position: 'relative' }}>
        {tab === 'login' ? (
          <form onSubmit={handleLogin}>
            <h2>Đăng nhập</h2>
            <p style={{ margin: '0 0 18px', color: '#64748b' }}>Sử dụng tài khoản để đăng nhập.</p>
            <label className="login-field">
              <span>Email</span>
              <div className="input-with-icon">
                <Mail size={18} />
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
              </div>
            </label>
            <label className="login-field">
              <span>Mật khẩu</span>
              <div className="input-with-icon">
                <Lock size={18} />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" />
              </div>
            </label>            {msg && <div className="message" style={{ background: '#dcfce7', color: '#166534' }}>{msg}</div>}            {error && (
              <div className="message error">
                {error.includes('bị khóa')
                  ? <span>Tài khoản của bạn đã bị khóa.</span>
                  : error.includes('kích hoạt')
                  ? <span> Tài khoản chưa được kích hoạt. Hãy <a href="https://web.facebook.com/people/L%C3%AA-%C4%90%C4%83ng-Huy/pfbid02Tzeoyrwtqua1gE236hojsdZ3ytki2hM2nQ4dkHY2Ujvmz6Zr8ze91SHXpQNQdGBAl/" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 800, textDecoration: 'underline' }}>liên hệ admin</a> để kích hoạt.</span>
                  : error}
              </div>
            )}
            <button className="primary-button" disabled={loading}>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <h2>Đăng ký</h2>
            <p style={{ margin: '0 0 18px', color: '#64748b' }}>Tạo tài khoản mới để sử dụng hệ thống.</p>
            <label className="login-field">
              <span>Email</span>
              <div className="input-with-icon">
                <Mail size={18} />
                <input value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="email@example.com" required />
              </div>
            </label>
            <label className="login-field">
              <span>Mật khẩu</span>
              <div className="input-with-icon">
                <Lock size={18} />
                <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="Ít nhất 6 ký tự" required />
              </div>
            </label>
            <label className="login-field">
              <span>Xác nhận mật khẩu</span>
              <div className="input-with-icon">
                <Lock size={18} />
                <input type="password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)} placeholder="Nhập lại mật khẩu" required />
              </div>
            </label>
            {error && <div className="message error">{error}</div>}
            <button className="primary-button" disabled={loading}>
              {loading ? 'Đang xử lý...' : <><UserPlus size={18} /> Đăng ký</>}
            </button>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <span style={{ fontSize: 13, color: '#64748b', cursor: 'pointer' }} onClick={() => { setTab('login'); setError('') }}>← Quay lại đăng nhập</span>
            </div>
          </form>
        )}
        <div style={{ position: 'absolute', bottom: 12, left: 24, fontSize: 12, color: '#94a3b8' }}>
          {tab === 'login' ? (
            <span style={{ cursor: 'pointer', color: '#2563eb', fontWeight: 700 }} onClick={() => { setTab('register'); setError(''); setMsg('') }}>Đăng ký tài khoản</span>
          ) : null}
        </div>
      </div>
    </main>
  )
}
