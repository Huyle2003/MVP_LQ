import { useEffect, useState } from 'react'

import LoginPage from './pages/LoginPage.jsx'
import AppLayout from './components/layout/AppLayout.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ComposerPage from './pages/ComposerPage.jsx'
import UsersPage from './pages/UsersPage.jsx'
import SkinCategoryPage from './pages/SkinCategoryPage.jsx'
import SkinCropPage from './pages/SkinCropPage.jsx'
import ButtonCategoryPage from './pages/ButtonCategoryPage.jsx'
import NotificationTemplatePage from './pages/NotificationTemplatePage.jsx'
import OtherImagesPage from './pages/OtherImagesPage.jsx'
import CountedImagesPage from './pages/CountedImagesPage.jsx'
import { getMe, heartbeat } from './services/apiClient.js'

export default function App() {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  })

  const [activeMenu, setActiveMenu] = useState('dashboard')
  const [checkingAuth, setCheckingAuth] = useState(Boolean(localStorage.getItem('access_token')))

  useEffect(() => {
    async function checkMe() {
      const token = localStorage.getItem('access_token')
      if (!token) {
        setCheckingAuth(false)
        return
      }

      try {
        const me = await getMe()
        localStorage.setItem('user', JSON.stringify(me))
        setUser(me)
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
        setUser(null)
      } finally {
        setCheckingAuth(false)
      }
    }

    checkMe()
  }, [])

  // Heartbeat to track online status
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    heartbeat() // send immediately
    const interval = setInterval(heartbeat, 120000) // every 2 minutes
    return () => clearInterval(interval)
  }, [])

  function handleLogin(data) {
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
    setActiveMenu('dashboard')
  }

  function handleLogout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    setUser(null)
    setActiveMenu('dashboard')
  }

  function renderPage() {
    switch (activeMenu) {
      case 'users':
        return <UsersPage />
      case 'compose-skin':
        return <ComposerPage />
      case 'skin-crop':
        return <SkinCropPage />
      case 'skin-categories':
        return <SkinCategoryPage />
      case 'button-categories':
        return <ButtonCategoryPage />
      case 'notification-categories':
        return <NotificationTemplatePage />
      case 'other-images':
        return <OtherImagesPage />
      case 'counted-images':
        return <CountedImagesPage />
      default:
        return <DashboardPage user={user} />
    }
  }

  if (checkingAuth) {
    return (
      <main className="auth-loading">
        <div className="loader-card">Đang kiểm tra đăng nhập...</div>
      </main>
    )
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <AppLayout
      user={user}
      activeMenu={activeMenu}
      onMenuChange={setActiveMenu}
      onLogout={handleLogout}
    >
      {renderPage()}
    </AppLayout>
  )
}
