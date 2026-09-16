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
  const [activeTab, setActiveTab] = useState('admin'); // 'admin', 'guest'
  const [eventData, setEventData] = useState(() => {
    return JSON.parse(localStorage.getItem('apple_qr_event_data')) || DEFAULT_EVENT;
  });
  const [guests, setGuests] = useState(() => {
    return JSON.parse(localStorage.getItem('apple_qr_guests')) || DEFAULT_GUESTS;
  });
  const [activeGuestId, setActiveGuestId] = useState(guests[0]?.id || null);

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem('apple_qr_event_data', JSON.stringify(eventData));
    localStorage.setItem('apple_qr_guests', JSON.stringify(guests));
  }, [eventData, guests]);

  return (
    <div class="apple-app-root">
      {/* Apple Light Frosted Navbar */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main View Container */}
      <main class="apple-container" style={{ paddingTop: '28px', paddingBottom: '60px' }}>
        {activeTab === 'admin' && (
          <AdminDashboard
            eventData={eventData}
            setEventData={setEventData}
            guests={guests}
            setGuests={setGuests}
            setActiveGuestId={setActiveGuestId}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'guest' && (
          <GuestPortal
            eventData={eventData}
            guests={guests}
            setGuests={setGuests}
            activeGuestId={activeGuestId}
            setActiveGuestId={setActiveGuestId}
          />
        )}
      </main>

      <footer style={{ borderTop: '1px solid var(--apple-border)', padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
        <div class="apple-container">
          نظام إرسال وتأكيد دعوات المناسبات وتوليد باركودات الـ QR &copy; 2026 — مصمم بالثيم الفاتح بلغة أبل iOS / macOS HIG
        </div>
      </footer>
    </div>
  );
}
