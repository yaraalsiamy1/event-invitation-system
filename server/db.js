import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '../data_invitation.json');

// Default Data
const DEFAULT_EVENT = {
  id: "event_main",
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

// Lightweight File-based JSON Database (No heavy database server required!)
class LightweightJSONDatabase {
  constructor() {
    this.init();
  }

  init() {
    if (!fs.existsSync(DB_FILE)) {
      const initialData = {
        event: DEFAULT_EVENT,
        guests: DEFAULT_GUESTS
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
      console.log('⚡ Lightweight JSON Database initialized at:', DB_FILE);
    }
  }

  read() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {}
    return { event: DEFAULT_EVENT, guests: DEFAULT_GUESTS };
  }

  write(data) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}
  }

  async getEvent() {
    const data = this.read();
    return data.event || DEFAULT_EVENT;
  }

  async updateEvent(newEv) {
    const data = this.read();
    data.event = { ...data.event, ...newEv };
    this.write(data);
    return data.event;
  }

  async getGuests() {
    const data = this.read();
    return data.guests || [];
  }

  async addGuests(newGuests) {
    const data = this.read();
    const existing = data.guests || [];
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
        uniqueNew.push(g);
      }
    });

    data.guests = [...existing, ...uniqueNew];
    this.write(data);
    return data.guests;
  }

  async clearGuests() {
    const data = this.read();
    data.guests = [];
    this.write(data);
    return [];
  }

  async deleteGuest(id) {
    const data = this.read();
    data.guests = (data.guests || []).filter(g => g.id !== id);
    this.write(data);
    return true;
  }

  async getGuestById(id) {
    const data = this.read();
    return (data.guests || []).find(g => g.id === id) || null;
  }

  async updateGuestRSVP(id, status, companions) {
    const data = this.read();
    const guest = (data.guests || []).find(g => g.id === id);
    if (guest) {
      guest.status = status;
      if (companions) guest.companions = companions;
      this.write(data);
      return guest;
    }
    return null;
  }
}

export const db = new LightweightJSONDatabase();
