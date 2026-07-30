import { Link, useLocation } from 'react-router-dom'

function Sidebar() {
  const location = useLocation()

  const menuItems = [
    { path: '/dashboard', icon: 'fa-house', label: 'Tổng quan' },
    { path: '/employees', icon: 'fa-id-card', label: 'Hồ sơ nhân sự' },
    { path: '/recruitment', icon: 'fa-user-plus', label: 'Tuyển dụng' },
    { path: '/salary', icon: 'fa-wallet', label: 'Lương & Phúc lợi' },
    { path: '/competency', icon: 'fa-diagram-project', label: 'Khung năng lực' },
    { path: '/kpi', icon: 'fa-chart-pie', label: 'KPI' },
    { path: '/tasks', icon: 'fa-list-check', label: 'Công việc' },
    { path: '/approvals', icon: 'fa-file-signature', label: 'Đề xuất' },
    { path: '/attendance', icon: 'fa-business-time', label: 'Chấm công' }
  ]

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand__icon" aria-hidden="true">
          <i className="fa-solid fa-briefcase"></i>
        </span>
        <span>HR Manager</span>
      </div>

      <nav className="sidebar__nav" aria-label="Menu chính">
        {menuItems.map(item => {
          const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${active ? 'active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="nav-item__icon" aria-hidden="true">
                <i className={`fa-solid ${item.icon}`}></i>
              </span>
              <span className="nav-item__label">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

export default Sidebar
