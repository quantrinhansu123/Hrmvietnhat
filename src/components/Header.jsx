function Header() {
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
        <span className="user-info__name">
          <strong>Quản trị viên</strong>
          <small>Nhân viên</small>
        </span>
        <div className="user-info__avatar" aria-label="Tài khoản quản trị viên">
          A
        </div>
      </div>
    </header>
  )
}

export default Header
