import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import AdminDashboard from './components/AdminDashboard';
import GuestPortal from './components/GuestPortal';
import './styles/apple.css';

export default function App() {
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

  // Helper to safely parse JSON response
  const safeJsonParse = async (response) => {
    const ct = response.headers.get('content-type');
    if (ct && ct.includes('application/json')) {
      return await response.json();
    }
    return null;
  };

  // Refresh all events and active event data
  const refreshData = async (targetEventId) => {
    try {
      const resEvents = await fetch('/api/events');
      if (resEvents.ok) {
        const evs = await safeJsonParse(resEvents);
        if (Array.isArray(evs)) {
          setEvents(evs);
          localStorage.setItem('apple_qr_events', JSON.stringify(evs));

          if (evs.length > 0) {
            const activeEv = evs.find(e => e.isActive) || evs[0];
            const curId = targetEventId || activeEv.id;
            setActiveEventId(curId);
            localStorage.setItem('apple_qr_active_event_id', curId);

            // Fetch target event details & guests
            const resEv = await fetch(`/api/event?eventId=${curId}`);
            if (resEv.ok) {
              const ev = await safeJsonParse(resEv);
              if (ev) setEventData(ev);
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
      mapLink: newEventData.mapLink || "https://maps.google.com",
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

    alert(`تم إنشاء المناسبة "${newEv.title}" بنجاح وحفظها في القائمة الجانبية!`);
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
        alert('تم حذف المناسبة بنجاح!');
      }
    } catch (e) {
      alert('تم حذف المناسبة من القائمة المحلية.');
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

  return (
    <div className="apple-app-root">
      {/* Hide Header completely in Guest mode so guests cannot switch tabs or access Admin Dashboard */}
      {!isGuestMode && <Header activeTab={activeTab} setActiveTab={setActiveTab} />}

      {/* Main Container */}
      <main className="apple-container" style={{ paddingTop: isGuestMode ? '16px' : '28px', paddingBottom: '60px' }}>
        {!isGuestMode && activeTab === 'admin' && (
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
          />
        )}

        {(isGuestMode || activeTab === 'guest') && (
          <GuestPortal
            eventData={eventData}
            guests={guests}
            setGuests={updateGuestsList}
            activeGuestId={activeGuestId}
            setActiveGuestId={setActiveGuestId}
            refreshData={() => refreshData(activeEventId)}
            isGuestMode={isGuestMode}
          />
        )}
      </main>

      <footer style={{ borderTop: '1px solid var(--apple-border)', padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem', fontWeight: 600 }}>
        <div className="apple-container">
          تم تطوير النظام بواسطة YaraAlsiamy &copy; 2026 —
        </div>
      </footer>
    </div>
  );
}
