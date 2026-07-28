import { Link } from 'react-router-dom'
import './Dashboard.css'

const menuItems = [
  { path: '/employees', icon: 'fas fa-users', label: 'Hồ sơ nhân sự', color: '#e11d48' },
  { path: '/recruitment', icon: 'fas fa-user-plus', label: 'Tuyển dụng', color: '#f97316' },
  { path: '/salary', icon: 'fas fa-money-bill-wave', label: 'Lương & Phúc lợi', color: '#16a34a' },
  { path: '/competency', icon: 'fas fa-chart-line', label: 'Khung năng lực', color: '#0891b2' },
  { path: '/kpi', icon: 'fas fa-bullseye', label: 'KPI', color: '#7c3aed' },
  { path: '/tasks', icon: 'fas fa-tasks', label: 'Công việc', color: '#2563eb' },
  { path: '/approvals', icon: 'fas fa-stamp', label: 'Đề xuất', color: '#db2777' },
  { path: '/attendance', icon: 'fas fa-clock', label: 'Chấm công', color: '#0f766e' }
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
