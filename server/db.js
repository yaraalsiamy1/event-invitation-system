import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '../data_invitation.json');

// Default Events Data
const DEFAULT_EVENTS = [
  {
    id: "ev_wedding_1",
    title: "حفل زفاف عبدالمجيد و سارة",
    type: "wedding",
    date: "2026-10-25",
    time: "20:00",
    location: "قاعة الفخامة والمؤتمرات - الرياض",
    mapLink: "https://maps.google.com",
    cardImage: null,
    guests: [
      { id: "g_1", name: "عبدالله المحمد", phone: "966501234567", status: "accepted", ticketCode: "EV-897412", checkedIn: false },
      { id: "g_2", name: "خالد العتيبي", phone: "966559876543", status: "pending", ticketCode: "EV-654321", checkedIn: false },
      { id: "g_3", name: "فهد الدوسري", phone: "966541112233", status: "declined", ticketCode: "EV-112233", checkedIn: false },
      { id: "g_4", name: "د. سارة الشمري", phone: "966567778899", status: "accepted", ticketCode: "EV-778899", checkedIn: false }
    ]
  },
  {
    id: "ev_grad_2",
    title: "حفل تخرج د. نورة الشمري",
    type: "graduation",
    date: "2026-11-15",
    time: "19:00",
    location: "قاعة الريادة للمناسبات - جدة",
    mapLink: "https://maps.google.com",
    cardImage: null,
    guests: [
      { id: "g_201", name: "أثير العنزي", phone: "966551122334", status: "accepted", ticketCode: "EV-332211", checkedIn: false },
      { id: "g_202", name: "منيرة القحطاني", phone: "966549988776", status: "pending", ticketCode: "EV-998877", checkedIn: false }
    ]
  }
];

class MultiEventJSONDatabase {
  constructor() {
    this.init();
  }

  init() {
    if (!fs.existsSync(DB_FILE)) {
      const initialData = {
        activeEventId: DEFAULT_EVENTS[0].id,
        events: DEFAULT_EVENTS
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
      console.log('⚡ Multi-Event Lightweight JSON Database initialized at:', DB_FILE);
    } else {
      // Migrate old format to multi-event if needed
      const data = this.read();
      if (!data.events) {
        const legacyEvent = data.event || DEFAULT_EVENTS[0];
        const legacyGuests = data.guests || DEFAULT_EVENTS[0].guests;
        legacyEvent.guests = legacyGuests;
        legacyEvent.id = legacyEvent.id || "ev_main";
        
        const newData = {
          activeEventId: legacyEvent.id,
          events: [legacyEvent]
        };
        this.write(newData);
      }
    }
  }

  read() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.events) return parsed;
      }
    } catch (e) {}
    return { activeEventId: DEFAULT_EVENTS[0].id, events: DEFAULT_EVENTS };
  }

  write(data) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}
  }

  async getAllEvents() {
    const data = this.read();
    return (data.events || []).map(ev => {
      const guests = ev.guests || [];
      return {
        id: ev.id,
        title: ev.title,
        type: ev.type || 'wedding',
        date: ev.date,
        time: ev.time,
        location: ev.location,
        mapLink: ev.mapLink,
        cardImage: ev.cardImage,
        isActive: ev.id === data.activeEventId,
        totalGuests: guests.length,
        acceptedCount: guests.filter(g => g.status === 'accepted').length,
        declinedCount: guests.filter(g => g.status === 'declined').length,
        pendingCount: guests.filter(g => g.status === 'pending').length
      };
    });
  }

  async getActiveEventId() {
    const data = this.read();
    return data.activeEventId || (data.events[0] && data.events[0].id);
  }

  async setActiveEvent(eventId) {
    const data = this.read();
    if (data.events.some(e => e.id === eventId)) {
      data.activeEventId = eventId;
      this.write(data);
    }
    return data.activeEventId;
  }

  async getEvent(eventId) {
    const data = this.read();
    const targetId = eventId || data.activeEventId;
    return (data.events || []).find(e => e.id === targetId) || data.events[0] || DEFAULT_EVENTS[0];
  }

  async createEvent(newEvent) {
    const data = this.read();
    const created = {
      id: "ev_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      title: newEvent.title || "مناسبة جديدة",
      type: newEvent.type || "wedding",
      date: newEvent.date || new Date().toISOString().split('T')[0],
      time: newEvent.time || "20:00",
      location: newEvent.location || "القاعة الرئيسية",
      mapLink: newEvent.mapLink || "https://maps.google.com",
      cardImage: newEvent.cardImage || null,
      guests: []
    };
    data.events = [...(data.events || []), created];
    data.activeEventId = created.id;
    this.write(data);
    return created;
  }

  async updateEvent(eventId, updatedFields) {
    const data = this.read();
    const targetId = eventId || data.activeEventId;
    const evIndex = (data.events || []).findIndex(e => e.id === targetId);
    if (evIndex !== -1) {
      data.events[evIndex] = { ...data.events[evIndex], ...updatedFields };
      this.write(data);
      return data.events[evIndex];
    }
    return null;
  }

  async deleteEvent(eventId) {
    const data = this.read();
    if ((data.events || []).length <= 1) {
      throw new Error('لا يمكن حذف جميع المناسبات، يجب الاحتفاظ بمناسبة واحدة على الأقل');
    }
    data.events = (data.events || []).filter(e => e.id !== eventId);
    if (data.activeEventId === eventId) {
      data.activeEventId = data.events[0].id;
    }
    this.write(data);
    return data.activeEventId;
  }

  async getGuests(eventId) {
    const ev = await this.getEvent(eventId);
    return ev.guests || [];
  }

  async addGuests(eventId, newGuests) {
    const data = this.read();
    const targetId = eventId || data.activeEventId;
    const ev = (data.events || []).find(e => e.id === targetId);
    if (!ev) return [];

    const existing = ev.guests || [];
    const uniqueNew = [];

    (newGuests || []).forEach(g => {
      const gName = (g.name || '').trim().toLowerCase();
      const gPhone = (g.phone || '').trim();

      const isDup = existing.some(e => {
        const eName = (e.name || '').trim().toLowerCase();
        const ePhone = (e.phone || '').trim();
        return (gPhone && ePhone === gPhone) || (gName && eName === gName);
      }) || uniqueNew.some(u => {
        const uName = (u.name || '').trim().toLowerCase();
        const uPhone = (u.phone || '').trim();
        return (gPhone && uPhone === gPhone) || (gName && uName === gName);
      });

      if (!isDup) {
        uniqueNew.push({ ...g, eventId: targetId });
      }
    });

    ev.guests = [...existing, ...uniqueNew];
    this.write(data);
    return ev.guests;
  }

  async clearGuests(eventId) {
    const data = this.read();
    const targetId = eventId || data.activeEventId;
    const ev = (data.events || []).find(e => e.id === targetId);
    if (ev) {
      ev.guests = [];
      this.write(data);
    }
    return [];
  }

  async deleteGuest(eventId, guestId) {
    const data = this.read();
    const targetId = eventId || data.activeEventId;
    const ev = (data.events || []).find(e => e.id === targetId);
    if (ev) {
      ev.guests = (ev.guests || []).filter(g => g.id !== guestId);
      this.write(data);
    }
    return true;
  }

  async getGuestById(guestId) {
    const data = this.read();
    for (const ev of (data.events || [])) {
      const guest = (ev.guests || []).find(g => g.id === guestId);
      if (guest) {
        return { guest, event: ev };
      }
    }
    return null;
  }

  async updateGuestRSVP(guestId, status) {
    const data = this.read();
    for (const ev of (data.events || [])) {
      const guest = (ev.guests || []).find(g => g.id === guestId);
      if (guest) {
        guest.status = status;
        this.write(data);
        return { guest, event: ev };
      }
    }
    return null;
  }
}

export const db = new MultiEventJSONDatabase();
