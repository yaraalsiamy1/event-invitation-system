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
            <h1 class="brand-title">دعواتنا <span>| Apple Event Pass</span></h1>
          </div>
        </div>

        {/* iOS Segmented Control Tabs */}
        <nav class="ios-segmented-control">
          <button
            class={`segment-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            <LayoutDashboard size={16} />
            <span>لوحة التحكم واستيراد الإكسل</span>
          </button>
          
          <button
            class={`segment-btn ${activeTab === 'guest' ? 'active' : ''}`}
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
