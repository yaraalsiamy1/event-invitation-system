import pkg from 'pg';
const { Pool } = pkg;

// Default Event & Sample Guests Data
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

// In-Memory Storage Fallback if DB connection is offline locally
class LocalFallbackDB {
  constructor() {
    this.eventData = { ...DEFAULT_EVENT };
    this.guests = [...DEFAULT_GUESTS];
  }

  async getEvent() { return this.eventData; }
  async updateEvent(data) { this.eventData = { ...this.eventData, ...data }; return this.eventData; }
  async getGuests() { return this.guests; }
  async addGuests(newGuests) { this.guests = [...this.guests, ...newGuests]; return this.guests; }
  async clearGuests() { this.guests = []; return []; }
  async deleteGuest(id) { this.guests = this.guests.filter(g => g.id !== id); return true; }
  async getGuestById(id) { return this.guests.find(g => g.id === id) || null; }
  async updateGuestRSVP(id, status, companions) {
    const guest = this.guests.find(g => g.id === id);
    if (guest) {
      guest.status = status;
      if (companions) guest.companions = companions;
      return guest;
    }
    return null;
  }
}

class RailwayDatabase {
  constructor() {
    this.usePg = Boolean(process.env.DATABASE_URL);
    if (this.usePg) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      this.initPgTables();
    } else {
      console.log('⚡ Running with In-Memory / Local Storage engine (Railway PostgreSQL will auto-enable when DATABASE_URL is attached on Railway)');
      this.localDb = new LocalFallbackDB();
    }
  }

  async initPgTables() {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS events (
          id VARCHAR(50) PRIMARY KEY,
          title TEXT,
          date TEXT,
          time TEXT,
          location TEXT,
          map_link TEXT,
          card_image TEXT
        );
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS guests (
          id VARCHAR(50) PRIMARY KEY,
          name TEXT,
          phone TEXT,
          status VARCHAR(20),
          companions INT,
          ticket_code VARCHAR(20),
          checked_in BOOLEAN DEFAULT FALSE,
          check_in_time TEXT
        );
      `);

      // Seed if empty
      const res = await this.pool.query(`SELECT COUNT(*) FROM events`);
      if (parseInt(res.rows[0].count, 10) === 0) {
        await this.pool.query(
          `INSERT INTO events (id, title, date, time, location, map_link, card_image) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [DEFAULT_EVENT.id, DEFAULT_EVENT.title, DEFAULT_EVENT.date, DEFAULT_EVENT.time, DEFAULT_EVENT.location, DEFAULT_EVENT.mapLink, DEFAULT_EVENT.cardImage]
        );
        for (const g of DEFAULT_GUESTS) {
          await this.pool.query(
            `INSERT INTO guests (id, name, phone, status, companions, ticket_code, checked_in, check_in_time) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [g.id, g.name, g.phone, g.status, g.companions, g.ticketCode, g.checkedIn, g.checkInTime]
          );
        }
      }
      console.log('✅ Railway PostgreSQL database initialized successfully!');
    } catch (err) {
      console.error('PostgreSQL init error:', err);
      this.usePg = false;
      this.localDb = new LocalFallbackDB();
    }
  }

  async getEvent() {
    if (!this.usePg) return this.localDb.getEvent();
    const res = await this.pool.query(`SELECT id, title, date, time, location, map_link AS "mapLink", card_image AS "cardImage" FROM events LIMIT 1`);
    return res.rows[0] || DEFAULT_EVENT;
  }

  async updateEvent(data) {
    if (!this.usePg) return this.localDb.updateEvent(data);
    await this.pool.query(
      `UPDATE events SET title=$1, date=$2, time=$3, location=$4, map_link=$5, card_image=$6 WHERE id=$7`,
      [data.title, data.date, data.time, data.location, data.mapLink, data.cardImage, DEFAULT_EVENT.id]
    );
    return this.getEvent();
  }

  async getGuests() {
    if (!this.usePg) return this.localDb.getGuests();
    const res = await this.pool.query(`SELECT id, name, phone, status, companions, ticket_code AS "ticketCode", checked_in AS "checkedIn", check_in_time AS "checkInTime" FROM guests ORDER BY id DESC`);
    return res.rows;
  }

  async addGuests(newGuests) {
    if (!this.usePg) return this.localDb.addGuests(newGuests);
    for (const g of newGuests) {
      await this.pool.query(
        `INSERT INTO guests (id, name, phone, status, companions, ticket_code, checked_in, check_in_time) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET name=$2, phone=$3, status=$4, companions=$5`,
        [g.id, g.name, g.phone, g.status || 'pending', g.companions || 1, g.ticketCode, false, null]
      );
    }
    return this.getGuests();
  }

  async clearGuests() {
    if (!this.usePg) return this.localDb.clearGuests();
    await this.pool.query(`DELETE FROM guests`);
    return [];
  }

  async deleteGuest(id) {
    if (!this.usePg) return this.localDb.deleteGuest(id);
    await this.pool.query(`DELETE FROM guests WHERE id=$1`, [id]);
    return true;
  }

  async getGuestById(id) {
    if (!this.usePg) return this.localDb.getGuestById(id);
    const res = await this.pool.query(`SELECT id, name, phone, status, companions, ticket_code AS "ticketCode", checked_in AS "checkedIn", check_in_time AS "checkInTime" FROM guests WHERE id=$1`, [id]);
    return res.rows[0] || null;
  }

  async updateGuestRSVP(id, status, companions) {
    if (!this.usePg) return this.localDb.updateGuestRSVP(id, status, companions);
    await this.pool.query(
      `UPDATE guests SET status=$1, companions=$2 WHERE id=$3`,
      [status, companions || 1, id]
    );
    return this.getGuestById(id);
  }
}

export const db = new RailwayDatabase();
