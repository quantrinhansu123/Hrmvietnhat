import { Link, useLocation } from 'react-router-dom'

function Sidebar() {
  const location = useLocation()

  const menuItems = [
    { path: '/dashboard', icon: 'fas fa-home', label: 'Tổng quan' },
    { path: '/employees', icon: 'fas fa-users', label: 'Hồ sơ nhân sự' },
    { path: '/recruitment', icon: 'fas fa-user-plus', label: 'Tuyển dụng' },
    { path: '/salary', icon: 'fas fa-money-bill-wave', label: 'Lương & Phúc lợi' },
    { path: '/competency', icon: 'fas fa-chart-line', label: 'Khung năng lực' },
    { path: '/kpi', icon: 'fas fa-bullseye', label: 'KPI' },
    { path: '/tasks', icon: 'fas fa-tasks', label: 'Công việc' },
    { path: '/approvals', icon: 'fas fa-stamp', label: 'Đề xuất' },
    { path: '/attendance', icon: 'fas fa-clock', label: 'Chấm công' }
  ]

  return (
    <aside className="sidebar">
      <div className="brand">
        <i className="fas fa-layer-group"></i>
        <span>HR Manager</span>
      </div>

      {menuItems.map(item => (
        <Link
          key={item.path}
          to={item.path}
          className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
        >
          <i className={item.icon}></i>
          <span>{item.label}</span>
        </Link>
      ))}
    </aside>
  )
}

export default Sidebar
