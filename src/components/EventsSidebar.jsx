import React from 'react';
import { Calendar, Plus, Trash2, CheckCircle, Award, GraduationCap, Heart, Gift, FileText, Sparkles, ChevronRight } from 'lucide-react';

export default function EventsSidebar({ events = [], activeEventId, onSelectEvent, onOpenNewEventModal, onDeleteEvent }) {
  const getEventIcon = (type) => {
    switch (type) {
      case 'wedding': return <Heart size={18} style={{ color: '#e04870' }} />;
      case 'graduation': return <GraduationCap size={18} style={{ color: '#007aff' }} />;
      case 'birthday': return <Gift size={18} style={{ color: '#e58ea5' }} />;
      case 'honor': return <Award size={18} style={{ color: '#c59b27' }} />;
      case 'conference': return <FileText size={18} style={{ color: '#34c759' }} />;
      default: return <Sparkles size={18} style={{ color: 'var(--pink-primary)' }} />;
    }
  };

  return (
    <div class="apple-card" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Sidebar Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(244, 165, 186, 0.2)', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Calendar size={22} style={{ color: 'var(--pink-primary)' }} />
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>قائمة المناسبات</h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>إدارة وتبديل الدعوات</span>
          </div>
        </div>
        <span class="ios-badge ios-badge-pink">{events.length} مناسبة</span>
      </div>

      {/* Add New Event Button */}
      <button
        class="apple-btn apple-btn-pink"
        style={{ width: '100%', padding: '12px 16px', fontSize: '0.9rem', justifyContent: 'center' }}
        onClick={onOpenNewEventModal}
      >
        <Plus size={18} /> إنشاء مناسبة ودعوة جديدة
      </button>

      {/* Events List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1, maxHeight: '600px' }}>
        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            لا يوجد مناسبات أنشئت بعد. اضغط فوق لإنشاء أول مناسبة!
          </div>
        ) : (
          events.map(ev => {
            const isActive = ev.id === activeEventId;

            return (
              <div
                key={ev.id}
                onClick={() => onSelectEvent(ev.id)}
                style={{
                  padding: '14px 16px',
                  borderRadius: '16px',
                  border: isActive ? '2px solid var(--pink-primary)' : '1px solid rgba(0, 0, 0, 0.08)',
                  background: isActive ? 'var(--pink-light)' : '#ffffff',
                  boxShadow: isActive ? '0 4px 18px rgba(244, 165, 186, 0.25)' : '0 2px 6px rgba(0,0,0,0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getEventIcon(ev.type)}
                    <h3 style={{ fontSize: '0.94rem', fontWeight: isActive ? 800 : 600, color: 'var(--text-primary)' }}>
                      {ev.title}
                    </h3>
                  </div>

                  {isActive && (
                    <span class="ios-badge ios-badge-green" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                      نشط حالياً ✓
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <span>📅 {ev.date || 'بدون تاريخ'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span class="ios-badge ios-badge-gold" style={{ fontSize: '0.72rem' }}>
                      {ev.totalGuests || 0} مدعوين
                    </span>
                    {events.length > 1 && (
                      <button
                        title="حذف هذه المناسبة"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteEvent(ev.id, ev.title);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--system-red)',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
