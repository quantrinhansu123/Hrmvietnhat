const TASKS_EXTERNAL_URL = 'https://quan-ly-nhan-su-gamma.vercel.app/quan-ly-cong-viec/danh-sach-task'

function Tasks() {
  const openExternal = () => {
    window.open(TASKS_EXTERNAL_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="tasks-external">
      <div className="tasks-external__header">
        <div>
          <p className="tasks-external__eyebrow">Quản lý công việc</p>
          <h1>Danh sách Task</h1>
          <span>View bảng từ hệ thống IT Việt Nhật · nhấn để mở tab mới</span>
        </div>
        <button type="button" className="btn btn-primary" onClick={openExternal}>
          <i className="fas fa-arrow-up-right-from-square"></i>
          Mở tab mới
        </button>
      </div>

      <div className="tasks-external__frame-wrap">
        <div className="tasks-external__toolbar" aria-hidden="true">
          <span>Dự án</span>
          <span>Công việc</span>
          <span>Người thực hiện</span>
          <span>Mức độ ưu tiên</span>
          <span>Trạng thái</span>
          <span className="is-accent">Task trễ hạn</span>
          <strong>Thêm mới</strong>
        </div>

        <iframe
          className="tasks-external__frame"
          src={TASKS_EXTERNAL_URL}
          title="Danh sách Task - IT Việt Nhật"
          loading="lazy"
          referrerPolicy="no-referrer"
        />

        <button
          type="button"
          className="tasks-external__overlay"
          onClick={openExternal}
          title="Nhấn để mở danh sách Task ở tab mới"
        >
          <span className="tasks-external__overlay-card">
            <i className="fas fa-table-list"></i>
            <strong>Xem bảng danh sách Task</strong>
            <p>Nhấn để mở đầy đủ tại hệ thống quản lý công việc</p>
            <em>{TASKS_EXTERNAL_URL.replace('https://', '')}</em>
          </span>
        </button>
      </div>
    </div>
  )
}

export default Tasks
