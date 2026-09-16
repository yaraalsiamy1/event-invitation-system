import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import AdminDashboard from './components/AdminDashboard';
import GuestPortal from './components/GuestPortal';
import './styles/apple.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('admin');
  const [events, setEvents] = useState([]);
  const [activeEventId, setActiveEventId] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [guests, setGuests] = useState([]);
  const [activeGuestId, setActiveGuestId] = useState(null);

  // Check if URL has ?guest= parameter for direct Guest Portal view
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const guestParam = params.get('guest');
    if (guestParam) {
      setActiveTab('guest');
      setActiveGuestId(guestParam);
    }
  }, []);

  // Refresh all events and active event data
  const refreshData = async (targetEventId) => {
    try {
      const resEvents = await fetch('/api/events');
      if (resEvents.ok) {
        const evs = await resEvents.json();
        const eventList = Array.isArray(evs) ? evs : [];
        setEvents(eventList);

        if (eventList.length > 0) {
          const activeEv = eventList.find(e => e.isActive) || eventList[0];
          const curId = targetEventId || activeEv.id;
          setActiveEventId(curId);

          // Fetch target event details & guests
          const resEv = await fetch(`/api/event?eventId=${curId}`);
          if (resEv.ok) {
            const ev = await resEv.json();
            if (ev) setEventData(ev);
          }

          const resGu = await fetch(`/api/guests?eventId=${curId}`);
          if (resGu.ok) {
            const gu = await resGu.json();
            if (Array.isArray(gu)) {
              setGuests(gu);
              if (gu.length > 0) setActiveGuestId(gu[0].id);
            }
          }
        } else {
          setActiveEventId(null);
          setEventData(null);
          setGuests([]);
        }
      }
    } catch (e) {
      console.error('Failed to load multi-event data from server', e);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Switch Active Event
  const handleSelectEvent = async (eventId) => {
    setActiveEventId(eventId);
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

  // Create New Event
  const handleCreateEvent = async (newEventData) => {
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEventData)
      });
      if (res.ok) {
        const created = await res.json();
        alert(`تم إنشاء المناسبة "${created.title}" بنجاح وحفظها في القائمة الجانبية!`);
        await handleSelectEvent(created.id);
      }
    } catch (e) {
      alert('حدث خطأ أثناء إضافة المناسبة الجديدة');
    }
  };

  // Delete Event
  const handleDeleteEvent = async (eventId, eventTitle) => {
    if (!window.confirm(`هل أنت تأكد من حذف المناسبة "${eventTitle}" وكافة مدعويها؟`)) return;
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        alert('تم حذف المناسبة بنجاح!');
        if (data.activeEventId) {
          await handleSelectEvent(data.activeEventId);
        } else {
          await refreshData();
        }
      } else {
        const err = await res.json();
        alert(err.error || 'تعذر حذف هذه المناسبة');
      }
    } catch (e) {
      alert('تعذر حذف المناسبة');
    }
  };

  // Update Current Active Event Details
  const updateEventDetails = async (newEv) => {
    const updated = { ...eventData, ...newEv };
    setEventData(updated);
    try {
      await fetch(`/api/event?eventId=${updated.id || activeEventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      refreshData(activeEventId);
    } catch (e) {}
  };

  // Update Current Active Guests List
  const updateGuestsList = async (newGuests) => {
    setGuests(newGuests);
  };

  return (
    <div class="apple-app-root">
      {/* Apple Light Navbar */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Container */}
      <main class="apple-container" style={{ paddingTop: '28px', paddingBottom: '60px' }}>
        {activeTab === 'admin' && (
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

        {activeTab === 'guest' && (
          <GuestPortal
            eventData={eventData}
            guests={guests}
            setGuests={updateGuestsList}
            activeGuestId={activeGuestId}
            setActiveGuestId={setActiveGuestId}
            refreshData={() => refreshData(activeEventId)}
          />
        )}
      </main>

      <footer style={{ borderTop: '1px solid var(--apple-border)', padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
        <div class="apple-container">
          نظام دعواتنا المتعدد للمناسبات وتأكيد الحضور تلقائياً عبر الواتساب &copy; 2026 — جاهز ومربوط بالنشر على Railway
        </div>
      </footer>
    </div>
  );
}
