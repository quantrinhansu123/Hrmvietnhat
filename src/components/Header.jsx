function Header() {
  return (
    <header className="header">
      <div className="logo">
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.1rem',
          fontWeight: 'bold',
          color: '#c8102e',
          letterSpacing: '-0.5px'
        }}>
          VN
        </div>
        <h1>Việt Nhật <span>IPT</span> Admin</h1>
      </div>
      <div className="user-info">
        <span>Admin</span>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#c8102e',
          fontWeight: 'bold'
        }}>
          A
        </div>
      </div>
    </header>
  )
}

export default Header
