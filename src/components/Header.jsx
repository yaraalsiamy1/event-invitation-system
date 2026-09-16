import React from 'react';
import { Mail, LayoutDashboard, Ticket } from 'lucide-react';

export default function Header({ activeTab, setActiveTab }) {
  return (
    <header className="apple-navbar">
      <div className="apple-container nav-wrapper">
        <div className="apple-brand">
          <div className="brand-icon-box">
            <Mail size={22} />
          </div>
          <div className="brand-text">
            <h1 className="brand-title">دعواتنا <span>| Invitation</span></h1>
          </div>
        </div>

        {/* iOS Segmented Control Tabs */}
        <nav className="ios-segmented-control">
          <button
            className={`segment-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            <LayoutDashboard size={16} />
            <span>لوحة التحكم واستيراد الإكسل</span>
          </button>
          
          <button
            className={`segment-btn ${activeTab === 'guest' ? 'active' : ''}`}
            onClick={() => setActiveTab('guest')}
          >
            <Ticket size={16} />
            <span>معاينة واجهة الضيف وتذكرة الـ QR</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
