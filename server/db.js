import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '../data_invitation.json');

class MultiEventJSONDatabase {
  constructor() {
    this.init();
  }

  init() {
    if (!fs.existsSync(DB_FILE)) {
      const initialData = {
        activeEventId: null,
        events: []
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
      console.log('Multi-Event Database initialized (Clean State) at:', DB_FILE);
    } else {
      const data = this.read();
      if (!data.events) {
        this.write({ activeEventId: null, events: [] });
      }
    }
  }

  read() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.events)) return parsed;
      }
    } catch (e) {}
    return { activeEventId: null, events: [] };
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
    return data.activeEventId || (data.events[0] ? data.events[0].id : null);
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
    if (!targetId && data.events.length > 0) return data.events[0];
    return (data.events || []).find(e => e.id === targetId) || null;
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
    data.events = (data.events || []).filter(e => e.id !== eventId);
    data.activeEventId = data.events.length > 0 ? data.events[0].id : null;
    this.write(data);
    return data.activeEventId;
  }

  async getGuests(eventId) {
    const ev = await this.getEvent(eventId);
    return ev ? (ev.guests || []) : [];
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
