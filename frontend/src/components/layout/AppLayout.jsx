import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'

export default function AppLayout({ user, activeMenu, onMenuChange, onLogout, children }) {
  return (
    <div className="app-shell">
      <Sidebar activeMenu={activeMenu} onMenuChange={onMenuChange} user={user} />

      <div className="main-shell">
        <Topbar user={user} onLogout={onLogout} />
        <main className="content-shell">{children}</main>
      </div>
    </div>
  )
}
