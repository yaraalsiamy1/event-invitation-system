import React from 'react';
import { Mail, LayoutDashboard, Ticket, QrCode } from 'lucide-react';

export default function Header({ activeTab, setActiveTab }) {
  return (
    <header class="apple-navbar">
      <div class="apple-container nav-wrapper">
        <div class="apple-brand">
          <div class="brand-icon-box">
            <Mail size={24} />
          </div>
          <div class="brand-text">
            <h1 class="brand-title">دعواتنا <span>| Apple Event Pass</span></h1>
          </div>
        </div>

        {/* iOS Segmented Control Nav */}
        <nav class="ios-segmented-control">
          <button
            class={`segment-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            <LayoutDashboard size={16} />
            <span>لوحة التحكم والمدعوين</span>
          </button>
          
          <button
            class={`segment-btn ${activeTab === 'guest' ? 'active' : ''}`}
            onClick={() => setActiveTab('guest')}
          >
            <Ticket size={16} />
            <span>معاينة واجهة الضيف</span>
          </button>

          <button
            class={`segment-btn ${activeTab === 'gate' ? 'active' : ''}`}
            onClick={() => setActiveTab('gate')}
          >
            <QrCode size={16} />
            <span>ماسح البوابة (Check-in)</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
