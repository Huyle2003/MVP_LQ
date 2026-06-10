import {
  Home,
  Image,
  Crop,
  Images,
  MousePointerClick,
  Bell,
  CopyPlus,
  ListOrdered,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'


export default function DashboardPage({ user, onMenuChange }) {
  return (
    <div className="page-section">
      {/* Welcome card */}
      <div className="dashboard-welcome">
        <div className="dashboard-welcome-icon">
          <Home size={32} />
        </div>
        <div>
          <h2>Xin chào, {user?.email?.split('@')[0] || 'bạn'}!</h2>
          <p>Chào mừng bạn đến với Image Composer Tool.</p>
        </div>
      </div>


      {/* Contact */}
      <div className="dashboard-contact">
        <ExternalLink size={18} />
        <span>
          Mọi thắc mắc vui lòng liên hệ với chúng tôi{' '}
          <a
            href="https://web.facebook.com/people/L%C3%AA-%C4%90%C4%83ng-Huy/pfbid02Tzeoyrwtqua1gE236hojsdZ3ytki2hM2nQ4dkHY2Ujvmz6Zr8ze91SHXpQNQdGBAl/"
            target="_blank"
            rel="noopener noreferrer"
            className="dashboard-contact-link"
          >
            tại đây
          </a>
          .
        </span>
      </div>
    </div>
  )
}
