import React from 'react';
import { Mail, LayoutDashboard, Ticket } from 'lucide-react';

export default function Header({ activeTab, setActiveTab }) {
  return (
    <header class="apple-navbar">
      <div class="apple-container nav-wrapper">
        <div class="apple-brand">
          <div class="brand-icon-box">
            <Mail size={22} />
          </div>
          <div class="brand-text">
            <h1 class="brand-title">دعواتنا</h1>
          </div>
        </div>

        {/* iOS Segmented Control Tabs */}
        <nav className="ios-segmented-control">
          <button
            className={`segment-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            <LayoutDashboard size={16} />
            <span>لوحة التحكم</span>
          </button>

          <button
            className={`segment-btn ${activeTab === 'guest' ? 'active' : ''}`}
            onClick={() => setActiveTab('guest')}
          >
            <Ticket size={16} />
            <span>معاينة واجهة الضيف</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
