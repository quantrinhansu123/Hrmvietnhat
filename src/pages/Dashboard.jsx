import { Link } from 'react-router-dom'
import './Dashboard.css'

const menuItems = [
  { path: '/employees', icon: 'fas fa-users', label: 'Hồ sơ nhân sự', color: 'var(--primary)' },
  { path: '/recruitment', icon: 'fas fa-user-plus', label: 'Tuyển dụng', color: 'var(--primary-700)' },
  { path: '/salary', icon: 'fas fa-money-bill-wave', label: 'Lương & Phúc lợi', color: 'var(--primary-500)' },
  { path: '/competency', icon: 'fas fa-chart-line', label: 'Khung năng lực', color: 'var(--primary-800)' },
  { path: '/kpi', icon: 'fas fa-bullseye', label: 'KPI', color: 'var(--primary-600)' },
  { path: '/tasks', icon: 'fas fa-tasks', label: 'Công việc', color: 'var(--primary-900)' },
  { path: '/approvals', icon: 'fas fa-stamp', label: 'Đề xuất', color: 'var(--primary-400)' },
  { path: '/attendance', icon: 'fas fa-clock', label: 'Chấm công', color: 'var(--primary-700)' }
]

function Dashboard() {
  const step = 360 / menuItems.length

  return (
    <section className="dashboard-menu">
      <div className="dashboard-menu__heading">
        <p>HỆ THỐNG QUẢN TRỊ NHÂN SỰ</p>
        <h1>Chọn chức năng để bắt đầu</h1>
      </div>

      <div className="orbit-stage" aria-label="Menu chức năng">
        <div className="orbit-ring orbit-ring--outer" aria-hidden="true"></div>
        <div className="orbit-ring orbit-ring--inner" aria-hidden="true"></div>

        <div className="orbit-center">
          <span className="orbit-center__halo" aria-hidden="true"></span>
          <img src="/logo.png" alt="Việt Nhật IPT" />
        </div>

        <div className="orbit-menu">
          {menuItems.map((item, index) => {
            const angle = step * index

            return (
              <div
                className="orbit-node"
                key={item.path}
                style={{
                  '--angle': `${angle}deg`,
                  '--counter-angle': `${-angle}deg`
                }}
              >
                <div className="orbit-counter">
                  <Link
                    className="orbit-link"
                    to={item.path}
                    style={{ '--item-color': item.color }}
                    aria-label={item.label}
                  >
                    <span className="orbit-link__icon">
                      <i className={item.icon}></i>
                    </span>
                    <span className="orbit-link__label">{item.label}</span>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="dashboard-menu__hint">
        <i className="fas fa-mouse-pointer"></i>
        Di chuột vào biểu tượng để dừng vòng quay
      </p>
    </section>
  )
}

export default Dashboard
