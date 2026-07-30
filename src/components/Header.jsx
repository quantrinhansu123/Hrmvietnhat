import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const displayName = user?.name || user?.ho_va_ten || user?.username || 'Quản trị viên'
  const roleLabel = user?.role === 'admin' ? 'Quản trị viên' : (user?.role || 'Nhân viên')
  const initial = displayName.trim().charAt(0).toUpperCase() || 'A'

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

  const handleLogout = () => {
    setMenuOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="header">
      <div className="logo">
        <img src="/logo.png" alt="Việt Nhật IPT" />
        <div className="logo__text">
          <h1>Việt Nhật <span>IPT</span></h1>
          <small>Quản trị nhân sự</small>
        </div>
      </div>
      <div className="user-info">
        <i className="far fa-bell" aria-hidden="true"></i>
        <div className="account-menu" ref={menuRef}>
          <button
            type="button"
            className="account-menu__trigger"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="user-info__name">
              <strong>{displayName}</strong>
              <small>{roleLabel}</small>
            </span>
            <span className="user-info__avatar" aria-hidden="true">
              {initial}
            </span>
            <i className={`fas fa-chevron-${menuOpen ? 'up' : 'down'}`} aria-hidden="true"></i>
          </button>

          {menuOpen && (
            <div className="account-menu__dropdown" role="menu">
              <div className="account-menu__profile">
                <strong>{displayName}</strong>
                <small>{user?.email || roleLabel}</small>
              </div>
              <button type="button" role="menuitem" onClick={handleLogout}>
                <i className="fas fa-arrow-right-from-bracket" aria-hidden="true"></i>
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
