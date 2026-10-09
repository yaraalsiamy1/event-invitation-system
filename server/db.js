import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '../data_invitation.json');

/**
 * Normalizes Arabic text for matching:
 * ى -> ي, ة -> ه, أ/إ/آ -> ا, removes tashkeel and excessive spaces
 */
export function normalizeArabicName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

/**
 * Normalizes phone numbers:
 * Converts 05XXXXXXXX or 5XXXXXXXX or +9665XXXXXXXX or 009665XXXXXXXX into 9665XXXXXXXX
 */
export function normalizePhone(phone) {
  if (!phone) return null;
  let clean = phone.toString().trim().replace(/\D/g, '');
  if (!clean) return null;

  if (clean.startsWith('00966')) {
    clean = clean.substring(2);
  } else if (clean.startsWith('05')) {
    clean = '966' + clean.substring(1);
  } else if (clean.startsWith('5') && clean.length === 9) {
    clean = '966' + clean;
  }
  return clean;
}

/**
 * Checks if a phone number matches Saudi mobile format: 966 + 9 digits starting with 5 (12 digits)
 */
export function isValidSaudiPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  return /^9665\d{8}$/.test(normalized);
}

/**
 * Generates a cryptographically secure random token (at least 22 characters)
 */
export function generateInviteToken() {
  return crypto.randomBytes(24).toString('base64url'); // 32 URL-safe characters
}

/**
 * Validates a guest against Phase 1 business rules
 * @param {Object} guest - The guest record to validate
 * @param {Array} existingEventGuests - All guests belonging to the same event
 * @param {string|null} guestIdToIgnore - Optional ID of guest being updated
 */
export function validateGuest(guest, existingEventGuests = [], guestIdToIgnore = null) {
  const errors = [];

  const cleanName = (guest.name || '').trim();
  if (!cleanName || cleanName.length < 1) {
    errors.push('اسم الضيف مطلوب');
  }

  const parentId = guest.parent_guest_id || null;
  const rawPhone = (guest.phone !== undefined && guest.phone !== null && guest.phone !== '') ? guest.phone.toString().trim() : null;
  const normalizedPhone = rawPhone ? normalizePhone(rawPhone) : null;

  // Rule: A guest has either a phone OR a parent_guest_id, never both.
  if (parentId && rawPhone) {
    errors.push('المرافق لا يمكن أن يمتلك رقم جوال (إما رقم جوال أو مرافق لـ، وليس كلاهما)');
  }
  if (!parentId && !rawPhone) {
    errors.push('رقم الجوال مطلوب للضيف المستقل');
  }

  // If independent guest (has phone)
  if (!parentId && rawPhone) {
    if (!isValidSaudiPhone(rawPhone)) {
      errors.push('صيغة رقم الجوال غير صحيحة (يجب أن يبدأ بـ 05 ويتكون من 10 أرقام)');
    } else {
      // Check duplicate phone within the SAME event
      const isDuplicate = existingEventGuests.some(g => {
        if (guestIdToIgnore && g.id === guestIdToIgnore) return false;
        return g.phone && normalizePhone(g.phone) === normalizedPhone;
      });
      if (isDuplicate) {
        errors.push('رقم الجوال مكرر ومسجل مسبقاً في هذه المناسبة');
      }
    }
  }

  // If dependent guest (has parent_guest_id)
  if (parentId) {
    // A guest cannot follow themselves
    if (guestIdToIgnore && parentId === guestIdToIgnore) {
      errors.push('لا يمكن للضيف أن يكون مرافقاً لنفسه');
    }

    // Owner must exist in the same event
    const owner = existingEventGuests.find(g => g.id === parentId);
    if (!owner) {
      errors.push('صاحب الدعوة غير موجود في هذه المناسبة');
    } else {
      // An owner cannot themselves be a dependent (one level only)
      if (owner.parent_guest_id) {
        errors.push('لا يمكن أن يكون صاحب الدعوة مرافقاً لشخص آخر (مستوى واحد فقط للمرافقين)');
      }
    }

    // If editing a guest who is already an owner with dependents, they cannot become a dependent!
    if (guestIdToIgnore) {
      const hasDependents = existingEventGuests.some(g => g.parent_guest_id === guestIdToIgnore);
      if (hasDependents) {
        errors.push('لا يمكن تحويل ضيف لديه مرافقون إلى مرافق لشخص آخر');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    cleanName,
    normalizedPhone: parentId ? null : normalizedPhone
  };
}

class MultiEventJSONDatabase {
  constructor() {
    this.init();
  }

  init() {
    const createDefault = () => {
      const defaultEv = {
        id: "ev_1789587103668_307",
        title: "عقد قران تركي قاري & لمار السيامي",
        type: "wedding",
        date: "2026-09-30",
        time: "20:00",
        location: "قاعة ميلا | مكة-العوالي",
        mapLink: "https://maps.app.goo.gl/eGuQzLPJbqEkNk1W6",
        cardImage: "/uploads/card_ev_1789587103668_307_1789592678834.jpg",
        guests: []
      };
      return { activeEventId: defaultEv.id, events: [defaultEv] };
    };

    if (!fs.existsSync(DB_FILE)) {
      this.write(createDefault());
      console.log('Multi-Event Database initialized at:', DB_FILE);
    } else {
      const data = this.read();
      if (!data.events || data.events.length === 0) {
        this.write(createDefault());
      }
    }

    // Run Migration so existing guests stay as they are, with no dependents and secure invite_tokens
    this.migrateGuests();
  }

  /**
   * Phase 1 Migration:
   * Ensures every guest has event_id, parent_guest_id (default null),
   * normalized phone, and every owner has a cryptographically secure invite_token (>= 22 chars)
   */
  migrateGuests() {
    try {
      const data = this.read();
      let hasChanges = false;

      (data.events || []).forEach(ev => {
        if (Array.isArray(ev.guests)) {
          ev.guests.forEach(g => {
            if (!g.eventId) { g.eventId = ev.id; hasChanges = true; }
            if (!g.event_id) { g.event_id = ev.id; hasChanges = true; }

            if (g.parent_guest_id === undefined) {
              g.parent_guest_id = null;
              hasChanges = true;
            }

            if (!g.parent_guest_id && (!g.invite_token || g.invite_token.length < 22)) {
              g.invite_token = generateInviteToken();
              hasChanges = true;
            }

            if (g.parent_guest_id) {
              if (g.invite_token) {
                g.invite_token = null;
                hasChanges = true;
              }
              if (g.phone) {
                g.phone = null;
                hasChanges = true;
              }
            } else if (g.phone) {
              const norm = normalizePhone(g.phone);
              if (norm && norm !== g.phone) {
                g.phone = norm;
                hasChanges = true;
              }
            }
          });
        }
      });

      if (hasChanges) {
        this.write(data);
        console.log('Phase 1 Guest Data Migration completed successfully.');
      }
    } catch (e) {
      console.error('Error during guest data migration:', e);
    }
  }

  read() {
    const createDefault = () => {
      const defaultEv = {
        id: "ev_1789587103668_307",
        title: "عقد قران تركي قاري & لمار السيامي",
        type: "wedding",
        date: "2026-09-30",
        time: "20:00",
        location: "قاعة ميلا | مكة-العوالي",
        mapLink: "https://maps.app.goo.gl/eGuQzLPJbqEkNk1W6",
        cardImage: "/uploads/card_ev_1789587103668_307_1789592678834.jpg",
        guests: []
      };
      return { activeEventId: defaultEv.id, events: [defaultEv] };
    };

    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.events) && parsed.events.length > 0) {
          if (!parsed.activeEventId) {
            parsed.activeEventId = parsed.events[0].id;
          }
          return parsed;
        }
      }
    } catch (e) {}

    const defaultData = createDefault();
    this.write(defaultData);
    return defaultData;
  }

  write(data) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('Error writing to DB_FILE:', e);
    }
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
      id: newEvent.id || ("ev_" + Date.now() + "_" + Math.floor(Math.random() * 1000)),
      title: newEvent.title || "مناسبة جديدة",
      type: newEvent.type || "wedding",
      date: newEvent.date || new Date().toISOString().split('T')[0],
      time: newEvent.time || "20:00",
      location: newEvent.location || "القاعة الرئيسية",
      mapLink: newEvent.mapLink || "https://maps.google.com",
      cardImage: newEvent.cardImage || null,
      guests: newEvent.guests || []
    };
    data.events = [...(data.events || []).filter(e => e.id !== created.id), created];
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
    if (data.activeEventId === eventId) {
      data.activeEventId = data.events.length > 0 ? data.events[0].id : null;
    }
    this.write(data);
    return data.activeEventId;
  }

  async getGuests(eventId) {
    const ev = await this.getEvent(eventId);
    return ev ? (ev.guests || []) : [];
  }

  /**
   * Paged guests with hierarchical grouping (owners + their dependents)
   * Supports search (by name or phone), status filtering, and pagination.
   */
  async getGuestsPaged({ eventId, page = 1, limit = 10, search = '', status = 'all' }) {
    const data = this.read();
    const targetId = eventId || data.activeEventId;
    const ev = (data.events || []).find(e => e.id === targetId);
    const allGuests = ev ? (ev.guests || []) : [];

    const cleanSearch = (search || '').trim().toLowerCase();
    const normSearch = normalizeArabicName(cleanSearch);
    const digitsSearch = cleanSearch.replace(/\D/g, '');

    const matchesStatus = (g) => {
      if (!status || status === 'all') return true;
      if (status === 'accepted') return g.status === 'accepted';
      if (status === 'declined') return g.status === 'declined';
      if (status === 'pending') return g.status === 'pending';
      if (status === 'unsent') return !g.sent;
      return true;
    };

    const ownersMap = new Map();
    const allDependents = [];

    allGuests.forEach(g => {
      if (!g.parent_guest_id) {
        ownersMap.set(g.id, { ...g, dependents: [] });
      } else {
        allDependents.push(g);
      }
    });

    allDependents.forEach(dep => {
      if (ownersMap.has(dep.parent_guest_id)) {
        ownersMap.get(dep.parent_guest_id).dependents.push(dep);
      } else {
        ownersMap.set(dep.id, { ...dep, dependents: [], isOrphan: true });
      }
    });

    let filteredUnits = Array.from(ownersMap.values()).filter(unit => {
      const ownerNameNorm = normalizeArabicName(unit.name || '');
      const ownerPhoneDigits = (unit.phone || '').replace(/\D/g, '');

      let matchesSearch = true;
      if (normSearch || digitsSearch) {
        const ownerMatches = (normSearch && ownerNameNorm.includes(normSearch)) ||
                             (digitsSearch && digitsSearch.length >= 3 && ownerPhoneDigits.includes(digitsSearch));
        const dependentMatches = unit.dependents.some(d => {
          const depNameNorm = normalizeArabicName(d.name || '');
          return normSearch && depNameNorm.includes(normSearch);
        });
        matchesSearch = ownerMatches || dependentMatches;
      }
      if (!matchesSearch) return false;

      if (status && status !== 'all') {
        const ownerStatusMatches = matchesStatus(unit);
        const depStatusMatches = unit.dependents.some(d => matchesStatus(d));
        if (!ownerStatusMatches && !depStatusMatches) return false;
      }

      return true;
    });

    const totalUnits = filteredUnits.length;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.max(1, parseInt(limit) || 10);
    const totalPages = Math.ceil(totalUnits / pageSize) || 1;
    const safePage = Math.min(pageNum, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const pagedOwners = filteredUnits.slice(startIndex, startIndex + pageSize);

    return {
      owners: pagedOwners,
      totalUnits,
      totalPeopleCount: allGuests.length,
      page: safePage,
      pageSize,
      totalPages,
      stats: {
        total: allGuests.length,
        ownersCount: ownersMap.size,
        dependentsCount: allDependents.length,
        accepted: allGuests.filter(g => g.status === 'accepted').length,
        declined: allGuests.filter(g => g.status === 'declined').length,
        pending: allGuests.filter(g => g.status === 'pending').length,
        sent: allGuests.filter(g => g.sent).length,
        unsent: allGuests.filter(g => !g.sent).length
      }
    };
  }

  async addGuests(eventId, newGuests) {
    const data = this.read();
    let targetId = eventId || data.activeEventId;
    let ev = (data.events || []).find(e => e.id === targetId);
    if (!ev && data.events && data.events.length > 0) {
      ev = data.events[0];
      targetId = ev.id;
    }
    if (!ev) {
      throw new Error('المناسبة غير موجودة');
    }

    const existing = ev.guests || [];
    const added = [];

    for (const raw of (newGuests || [])) {
      const validation = validateGuest(raw, [...existing, ...added]);
      if (!validation.isValid) {
        throw new Error(validation.errors.join('، '));
      }

      const isDependent = Boolean(raw.parent_guest_id);
      const guestRecord = {
        id: raw.id || ("g_" + Date.now() + "_" + Math.floor(Math.random() * 100000)),
        eventId: targetId,
        event_id: targetId,
        name: validation.cleanName,
        phone: isDependent ? null : validation.normalizedPhone,
        parent_guest_id: isDependent ? raw.parent_guest_id : null,
        invite_token: isDependent ? null : (raw.invite_token || generateInviteToken()),
        status: raw.status || "pending",
        ticketCode: raw.ticketCode || ("EV-" + Math.floor(100000 + Math.random() * 900000)),
        checkedIn: Boolean(raw.checkedIn),
        checkInTime: raw.checkInTime || null,
        sent: Boolean(raw.sent),
        sentAt: raw.sentAt || null
      };

      added.push(guestRecord);
    }

    ev.guests = [...existing, ...added];
    this.write(data);
    return ev.guests;
  }

  /**
   * Phase 3: Single-Transaction Excel Import
   * Validates and imports Excel rows into active event
   * - Owners saved first, then dependents
   * - Dependents can point to owners in the same file OR existing owners in the database
   * - Normalized name matching (ى=ي, ة=ه, أ/إ/آ=ا, no tashkeel)
   * - Rows matching existing guests in same event skipped with "موجود مسبقاً"
   */
  async importExcelGuests(eventId, rawRows) {
    const data = this.read();
    const targetId = eventId || data.activeEventId;
    const ev = (data.events || []).find(e => e.id === targetId);
    if (!ev) throw new Error('المناسبة غير موجودة');

    const existing = ev.guests || [];
    const existingOwners = existing.filter(g => !g.parent_guest_id);

    // Existing lookups
    const existingPhonesSet = new Set(existing.filter(g => g.phone).map(g => normalizePhone(g.phone)));
    const existingNamesSet = new Set(existing.map(g => normalizeArabicName(g.name)));
    const existingOwnersByName = new Map();
    existingOwners.forEach(o => {
      existingOwnersByName.set(normalizeArabicName(o.name), o);
    });

    // 1. First pass: Pre-process and collect file rows
    const processedRows = [];
    const filePhonesCount = new Map();
    const fileNamesCount = new Map();

    (rawRows || []).forEach((r, idx) => {
      const cleanName = (r.name || '').trim();
      const normName = normalizeArabicName(cleanName);
      const rawPhone = (r.phone !== undefined && r.phone !== null && r.phone !== '') ? r.phone.toString().trim() : '';
      const normPhone = rawPhone ? normalizePhone(rawPhone) : '';
      const companionRaw = (r.companionOf || r.parent_name || '').trim();
      const normCompanion = normalizeArabicName(companionRaw);

      if (normPhone) {
        filePhonesCount.set(normPhone, (filePhonesCount.get(normPhone) || 0) + 1);
      }
      if (normName) {
        fileNamesCount.set(normName, (fileNamesCount.get(normName) || 0) + 1);
      }

      processedRows.push({
        rowNum: idx + 1,
        rawName: cleanName,
        normName,
        rawPhone,
        normPhone,
        companionRaw,
        normCompanion,
        isOwner: !normCompanion,
        isValid: false,
        errorReason: null
      });
    });

    // 2. Validate independent rows (owners)
    const fileOwnersByName = new Map();

    processedRows.forEach(row => {
      if (!row.rawName || row.rawName.length < 2) {
        row.errorReason = 'اسم الضيف مطلوب';
        return;
      }

      // Duplicate name inside file
      if (fileNamesCount.get(row.normName) > 1) {
        row.errorReason = 'اسم الضيف مكرر في الملف';
        return;
      }

      // Existing guest in same event
      if (existingNamesSet.has(row.normName)) {
        row.errorReason = 'موجود مسبقاً';
        return;
      }

      // Check exclusivity
      if (!row.rawPhone && !row.companionRaw) {
        row.errorReason = 'يجب إدخال رقم الجوال أو تحديد صاحب الدعوة (مرافق لـ)';
        return;
      }
      if (row.rawPhone && row.companionRaw) {
        row.errorReason = 'المرافق لا يمتلك جوال (إما رقم جوال أو مرافق لـ، وليس كلاهما)';
        return;
      }

      // If owner
      if (row.isOwner) {
        if (!isValidSaudiPhone(row.rawPhone)) {
          row.errorReason = 'صيغة رقم الجوال غير صحيحة (يجب أن يبدأ بـ 05 ويتكون من 10 أرقام)';
          return;
        }
        if (filePhonesCount.get(row.normPhone) > 1) {
          row.errorReason = 'رقم الجوال مكرر في الملف';
          return;
        }
        if (existingPhonesSet.has(row.normPhone)) {
          row.errorReason = 'موجود مسبقاً';
          return;
        }

        row.isValid = true;
        fileOwnersByName.set(row.normName, row);
      }
    });

    // 3. Validate dependent rows (companions)
    processedRows.forEach(row => {
      if (!row.isOwner) {
        if (row.errorReason) return;

        // Guest follows themselves
        if (row.normCompanion === row.normName) {
          row.errorReason = 'الضيف لا يمكن أن يرافق نفسه';
          return;
        }

        // Search for owner in file first, then in DB
        const ownerInFile = fileOwnersByName.get(row.normCompanion);
        const ownerInDB = existingOwnersByName.get(row.normCompanion);

        if (!ownerInFile && !ownerInDB) {
          const matchingRawFileRow = processedRows.find(r => r.normName === row.normCompanion);
          if (matchingRawFileRow) {
            if (!matchingRawFileRow.isOwner) {
              row.errorReason = 'صاحب الدعوة لا يمكن أن يكون مرافقاً (مستوى واحد فقط)';
            } else {
              row.errorReason = 'صاحب الدعوة به خطأ';
            }
          } else {
            row.errorReason = 'صاحب الدعوة غير موجود';
          }
          return;
        }

        if (ownerInFile && !ownerInFile.isValid) {
          row.errorReason = 'صاحب الدعوة به خطأ';
          return;
        }

        row.isValid = true;
        row.resolvedOwnerInFile = ownerInFile || null;
        row.resolvedOwnerInDB = ownerInDB || null;
      }
    });

    // 4. Atomic Database Persistence
    const validOwners = processedRows.filter(r => r.isOwner && r.isValid);
    const validDependents = processedRows.filter(r => !r.isOwner && r.isValid);
    const errorRows = processedRows.filter(r => !r.isValid);

    const savedGuests = [];
    const newOwnerIdMap = new Map();

    // Save owners first
    validOwners.forEach(row => {
      const guestId = "g_" + Date.now() + "_" + Math.floor(Math.random() * 1000000) + "_" + row.rowNum;
      const guest = {
        id: guestId,
        eventId: targetId,
        event_id: targetId,
        name: row.rawName,
        phone: row.normPhone,
        parent_guest_id: null,
        invite_token: generateInviteToken(),
        status: "pending",
        ticketCode: "EV-" + Math.floor(100000 + Math.random() * 900000),
        checkedIn: false,
        checkInTime: null,
        sent: false,
        sentAt: null
      };
      savedGuests.push(guest);
      newOwnerIdMap.set(row.normName, guestId);
    });

    // Save dependents with correct parent_guest_id
    validDependents.forEach(row => {
      let parentId = null;
      if (row.resolvedOwnerInFile) {
        parentId = newOwnerIdMap.get(row.normCompanion);
      } else if (row.resolvedOwnerInDB) {
        parentId = row.resolvedOwnerInDB.id;
      }

      if (!parentId) {
        row.isValid = false;
        row.errorReason = 'صاحب الدعوة به خطأ';
        errorRows.push(row);
        return;
      }

      const guestId = "g_" + Date.now() + "_" + Math.floor(Math.random() * 1000000) + "_" + row.rowNum;
      const guest = {
        id: guestId,
        eventId: targetId,
        event_id: targetId,
        name: row.rawName,
        phone: null,
        parent_guest_id: parentId,
        invite_token: null,
        status: "pending",
        ticketCode: "EV-" + Math.floor(100000 + Math.random() * 900000),
        checkedIn: false,
        checkInTime: null,
        sent: false,
        sentAt: null
      };
      savedGuests.push(guest);
    });

    if (savedGuests.length > 0) {
      ev.guests = [...existing, ...savedGuests];
      this.write(data);
    }

    return {
      savedCount: savedGuests.length,
      savedGuests,
      errorRows: errorRows.map(r => ({
        rowNum: r.rowNum,
        name: r.rawName,
        phone: r.rawPhone,
        companionOf: r.companionRaw,
        reason: r.errorReason,
        errorReason: r.errorReason
      }))
    };
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

  /**
   * Delete guest with support for owner dependents:
   * @param {string} eventId
   * @param {string} guestId
   * @param {Object} options - { deleteDependents: boolean }
   * If deleteDependents is true (default): deletes owner and all their dependents
   * If deleteDependents is false: deletes owner and converts dependents to independent guests
   */
  async deleteGuest(eventId, guestId, options = {}) {
    const { deleteDependents = true } = options;
    const data = this.read();
    const targetId = eventId || data.activeEventId;
    const ev = (data.events || []).find(e => e.id === targetId);
    if (!ev) return false;

    const guest = (ev.guests || []).find(g => g.id === guestId);
    if (!guest) return false;

    if (deleteDependents) {
      ev.guests = (ev.guests || []).filter(g => g.id !== guestId && g.parent_guest_id !== guestId);
    } else {
      ev.guests = (ev.guests || []).filter(g => g.id !== guestId).map(g => {
        if (g.parent_guest_id === guestId) {
          return {
            ...g,
            parent_guest_id: null,
            invite_token: generateInviteToken()
          };
        }
        return g;
      });
    }

    this.write(data);
    return true;
  }

  async getGuestById(guestId) {
    const data = this.read();
    for (const ev of (data.events || [])) {
      const guest = (ev.guests || []).find(g => g.id === guestId);
      if (guest) {
        const dependents = (ev.guests || []).filter(g => g.parent_guest_id === guest.id);
        return { guest, dependents, event: ev };
      }
    }
    return null;
  }

  async getGuestByTokenOrId(tokenOrId) {
    const data = this.read();
    for (const ev of (data.events || [])) {
      const guest = (ev.guests || []).find(g => g.invite_token === tokenOrId || g.id === tokenOrId);
      if (guest) {
        // If guest is an owner, fetch dependents
        // If guest is a dependent, fetch owner and sibling dependents
        let owner = guest;
        if (guest.parent_guest_id) {
          const parent = (ev.guests || []).find(g => g.id === guest.parent_guest_id);
          if (parent) owner = parent;
        }
        const dependents = (ev.guests || []).filter(g => g.parent_guest_id === owner.id);
        return { guest: owner, activePerson: guest, dependents, event: ev };
      }
    }
    return null;
  }

  async updateGuestRSVP(guestId, status) {
    const data = this.read();
    for (const ev of (data.events || [])) {
      const guest = (ev.guests || []).find(g => g.id === guestId);
      if (guest) {
        if (!guest.status || guest.status === 'pending' || guest.status !== status) {
          guest.status = status;
          guest.rsvpAt = new Date().toISOString();
          this.write(data);
        }
        const dependents = (ev.guests || []).filter(g => g.parent_guest_id === (guest.parent_guest_id || guest.id));
        return { guest, dependents, event: ev };
      }
    }
    return null;
  }

  async markGuestsSent(eventId, guestIds) {
    const data = this.read();
    const targetId = eventId || data.activeEventId;
    const ev = (data.events || []).find(e => e.id === targetId);
    if (ev && Array.isArray(ev.guests)) {
      const idSet = new Set(guestIds);
      ev.guests.forEach(g => {
        if (idSet.has(g.id)) {
          g.sent = true;
          g.sentAt = new Date().toISOString();
        }
      });
      this.write(data);
    }
  }

  async updateGuest(guestId, updatedFields, eventId = null) {
    const data = this.read();
    for (const ev of (data.events || [])) {
      if (eventId && ev.id !== eventId) continue;
      const idx = (ev.guests || []).findIndex(g => g.id === guestId);
      if (idx !== -1) {
        const current = ev.guests[idx];
        const merged = { ...current, ...updatedFields };

        const validation = validateGuest(merged, ev.guests, guestId);
        if (!validation.isValid) {
          throw new Error(validation.errors.join('، '));
        }

        const isDependent = Boolean(merged.parent_guest_id);
        const updated = {
          ...merged,
          name: validation.cleanName,
          phone: isDependent ? null : validation.normalizedPhone,
          parent_guest_id: isDependent ? merged.parent_guest_id : null,
          invite_token: isDependent ? null : (current.invite_token || generateInviteToken())
        };

        ev.guests[idx] = updated;
        this.write(data);
        return updated;
      }
    }
    return null;
  }
}

export const db = new MultiEventJSONDatabase();

