import React from 'react';
import { Mail, LayoutDashboard, Ticket, Lock } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, onLock }) {
  return (
    <header className="apple-navbar">
      <div className="apple-container nav-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="apple-brand">
          <div className="brand-icon-box">
            <Mail size={16} />
          </div>
          <div className="brand-text">
            <h1 className="brand-title">دعواتنا</h1>
          </div>
        </div>

        {/* iOS Segmented Control Tabs & Quick Lock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <nav className="ios-segmented-control">
            <button
              className={`segment-btn ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              <LayoutDashboard size={14} />
              <span>لوحة التحكم</span>
            </button>

            <button
              className={`segment-btn ${activeTab === 'guest' ? 'active' : ''}`}
              onClick={() => setActiveTab('guest')}
            >
              <Ticket size={14} />
              <span>معاينة واجهة الضيف</span>
            </button>
          </nav>

          {onLock && (
            <button
              type="button"
              className="apple-btn apple-btn-secondary"
              onClick={onLock}
              title="قفل لوحة التحكم"
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                borderRadius: '50px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                color: 'var(--text-secondary)'
              }}
            >
              <Lock size={13} />
              <span>قفل</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
