import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
export const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || (fs.existsSync('/data') ? '/data' : path.join(__dirname, '..'));
const DB_FILE = path.join(DATA_DIR, 'data_invitation.json');

// Auto-initialize from bundled database if volume or custom data dir is empty
if (!fs.existsSync(DB_FILE)) {
  const bundled = path.join(__dirname, '../data_invitation.json');
  if (fs.existsSync(bundled)) {
    try {
      fs.copyFileSync(bundled, DB_FILE);
      console.log('Initialized DB_FILE from bundled data to:', DB_FILE);
    } catch (e) {
      console.warn('Failed to copy bundled DB_FILE:', e);
    }
  }
}

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
 * Checks if an event's date has passed (Phase 4 Req 4)
 */
export function isEventPast(dateStr, timeStr) {
  if (!dateStr) return false;
  try {
    const cleanDate = dateStr.toString().trim();
    const ymd = cleanDate.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    const dmy = cleanDate.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    let year, month, day;
    if (ymd) {
      year = parseInt(ymd[1], 10);
      month = parseInt(ymd[2], 10);
      day = parseInt(ymd[3], 10);
    } else if (dmy) {
      day = parseInt(dmy[1], 10);
      month = parseInt(dmy[2], 10);
      year = parseInt(dmy[3], 10);
    } else {
      const d = new Date(cleanDate);
      if (isNaN(d.getTime())) return false;
      year = d.getFullYear();
      month = d.getMonth() + 1;
      day = d.getDate();
    }

    let hours = 23;
    let minutes = 59;
    if (timeStr) {
      const tm = timeStr.toString().trim().match(/(\d{1,2}):(\d{2})/);
      if (tm) {
        hours = parseInt(tm[1], 10);
        minutes = parseInt(tm[2], 10);
      }
    }

    const eventEnd = new Date(year, month - 1, day, hours, minutes, 59);
    return new Date() > eventEnd;
  } catch (e) {
    return false;
  }
}

/**
 * Unified Arabic Date & Time Formatter (Phase 4 Req 6)
 * Output example: "الخميس 8 يناير 2026، 9:30 م"
 */
export function formatArabicDateTime(dateStr, timeStr) {
  if (!dateStr) return '';

  const ARABIC_WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const ARABIC_MONTHS = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  let year, month, day;
  const cleanDate = dateStr.toString().trim();

  const ymd = cleanDate.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  const dmy = cleanDate.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);

  if (ymd) {
    year = parseInt(ymd[1], 10);
    month = parseInt(ymd[2], 10);
    day = parseInt(ymd[3], 10);
  } else if (dmy) {
    day = parseInt(dmy[1], 10);
    month = parseInt(dmy[2], 10);
    year = parseInt(dmy[3], 10);
  } else {
    const d = new Date(cleanDate);
    if (isNaN(d.getTime())) return cleanDate;
    year = d.getFullYear();
    month = d.getMonth() + 1;
    day = d.getDate();
  }

  const dateObj = new Date(year, month - 1, day);
  const weekdayName = ARABIC_WEEKDAYS[dateObj.getDay()] || '';
  const monthName = ARABIC_MONTHS[month - 1] || '';

  const formattedDate = `${weekdayName} ${day} ${monthName} ${year}`.trim();

  let formattedTime = '';
  if (timeStr) {
    const cleanTime = timeStr.toString().trim();
    const timeMatch = cleanTime.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM|am|pm|ص|م))?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2];
      const marker = (timeMatch[3] || '').toUpperCase();

      if (marker === 'PM' || marker === 'م') {
        if (hours < 12) hours += 12;
      } else if (marker === 'AM' || marker === 'ص') {
        if (hours === 12) hours = 0;
      }

      const period = hours >= 12 ? 'م' : 'ص';
      const h12 = hours % 12 || 12;
      formattedTime = `${h12}:${minutes} ${period}`;
    } else {
      formattedTime = cleanTime;
    }
  }

  if (formattedTime) {
    return `${formattedDate}، ${formattedTime}`;
  }
  return formattedDate;
}

/**
 * Dynamic Greeting Text Generator (Phase 4 Req 2)
 * No dependents: "تشرفنا بدعوتك"
 * With dependents: "الدعوة لك ولـ لين" أو "الدعوة لك ولـ لين وسارة"
 */
export function getGreetingText(dependents = []) {
  if (!dependents || dependents.length === 0) {
    return 'تشرفنا بدعوتك';
  }
  const names = dependents.map(d => (d && d.name) ? d.name.trim() : '').filter(Boolean);
  if (names.length === 0) return 'تشرفنا بدعوتك';
  return `الدعوة لك ولـ ${names.join(' و')}`;
}

export function formatArabicDateOnly(dateStr) {
  if (!dateStr) return '';
  const ARABIC_WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const ARABIC_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const clean = dateStr.toString().trim();
  const ymd = clean.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  const dmy = clean.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  let y, m, d;
  if (ymd) { y = parseInt(ymd[1], 10); m = parseInt(ymd[2], 10); d = parseInt(ymd[3], 10); }
  else if (dmy) { d = parseInt(dmy[1], 10); m = parseInt(dmy[2], 10); y = parseInt(dmy[3], 10); }
  else { const dt = new Date(clean); if (isNaN(dt.getTime())) return clean; y = dt.getFullYear(); m = dt.getMonth() + 1; d = dt.getDate(); }
  const dtObj = new Date(y, m - 1, d);
  return `${ARABIC_WEEKDAYS[dtObj.getDay()]} ${d} ${ARABIC_MONTHS[m - 1]} ${y}`;
}

export function formatArabicTimeOnly(timeStr) {
  if (!timeStr) return '';
  const clean = timeStr.toString().trim();
  const m = clean.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM|am|pm|ص|م))?/i);
  if (!m) return clean;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const marker = (m[3] || '').toUpperCase();
  if (marker === 'PM' || marker === 'م') { if (h < 12) h += 12; }
  else if (marker === 'AM' || marker === 'ص') { if (h === 12) h = 0; }
  const period = h >= 12 ? 'م' : 'ص';
  const h12 = h % 12 || 12;
  return `${h12}:${min} ${period}`;
}

export const DEFAULT_TEMPLATE_SINGLE = `المكرمة/ {guest_name}

يسرنا ويسعدنا دعوتك لحضور حفلنا وتكتمل فرحتنا بمشاركتك.

المناسبة: {event_name}
التاريخ: {date}
الوقت: {time}
المكان: {venue}

يرجى تأكيد حضورك واستلام تذكرتك الإلكترونية عبر الرابط التالي:
{invite_link}`;

export const DEFAULT_TEMPLATE_WITH_COMPANIONS = `المكرمة/ {guest_name}

الدعوة لك {companions}، يسرنا ويسعدنا دعوتكم لحضور حفلنا وتكتمل فرحتنا بمشاركتكم.

المناسبة: {event_name}
التاريخ: {date}
الوقت: {time}
المكان: {venue}

يرجى تأكيد حضوركم واستلام تذاكر الدخول الإلكترونية عبر الرابط التالي:
{invite_link}`;

export const DEFAULT_REMINDER_MESSAGE = `بكل الحب، نذكّركم بموعد ليلة فرحتنا، ويسعدنا حضوركم ومشاركتنا ...... ✨

🕦 الحضور: الساعة ……
💍 موعد الزفّة: الساعة ……

📍 للوصول إلى موقع المناسبة، يرجى الضغط على الرابط أدناه:
[رابط الموقع]`;

export const DEFAULT_REMINDER_TEMPLATE = DEFAULT_REMINDER_MESSAGE;

/**
 * Renders WhatsApp message template with variables (Phase 5 Req 1 & 2)
 */
export function renderWhatsAppMessage(template, { guest, dependents = [], event = {}, baseUrl = 'http://localhost:3000' }) {
  if (!guest) return '';

  const depNames = dependents.map(d => (d && d.name) ? d.name.trim() : '').filter(Boolean);
  const hasDependents = depNames.length > 0;

  const guestName = guest.name || '';
  let companionsText = '';
  if (depNames.length === 1) {
    companionsText = `ولـ ${depNames[0]}`;
  } else if (depNames.length > 1) {
    const copy = [...depNames];
    const last = copy.pop();
    companionsText = `ولـ ${copy.join(' و ')} و ${last}`;
  }

  const eventName = event?.title || 'المناسبة';
  const dateStr = formatArabicDateOnly(event?.date) || event?.date || '';
  const timeStr = formatArabicTimeOnly(event?.time) || event?.time || '';
  const venueStr = event?.location || '';
  const mapLinkStr = event?.mapLink || event?.location_link || '';
  const inviteLink = `${baseUrl}/?guest=${guest.invite_token || guest.id}`;

  const raw = (template || '').trim();

  // If the user's text does not include explicit variables or full reminder template (e.g. user just wrote the intro):
  // Automatically format the full ready invitation message with all details around this intro!
  const isSelfContained = raw.includes('{invite_link}') ||
    raw.includes('{link}') ||
    raw.includes('{event_name}') ||
    raw.includes('[رابط الموقع]') ||
    raw.includes('{map_link}') ||
    raw.includes('[رابط الدعوة]') ||
    raw.includes('نذكّركم') ||
    raw.includes('نذكركم') ||
    raw.includes('ليلة فرحتنا') ||
    raw.includes('موعد الزفّة') ||
    raw.includes('موعد الزفة');

  if (!isSelfContained) {
    const userIntro = raw || 'يسرنا ويسعدنا دعوتكم لحضور حفلنا وتكتمل فرحتنا بمشاركتكم.';
    const greeting = hasDependents
      ? `المكرمة/ ${guestName}\nالدعوة لك ${companionsText}، ${userIntro}`
      : `المكرمة/ ${guestName}\n\n${userIntro}`;

    let detailsBlock = `المناسبة: ${eventName}`;
    if (dateStr) detailsBlock += `\nالتاريخ: ${dateStr}`;
    if (timeStr) detailsBlock += `\nالوقت: ${timeStr}`;
    if (venueStr) detailsBlock += `\nالمكان: ${venueStr}`;

    const cta = hasDependents
      ? `يرجى تأكيد حضوركم واستلام تذاكر الدخول الإلكترونية عبر الرابط التالي:`
      : `يرجى تأكيد حضورك واستلام تذكرتك الإلكترونية عبر الرابط التالي:`;

    return `${greeting}\n\n${detailsBlock}\n\n${cta}\n${inviteLink}`;
  }

  return raw
    .replace(/\[رابط الموقع\]|\{map_link\}/g, mapLinkStr || '[رابط الموقع]')
    .replace(/\[رابط الدعوة\]|\{invite_link\}|\{link\}/g, inviteLink)
    .replace(/\{guest_name\}|\{name\}/g, guestName)
    .replace(/\{companions\}/g, companionsText)
    .replace(/\{event_name\}|\{event\}/g, eventName)
    .replace(/\{date\}/g, dateStr)
    .replace(/\{time\}/g, timeStr)
    .replace(/\{venue\}|\{location\}/g, venueStr);
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
      const total = guests.length;
      const owners = guests.filter(g => !g.parent_guest_id);
      const dependents = guests.filter(g => g.parent_guest_id);
      const accepted = guests.filter(g => g.status === 'accepted').length;
      const declined = guests.filter(g => g.status === 'declined').length;
      const pending = guests.filter(g => !g.status || g.status === 'pending').length;
      const responded = accepted + declined;
      const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;

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
        totalGuests: total,
        totalPeople: total,
        ownersCount: owners.length,
        dependentsCount: dependents.length,
        acceptedCount: accepted,
        declinedCount: declined,
        pendingCount: pending,
        responseRate
      };
    });
  }

  /**
   * Phase 6: Live Event Statistics (Per Event, counting actual people, not invitations)
   */
  async getEventStats(eventId) {
    const ev = await this.getEvent(eventId);
    if (!ev) return null;
    const guests = ev.guests || [];
    const total = guests.length;
    const owners = guests.filter(g => !g.parent_guest_id);
    const dependents = guests.filter(g => g.parent_guest_id);

    const accepted = guests.filter(g => g.status === 'accepted').length;
    const acceptedOwners = owners.filter(g => g.status === 'accepted').length;
    const acceptedDeps = dependents.filter(g => g.status === 'accepted').length;

    const declined = guests.filter(g => g.status === 'declined').length;
    const declinedOwners = owners.filter(g => g.status === 'declined').length;
    const declinedDeps = dependents.filter(g => g.status === 'declined').length;

    const pending = guests.filter(g => !g.status || g.status === 'pending').length;
    const pendingOwners = owners.filter(g => !g.status || g.status === 'pending').length;
    const pendingDeps = dependents.filter(g => g.status === 'pending').length;

    const responded = accepted + declined;
    const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;
    const acceptanceRate = total > 0 ? Math.round((accepted / total) * 100) : 0;
    const declineRate = total > 0 ? Math.round((declined / total) * 100) : 0;
    const pendingRate = total > 0 ? Math.round((pending / total) * 100) : 0;

    return {
      eventId: ev.id,
      eventTitle: ev.title,
      total,
      ownersCount: owners.length,
      dependentsCount: dependents.length,
      accepted,
      acceptedOwners,
      acceptedDeps,
      declined,
      declinedOwners,
      declinedDeps,
      pending,
      pendingOwners,
      pendingDeps,
      responded,
      responseRate,
      acceptanceRate,
      declineRate,
      pendingRate
    };
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
      mapLink: (newEvent.mapLink && newEvent.mapLink.trim()) ? newEvent.mapLink.trim() : "",
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
        const isLocked = isEventPast(ev.date, ev.time);

        // Mark as opened if sent and not yet recorded (Phase 5 Req 4)
        if (owner.sent && !owner.openedAt) {
          owner.openedAt = new Date().toISOString();
          owner.opened = true;
          this.write(data);
        }

        return {
          guest: owner,
          owner,
          activePerson: guest,
          dependents,
          event: ev,
          isLocked
        };
      }
    }
    return null;
  }

  async updateGuestRSVP(guestId, status) {
    const data = this.read();
    for (const ev of (data.events || [])) {
      const targetGuest = (ev.guests || []).find(g => g.id === guestId);
      if (targetGuest) {
        if (isEventPast(ev.date, ev.time)) {
          throw new Error('انتهت فترة الرد على الدعوة لانتهاء موعد المناسبة');
        }
        if (targetGuest.status && targetGuest.status !== 'pending') {
          throw new Error('تم تسجيل ردك على الدعوة مسبقاً، ولا يمكن تعديل الرد.');
        }
        targetGuest.status = status;
        targetGuest.rsvpAt = new Date().toISOString();
        this.write(data);

        let owner = targetGuest;
        if (targetGuest.parent_guest_id) {
          const parent = (ev.guests || []).find(g => g.id === targetGuest.parent_guest_id);
          if (parent) owner = parent;
        }
        const dependents = (ev.guests || []).filter(g => g.parent_guest_id === owner.id);
        return { guest: targetGuest, owner, dependents, event: ev, isLocked: false };
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
          status: merged.status || current.status || 'pending',
          rsvpAt: (merged.status && merged.status !== 'pending' && !current.rsvpAt) ? new Date().toISOString() : (merged.rsvpAt || current.rsvpAt || null),
          invite_token: isDependent ? null : (current.invite_token || generateInviteToken())
        };

        ev.guests[idx] = updated;
        this.write(data);
        return updated;
      }
    }
    return null;
  }

  /**
   * Phase 7 Req 1: Server-Side WhatsApp Credentials & Masking
   */
  async getWhatsAppConfig() {
    const data = this.read();
    const config = data.whatsappConfig || {};
    const instanceId = config.instanceId || '';
    const apiToken = config.apiToken || '';

    const mask = (val) => {
      if (!val) return '';
      if (val.length <= 4) return val;
      return '••••••••' + val.slice(-4);
    };

    return {
      instanceIdMasked: mask(instanceId),
      apiTokenMasked: mask(apiToken),
      hasConfig: !!(instanceId && apiToken)
    };
  }

  async getWhatsAppRawConfig() {
    const data = this.read();
    return data.whatsappConfig || { instanceId: '', apiToken: '' };
  }

  async saveWhatsAppConfig({ instanceId, apiToken }) {
    const data = this.read();
    if (!data.whatsappConfig) data.whatsappConfig = {};
    if (instanceId && typeof instanceId === 'string' && !instanceId.includes('••••')) {
      data.whatsappConfig.instanceId = instanceId.trim();
    }
    if (apiToken && typeof apiToken === 'string' && !apiToken.includes('••••')) {
      data.whatsappConfig.apiToken = apiToken.trim();
    }
    this.write(data);
    return this.getWhatsAppConfig();
  }

  async getAdminPin() {
    const data = this.read();
    return (data.adminPin || '1454').toString().trim();
  }

  async verifyAdminPin(pin) {
    const correctPin = await this.getAdminPin();
    const cleanInput = (pin || '').toString().trim();
    return cleanInput === correctPin;
  }

  async setAdminPin(newPin) {
    if (!newPin || typeof newPin !== 'string' || newPin.trim().length < 4) {
      throw new Error('الرمز السري يجب أن يتكون من 4 أرقام على الأقل');
    }
    const data = this.read();
    data.adminPin = newPin.trim();
    this.write(data);
    return true;
  }
}

export const db = new MultiEventJSONDatabase();

