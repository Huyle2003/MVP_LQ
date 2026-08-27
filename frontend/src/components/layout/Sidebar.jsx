import { useState } from 'react'
import {
  Bell,
  CopyPlus,
  Crop,
  Eraser,
  Home,
  Image,
  Images,
  ListOrdered,
  Menu,
  MousePointerClick,
  Scissors,
  Users,
  X,
} from 'lucide-react'

const menuItems = [
  {
    key: 'dashboard',
    label: 'Trang chủ',
    icon: Home,
  },
  {
    key: 'users',
    label: 'Quản lý user',
    icon: Users,
  },
  {
    key: 'compose-skin',
    label: 'Ghép skin',
    icon: Image,
  },
  {
    key: 'skin-crop',
    label: 'Danh mục cắt skin',
    icon: Crop,
  },
  {
    key: 'skin-categories',
    label: 'Danh mục ảnh skin',
    icon: Images,
  },
  {
    key: 'button-categories',
    label: 'Danh mục nút bấm',
    icon: MousePointerClick,
  },
  {
    key: 'notification-categories',
    label: 'Danh mục thông báo hạ',
    icon: Bell,
  },
  {
    key: 'kill-notification-crop',
    label: 'Cắt thông báo hạ',
    icon: Eraser,
  },
  {
    key: 'button-crop',
    label: 'Cắt nút bấm',
    icon: Scissors,
  },
  {
    key: 'other-images',
    label: 'Danh mục ảnh khác',
    icon: CopyPlus,
  },
  {
    key: 'counted-images',
    label: 'Danh mục ảnh có số lượng',
    icon: ListOrdered,
  },
]

export default function Sidebar({ activeMenu, onMenuChange, user }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isAdmin = user?.role === 'ADMIN'

  function handleMenuClick(key) {
    onMenuChange(key)
    setMenuOpen(false)
  }

  const visibleItems = isAdmin
    ? menuItems
    : menuItems.filter(m => m.key === 'dashboard' || m.key === 'compose-skin')

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">IMG</div>
        <div>
          <div className="brand-title">Skin Tool</div>
          <div className="brand-subtitle">Image Composer</div>
        </div>
      </div>
      <button className="sidebar-toggle" onClick={() => setMenuOpen(p => !p)}>
        {menuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <nav className={`sidebar-nav${menuOpen ? ' open' : ''}`}>
        {visibleItems.map((item) => {
          const Icon = item.icon
          const active = activeMenu === item.key

          return (
            <button
              key={item.key}
              type="button"
              className={`sidebar-item ${active ? 'active' : ''}`}
              onClick={() => handleMenuClick(item.key)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
