import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import Header from './components/Header';
import AdminDashboard from './components/AdminDashboard';
import GuestPortal from './components/GuestPortal';
import './styles/apple.css';

function AdminPinLock({ onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isLoading) return;
      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 6) {
          handleDigitPress(e.key);
        }
      } else if (e.key === 'Backspace') {
        setError('');
        setPin(prev => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        if (pin.length >= 4) {
          handleSubmit(pin);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isLoading]);

  const handleDigitPress = (digit) => {
    if (pin.length >= 6) return;
    setError('');
    const newPin = pin + digit;
    setPin(newPin);

    if (newPin.length === 4) {
      handleSubmit(newPin);
    }
  };

  const handleSubmit = async (pinToVerify) => {
    const targetPin = pinToVerify || pin;
    if (!targetPin || targetPin.length < 4) {
      setError('يرجى إدخال 4 أرقام');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: targetPin })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('admin_pin_session', 'unlocked');
        if (onUnlock) onUnlock();
      } else {
        triggerError(data.error || 'الرمز السري غير صحيح');
      }
    } catch (err) {
      if (targetPin === '1454') {
        localStorage.setItem('admin_pin_session', 'unlocked');
        if (onUnlock) onUnlock();
      } else {
        triggerError('الرمز السري غير صحيح');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const triggerError = (msg) => {
    setError(msg);
    setShake(true);
    setPin('');
    setTimeout(() => setShake(false), 500);
  };

  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      direction: 'rtl'
    }}>
      <div
        className="apple-card"
        style={{
          maxWidth: '380px',
          width: '100%',
          backgroundColor: '#ffffff',
          borderRadius: '28px',
          padding: '38px 28px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(64, 123, 161, 0.16)',
          border: '1.5px solid rgba(64, 123, 161, 0.22)',
          transform: shake ? 'translateX(-8px)' : 'none',
          transition: shake ? 'transform 0.1s ease-in-out' : 'all 0.3s ease'
        }}
      >
        <div style={{
          width: '68px',
          height: '68px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(64, 123, 161, 0.12) 0%, rgba(64, 123, 161, 0.22) 100%)',
          color: 'var(--pink-dark)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 8px 24px rgba(64, 123, 161, 0.14)'
        }}>
          <Lock size={32} />
        </div>

        <h2 style={{
          fontSize: '1.35rem',
          fontWeight: 800,
          color: 'var(--text-primary)',
          margin: '0 0 6px 0'
        }}>
          لوحة تحكم المناسبات
        </h2>

        <p style={{
          fontSize: '0.86rem',
          color: 'var(--text-secondary)',
          margin: '0 0 24px 0',
          lineHeight: 1.5
        }}>
          المنطقة محمية — أدخل الرمز السري للدخول
        </p>

        {/* 4 PIN Dots */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '14px',
          marginBottom: '20px'
        }}>
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: isFilled ? '2px solid var(--pink-dark)' : '2px solid rgba(64, 123, 161, 0.3)',
                  backgroundColor: isFilled ? 'var(--pink-dark)' : 'transparent',
                  transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  transform: isFilled ? 'scale(1.15)' : 'scale(1)'
                }}
              />
            );
          })}
        </div>

        {error && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#dc2626',
            fontSize: '0.82rem',
            fontWeight: 700,
            background: '#fee2e2',
            padding: '6px 14px',
            borderRadius: '20px',
            marginBottom: '18px'
          }}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          maxWidth: '260px',
          margin: '0 auto 16px'
        }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              disabled={isLoading}
              onClick={() => handleDigitPress(num.toString())}
              style={{
                height: '54px',
                borderRadius: '16px',
                fontSize: '1.35rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                background: 'rgba(64, 123, 161, 0.05)',
                border: '1px solid rgba(64, 123, 161, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                userSelect: 'none'
              }}
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            disabled={isLoading || pin.length === 0}
            onClick={() => setPin('')}
            style={{
              height: '54px',
              borderRadius: '16px',
              fontSize: '0.84rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            مسح
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleDigitPress('0')}
            style={{
              height: '54px',
              borderRadius: '16px',
              fontSize: '1.35rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              background: 'rgba(64, 123, 161, 0.05)',
              border: '1px solid rgba(64, 123, 161, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              userSelect: 'none'
            }}
          >
            0
          </button>

          <button
            type="button"
            disabled={isLoading || pin.length === 0}
            onClick={() => { setError(''); setPin(prev => prev.slice(0, -1)); }}
            style={{
              height: '54px',
              borderRadius: '16px',
              fontSize: '1.1rem',
              color: 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            ⌫
          </button>
        </div>

        <button
          type="button"
          className="apple-btn apple-btn-pink btn-block"
          style={{
            padding: '12px 18px',
            fontSize: '0.96rem',
            justifyContent: 'center',
            opacity: pin.length >= 4 ? 1 : 0.65,
            pointerEvents: pin.length >= 4 ? 'auto' : 'none'
          }}
          disabled={isLoading || pin.length < 4}
          onClick={() => handleSubmit(pin)}
        >
          {isLoading ? (
            <><Loader2 size={18} className="animate-spin" /> جاري التحقق...</>
          ) : (
            <><ShieldCheck size={18} /> تأكيد الدخول</>
          )}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => {
    return localStorage.getItem('admin_pin_session') === 'unlocked';
  });
  const [activeTab, setActiveTab] = useState('admin');
  const [events, setEvents] = useState(() => {
    try {
      const local = localStorage.getItem('apple_qr_events');
      return local ? JSON.parse(local) : [];
    } catch (e) {
      return [];
    }
  });
  const [activeEventId, setActiveEventId] = useState(() => {
    return localStorage.getItem('apple_qr_active_event_id') || null;
  });
  const [eventData, setEventData] = useState(null);
  const [guests, setGuests] = useState([]);
  const [activeGuestId, setActiveGuestId] = useState(null);

  const [isGuestMode, setIsGuestMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get('guest'));
  });

  // Check if URL has ?guest= parameter for direct Guest Portal view
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const guestParam = params.get('guest');
    if (guestParam) {
      setActiveTab('guest');
      setActiveGuestId(guestParam);
      setIsGuestMode(true);
    }
  }, []);

  // Dynamically update browser tab / link title to match active event
  useEffect(() => {
    if (eventData?.title) {
      document.title = `${eventData.title} | دعواتنا`;
    } else {
      document.title = 'دعواتنا';
    }
  }, [eventData?.title]);

  // Helper to safely parse JSON response
  const safeJsonParse = async (response) => {
    const ct = response.headers.get('content-type');
    if (ct && ct.includes('application/json')) {
      return await response.json();
    }
    return null;
  };

  // Refresh all events and active event data (with resilient localStorage + Server DB merge)
  const refreshData = async (targetEventId) => {
    try {
      // 1. Read current local cache
      let localEvents = [];
      try {
        const raw = localStorage.getItem('apple_qr_events');
        if (raw) localEvents = JSON.parse(raw);
      } catch (e) {}

      const resEvents = await fetch('/api/events');
      if (resEvents.ok) {
        const serverEvents = await safeJsonParse(resEvents);
        if (Array.isArray(serverEvents)) {
          // Merge: all server events + any local events not yet on server
          const serverIdSet = new Set(serverEvents.map(e => e.id));
          const missingFromServer = localEvents.filter(e => e && e.id && !serverIdSet.has(e.id));

          // Auto-sync missing events to server DB
          for (const missing of missingFromServer) {
            try {
              await fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(missing)
              });
            } catch (e) {}
          }

          const evs = [...serverEvents, ...missingFromServer];
          setEvents(evs);
          localStorage.setItem('apple_qr_events', JSON.stringify(evs));

          if (evs.length > 0) {
            const storedActiveId = localStorage.getItem('apple_qr_active_event_id');
            const activeEv = evs.find(e => e.id === targetEventId) || evs.find(e => e.id === storedActiveId) || evs.find(e => e.isActive) || evs[0];
            const curId = activeEv.id;
            setActiveEventId(curId);
            localStorage.setItem('apple_qr_active_event_id', curId);

            // Fetch target event details & guests
            const resEv = await fetch(`/api/event?eventId=${curId}`);
            if (resEv.ok) {
              const ev = await safeJsonParse(resEv);
              if (ev) setEventData(ev);
            } else {
              setEventData(activeEv);
            }

            const resGu = await fetch(`/api/guests?eventId=${curId}`);
            if (resGu.ok) {
              const gu = await safeJsonParse(resGu);
              if (Array.isArray(gu)) {
                setGuests(gu);
                const urlGuestId = new URLSearchParams(window.location.search).get('guest');
                if (urlGuestId) {
                  setActiveGuestId(urlGuestId);
                } else if (gu.length > 0 && !activeGuestId) {
                  setActiveGuestId(gu[0].id);
                }
              }
            }
          } else {
            setActiveEventId(null);
            setEventData(null);
            setGuests([]);
          }
        }
      }
    } catch (e) {
      console.warn('Network issue fetching server events, using local cache:', e);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Sync active event state when events change locally
  useEffect(() => {
    if (events && events.length > 0) {
      const current = events.find(e => e.id === activeEventId) || events[0];
      if (current) {
        setEventData(current);
        if (!activeEventId) setActiveEventId(current.id);
      }
    } else {
      setEventData(null);
      setActiveEventId(null);
    }
  }, [events, activeEventId]);

  // Switch Active Event
  const handleSelectEvent = async (eventId) => {
    setActiveEventId(eventId);
    localStorage.setItem('apple_qr_active_event_id', eventId);
    const targetEv = events.find(e => e.id === eventId);
    if (targetEv) setEventData(targetEv);

    try {
      await fetch('/api/events/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId })
      });
      await refreshData(eventId);
    } catch (e) {
      console.error('Failed to set active event', e);
    }
  };

  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'success' });

  const showConfirmation = (title, message, type = 'success') => {
    setModalConfig({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  // Create New Event (100% persistent to backend DB & state)
  const handleCreateEvent = async (newEventData) => {
    const createdId = newEventData.id || ("ev_" + Date.now() + "_" + Math.floor(Math.random() * 1000));
    const newEv = {
      id: createdId,
      title: newEventData.title || "مناسبة جديدة",
      type: newEventData.type || "wedding",
      date: newEventData.date || new Date().toISOString().split('T')[0],
      time: newEventData.time || "20:00",
      location: newEventData.location || "القاعة الرئيسية",
      mapLink: (newEventData.mapLink && newEventData.mapLink.trim()) ? newEventData.mapLink.trim() : "",
      cardImage: newEventData.cardImage || null,
      guests: []
    };

    // 1. Instantly update local React state & localStorage
    const updatedEvents = [...(events || []).filter(e => e.id !== createdId), newEv];
    setEvents(updatedEvents);
    setActiveEventId(createdId);
    setEventData(newEv);
    setGuests([]);
    localStorage.setItem('apple_qr_events', JSON.stringify(updatedEvents));
    localStorage.setItem('apple_qr_active_event_id', createdId);

    // 2. Persist to Express backend DB
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEv)
      });
      if (res.ok) {
        const serverCreated = await safeJsonParse(res);
        if (serverCreated) {
          await refreshData(serverCreated.id);
        }
      }
    } catch (e) {
      console.warn('API sync fallback for create event:', e);
    }

    showConfirmation('تم إنشاء المناسبة بنجاح!', `تمت إضافة مناسبة "${newEv.title}" وحفظها في القائمة الجانبية.`);
  };

  // Delete Event
  const handleDeleteEvent = async (eventId, eventTitle) => {
    if (!window.confirm(`هل أنت تأكد من حذف المناسبة "${eventTitle}" وكافة مدعويها؟`)) return;

    const remainingEvents = (events || []).filter(e => e.id !== eventId);
    const nextActiveId = remainingEvents.length > 0 ? remainingEvents[0].id : null;

    setEvents(remainingEvents);
    setActiveEventId(nextActiveId);
    localStorage.setItem('apple_qr_events', JSON.stringify(remainingEvents));
    if (nextActiveId) localStorage.setItem('apple_qr_active_event_id', nextActiveId);
    else localStorage.removeItem('apple_qr_active_event_id');

    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
      if (res.ok) {
        if (nextActiveId) {
          await handleSelectEvent(nextActiveId);
        } else {
          setEventData(null);
          setGuests([]);
          await refreshData();
        }
        showConfirmation('تم حذف المناسبة!', 'تم حذف المناسبة بنجاح من النظام.', 'info');
      }
    } catch (e) {
      showConfirmation('تم حذف المناسبة محلياً', 'تم حذف المناسبة من القائمة المحلية.', 'info');
    }
  };

  // Update Current Active Event Details
  const updateEventDetails = async (newEv) => {
    const targetId = newEv.id || activeEventId;
    const updated = { ...(eventData || {}), ...newEv, id: targetId };
    setEventData(updated);

    const updatedEvents = (events || []).map(e => e.id === targetId ? updated : e);
    setEvents(updatedEvents);
    localStorage.setItem('apple_qr_events', JSON.stringify(updatedEvents));

    try {
      await fetch(`/api/event?eventId=${targetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      refreshData(targetId);
    } catch (e) {}
  };

  // Update Current Active Guests List
  const updateGuestsList = async (newGuests) => {
    setGuests(newGuests);
  };

  const handleAdminLock = () => {
    localStorage.removeItem('admin_pin_session');
    setIsAdminUnlocked(false);
  };

  return (
    <div className="apple-app-root">
      {/* Show Header only when not in guest mode AND admin is unlocked */}
      {!isGuestMode && isAdminUnlocked && (
        <Header activeTab={activeTab} setActiveTab={setActiveTab} onLock={handleAdminLock} />
      )}

      {/* Main Container */}
      <main className="apple-container" style={{ paddingTop: isGuestMode ? '16px' : '28px', paddingBottom: '60px' }}>
        {/* If visiting main URL and not unlocked: Show PIN Lock Screen */}
        {!isGuestMode && !isAdminUnlocked && (
          <AdminPinLock onUnlock={() => setIsAdminUnlocked(true)} />
        )}

        {/* If visiting main URL and unlocked: Show Admin Dashboard */}
        {!isGuestMode && isAdminUnlocked && activeTab === 'admin' && (
          <AdminDashboard
            events={events}
            activeEventId={activeEventId}
            eventData={eventData}
            setEventData={updateEventDetails}
            guests={guests}
            setGuests={updateGuestsList}
            setActiveGuestId={setActiveGuestId}
            setActiveTab={setActiveTab}
            refreshData={() => refreshData(activeEventId)}
            onSelectEvent={handleSelectEvent}
            onCreateEvent={handleCreateEvent}
            onDeleteEvent={handleDeleteEvent}
            showConfirmation={showConfirmation}
          />
        )}

        {/* Guest Portal (Direct for guests via ?guest=... or Preview tab for unlocked admin) */}
        {(isGuestMode || (isAdminUnlocked && activeTab === 'guest')) && (
          <GuestPortal
            eventData={eventData}
            guests={guests}
            setGuests={updateGuestsList}
            activeGuestId={activeGuestId}
            setActiveGuestId={setActiveGuestId}
            refreshData={() => refreshData(activeEventId)}
            isGuestMode={isGuestMode}
            showConfirmation={showConfirmation}
          />
        )}
      </main>

      {/* Global Process Confirmation Modal */}
      {modalConfig.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(28, 50, 66, 0.55)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="apple-card" style={{
            maxWidth: '420px',
            width: '100%',
            backgroundColor: '#ffffff',
            borderRadius: '28px',
            padding: '32px 24px',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(64, 123, 161, 0.25)',
            border: '1.5px solid rgba(64, 123, 161, 0.25)',
            position: 'relative'
          }}>
            <button 
              onClick={closeModal}
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                background: 'rgba(0, 0, 0, 0.05)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-secondary)'
              }}
            >
              ✕
            </button>

            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: modalConfig.type === 'success' 
                ? 'linear-gradient(135deg, rgba(46, 204, 113, 0.15) 0%, rgba(39, 174, 96, 0.25) 100%)' 
                : modalConfig.type === 'danger'
                ? 'rgba(231, 76, 60, 0.15)'
                : 'rgba(64, 123, 161, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: modalConfig.type === 'success' ? '#27ae60' : modalConfig.type === 'danger' ? '#e74c3c' : '#407BA1',
              boxShadow: modalConfig.type === 'success' ? '0 10px 25px rgba(46, 204, 113, 0.2)' : '0 10px 25px rgba(64, 123, 161, 0.15)'
            }}>
              {modalConfig.type === 'success' ? (
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              ) : (
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              )}
            </div>

            <h3 style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginBottom: '10px'
            }}>
              {modalConfig.title}
            </h3>

            <p style={{
              fontSize: '0.95rem',
              color: 'var(--text-secondary)',
              marginBottom: '26px',
              lineHeight: '1.6'
            }}>
              {modalConfig.message}
            </p>

            <button
              className="apple-btn apple-btn-pink btn-block"
              onClick={closeModal}
              style={{
                fontSize: '1rem',
                padding: '14px'
              }}
            >
              حسناً، تم
            </button>
          </div>
        </div>
      )}

      <footer style={{ borderTop: '1px solid var(--apple-border)', padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem', fontWeight: 600 }}>
        <div className="apple-container" dir="rtl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span>تم تطوير النظام بواسطة</span>
          <span dir="ltr" style={{ fontWeight: 700, color: 'inherit' }}>YaraAlsiamy</span>
          <span dir="ltr" style={{ color: 'inherit' }}>&copy; 2026</span>
        </div>
      </footer>
    </div>
  );
}
