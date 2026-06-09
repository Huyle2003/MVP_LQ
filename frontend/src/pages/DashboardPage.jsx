export default function DashboardPage({ user }) {
  return (
    <div className="page-section">
      <div className="page-header">
        <div>
          <h2>Trang chủ</h2>
          <p>Xin chào, {user?.email}. Đây là dashboard quản trị MVP.</p>
        </div>
      </div>
    </div>
  )
}
