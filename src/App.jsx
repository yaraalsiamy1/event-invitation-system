import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import AdminDashboard from './components/AdminDashboard';
import GuestPortal from './components/GuestPortal';
import './styles/apple.css';

const DEFAULT_EVENT = {
  title: "حفل زفاف عبدالمجيد و سارة",
  date: "2026-10-25",
  time: "20:00",
  location: "قاعة الفخامة والمؤتمرات - الرياض",
  mapLink: "https://maps.google.com",
  cardImage: null
};

const DEFAULT_GUESTS = [
  { id: "g_1", name: "عبدالله المحمد", phone: "966501234567", status: "accepted", companions: 2, ticketCode: "EV-897412", checkedIn: false, checkInTime: null },
  { id: "g_2", name: "خالد العتيبي", phone: "966559876543", status: "pending", companions: 1, ticketCode: "EV-654321", checkedIn: false, checkInTime: null },
  { id: "g_3", name: "فهد الدوسري", phone: "966541112233", status: "declined", companions: 1, ticketCode: "EV-112233", checkedIn: false, checkInTime: null },
  { id: "g_4", name: "د. سارة الشمري", phone: "966567778899", status: "accepted", companions: 3, ticketCode: "EV-778899", checkedIn: false, checkInTime: null }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('admin');
  const [eventData, setEventData] = useState(DEFAULT_EVENT);
  const [guests, setGuests] = useState(DEFAULT_GUESTS);
  const [activeGuestId, setActiveGuestId] = useState(DEFAULT_GUESTS[0].id);

  // Fetch initial data from API
  const refreshData = async () => {
    try {
      const resEv = await fetch('/api/event');
      if (resEv.ok) {
        const ev = await resEv.json();
        if (ev && ev.title) setEventData(ev);
      }

      const resGu = await fetch('/api/guests');
      if (resGu.ok) {
        const gu = await resGu.json();
        if (Array.isArray(gu)) {
          setGuests(gu);
          if (gu.length > 0 && !activeGuestId) setActiveGuestId(gu[0].id);
        }
      }
    } catch (e) {
      // Fallback to localStorage offline
      const localEv = JSON.parse(localStorage.getItem('apple_qr_event_data'));
      const localGu = JSON.parse(localStorage.getItem('apple_qr_guests'));
      if (localEv) setEventData(localEv);
      if (localGu) setGuests(localGu);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Save changes to API / LocalStorage
  const updateEventDetails = async (newEv) => {
    setEventData(newEv);
    localStorage.setItem('apple_qr_event_data', JSON.stringify(newEv));
    try {
      await fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEv)
      });
    } catch (e) {}
  };

  const updateGuestsList = async (newGuests) => {
    setGuests(newGuests);
    localStorage.setItem('apple_qr_guests', JSON.stringify(newGuests));
  };

  return (
    <div class="apple-app-root">
      {/* Apple Light Navbar */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Container */}
      <main class="apple-container" style={{ paddingTop: '28px', paddingBottom: '60px' }}>
        {activeTab === 'admin' && (
          <AdminDashboard
            eventData={eventData}
            setEventData={updateEventDetails}
            guests={guests}
            setGuests={updateGuestsList}
            setActiveGuestId={setActiveGuestId}
            setActiveTab={setActiveTab}
            refreshData={refreshData}
          />
        )}

        {activeTab === 'guest' && (
          <GuestPortal
            eventData={eventData}
            guests={guests}
            setGuests={updateGuestsList}
            activeGuestId={activeGuestId}
            setActiveGuestId={setActiveGuestId}
            refreshData={refreshData}
          />
        )}
      </main>

      <footer style={{ borderTop: '1px solid var(--apple-border)', padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
        <div class="apple-container">
          نظام إرسال وتأكيد دعوات المناسبات وتوليد باركودات الـ QR &copy; 2026 — جاهز ومربوط بالنشر على Railway
        </div>
      </footer>
    </div>
  );
}
