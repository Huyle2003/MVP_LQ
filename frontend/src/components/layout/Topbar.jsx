import { LogOut, ShieldCheck, UserCircle } from 'lucide-react'

export default function Topbar({ user, onLogout }) {
  return (
    <header className="topbar">
      <div>
        <h1>Trang quản trị tool ghép ảnh</h1>
        <p>Quản lý skin, user, nút bấm và cấu hình thông báo.</p>
      </div>

      <div className="topbar-right">
        <div className="user-box">
          <UserCircle size={34} />
          <div>
            <div className="user-email">{user?.email}</div>
            <div className="user-role">
              <ShieldCheck size={14} />
              {user?.role}
            </div>
          </div>
        </div>

        <button className="logout-button" type="button" onClick={onLogout}>
          <LogOut size={17} />
          Logout
        </button>
      </div>
    </header>
  )
}
