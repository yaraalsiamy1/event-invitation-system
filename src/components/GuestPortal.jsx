import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  Smartphone, Calendar, Clock, MapPin, CheckCircle2, XCircle,
  Download, ShieldCheck, HeartHandshake, Check, X, Mail, Users,
  UserCheck, Sparkles, Navigation, CalendarPlus, RotateCcw, AlertCircle,
  Lock, ArrowRight
} from 'lucide-react';

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

  // Match YYYY-MM-DD or YYYY/MM/DD
  const ymd = cleanDate.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  // Match DD-MM-YYYY or DD/MM/YYYY
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

  // Format Time into 12-hour Arabic (ص / م)
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
  const names = dependents.map(d => d.name ? d.name.trim() : '').filter(Boolean);
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

export const DEFAULT_TEMPLATE_SINGLE = `مرحباً {guest_name} 👋

يسرنا ويسعدنا دعوتك لحضور حفلنا وتكتمل فرحتنا بمشاركتك.

المناسبة: {event_name}
التاريخ: {date}
الوقت: {time}
المكان: {venue}

يرجى تأكيد حضورك واستلام تذكرتك الإلكترونية عبر الرابط التالي:
{invite_link}`;

export const DEFAULT_TEMPLATE_WITH_COMPANIONS = `مرحباً {guest_name} 👋

الدعوة لك {companions}، يسرنا ويسعدنا دعوتكم لحضور حفلنا وتكتمل فرحتنا بمشاركتكم.

المناسبة: {event_name}
التاريخ: {date}
الوقت: {time}
المكان: {venue}

يرجى تأكيد حضوركم واستلام تذاكر الدخول الإلكترونية عبر الرابط التالي:
{invite_link}`;

export const DEFAULT_REMINDER_TEMPLATE = `مرحباً {guest_name} 👋

نود تذكيركم بموعد حفل {event_name} يوم {date} الساعة {time} في {venue}.
ويسعدنا تأكيد حضوركم واستلام تذاكركم عبر الرابط التالي:
{invite_link}`;

export function renderWhatsAppMessage(template, { guest, dependents = [], event = {}, baseUrl }) {
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
  const effectiveBaseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const inviteLink = `${effectiveBaseUrl}/?guest=${guest.invite_token || guest.id}`;

  const raw = (template || '').trim();

  // If the user's text does not include explicit variables (e.g. user just wrote the intro):
  // Automatically format the full ready message with all details around this intro!
  if (!raw.includes('{invite_link}') && !raw.includes('{link}') && !raw.includes('{event_name}')) {
    const userIntro = raw || 'يسرنا ويسعدنا دعوتكم لحضور حفلنا وتكتمل فرحتنا بمشاركتكم.';
    const greeting = hasDependents
      ? `مرحباً ${guestName} 👋\nالدعوة لك ${companionsText}، ${userIntro}`
      : `مرحباً ${guestName} 👋\n\n${userIntro}`;

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
    .replace(/\{guest_name\}|\{name\}/g, guestName)
    .replace(/\{companions\}/g, companionsText)
    .replace(/\{event_name\}|\{event\}/g, eventName)
    .replace(/\{date\}/g, dateStr)
    .replace(/\{time\}/g, timeStr)
    .replace(/\{venue\}|\{location\}/g, venueStr)
    .replace(/\{invite_link\}|\{link\}/g, inviteLink);
}


/**
 * iCalendar (.ics) Generator & Downloader (Phase 4 Req 5)
 */
export function downloadIcsCalendar(event) {
  if (!event) return;
  const title = event.title || 'مناسبة خاصة';
  const location = event.location || '';
  const description = `دعوة لحضور ${title}`;

  let startDate = new Date();
  if (event.date) {
    const ymd = event.date.toString().trim().match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (ymd) {
      let h = 20, m = 0;
      if (event.time) {
        const tm = event.time.toString().match(/(\d{1,2}):(\d{2})/);
        if (tm) {
          h = parseInt(tm[1], 10);
          m = parseInt(tm[2], 10);
        }
      }
      startDate = new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10), h, m);
    }
  }

  const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);

  const formatUtc = (d) => {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Apple Event Invitation System//AR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:event-${event.id || Date.now()}@invitation-system.local`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(startDate)}`,
    `DTEND:${formatUtc(endDate)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  const safeFilename = title.replace(/[\\/:*?"<>|]/g, '_');
  link.setAttribute('download', `${safeFilename}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function GuestPortal({
  eventData,
  guests,
  setGuests,
  activeGuestId,
  setActiveGuestId,
  refreshData,
  isGuestMode,
  showConfirmation
}) {
  const [invitationGroup, setInvitationGroup] = useState(null); // { owner, dependents, event, isLocked }
  const [rsvpLoadingMap, setRsvpLoadingMap] = useState({});

  const urlGuestParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('guest') : null;
  const effectiveLookupId = urlGuestParam || activeGuestId;

  // Fetch full invitation group from API
  useEffect(() => {
    if (effectiveLookupId) {
      fetch(`/api/guests/${effectiveLookupId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.guest) {
            setInvitationGroup({
              owner: data.guest,
              dependents: data.dependents || [],
              event: data.event || null,
              isLocked: Boolean(data.isLocked)
            });
          }
        })
        .catch(() => {});
    }
  }, [effectiveLookupId]);

  // Fallback to local guests array if API group not loaded yet (e.g. during offline admin preview)
  const resolvedOwner = useMemo(() => {
    if (invitationGroup?.owner) return invitationGroup.owner;
    if (!guests || guests.length === 0) return null;
    const direct = guests.find(g => g.id === effectiveLookupId || g.invite_token === effectiveLookupId);
    if (direct) {
      if (direct.parent_guest_id) {
        return guests.find(g => g.id === direct.parent_guest_id) || direct;
      }
      return direct;
    }
    return guests.find(g => !g.parent_guest_id) || guests[0];
  }, [invitationGroup, guests, effectiveLookupId]);

  const resolvedDependents = useMemo(() => {
    if (invitationGroup?.dependents) return invitationGroup.dependents;
    if (!resolvedOwner || !guests) return [];
    return guests.filter(g => g.parent_guest_id === resolvedOwner.id);
  }, [invitationGroup, resolvedOwner, guests]);

  const activeEv = invitationGroup?.event || eventData;
  const isLocked = Boolean(invitationGroup?.isLocked);

  // All individual attendees in this invitation unit (Owner first, then Dependents)
  const allMembers = useMemo(() => {
    if (!resolvedOwner) return [];
    return [
      { ...resolvedOwner, isOwner: true },
      ...resolvedDependents.map(d => ({ ...d, isOwner: false }))
    ];
  }, [resolvedOwner, resolvedDependents]);

  // Greeting Text (Phase 4 Req 2)
  const greetingText = useMemo(() => {
    return getGreetingText(resolvedDependents);
  }, [resolvedDependents]);

  // Formatted unified date & time (Phase 4 Req 6)
  const formattedDateTime = useMemo(() => {
    return formatArabicDateTime(activeEv?.date, activeEv?.time);
  }, [activeEv?.date, activeEv?.time]);

  if (!resolvedOwner) {
    return (
      <div className="apple-card" style={{ textAlign: 'center', padding: '40px', maxWidth: '430px', margin: '0 auto', direction: 'rtl' }}>
        <p style={{ color: 'var(--text-secondary)' }}>لا يوجد ضيف محدد للمعاينة. قم بإضافة مدعوين من لوحة التحكم.</p>
      </div>
    );
  }

  // Handle Independent RSVP per person (Phase 4 Req 1 & 4)
  const handleMemberRSVP = async (memberId, status) => {
    if (isLocked) {
      alert('انتهت فترة الرد على الدعوة لانتهاء موعد المناسبة.');
      return;
    }

    setRsvpLoadingMap(prev => ({ ...prev, [memberId]: true }));
    try {
      const res = await fetch(`/api/guests/${memberId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'فشل تحديث الرد');
      }

      const result = await res.json();

      // Update local invitationGroup state
      setInvitationGroup(prev => {
        if (!prev) return prev;
        const newOwner = prev.owner.id === memberId ? { ...prev.owner, status } : prev.owner;
        const newDeps = prev.dependents.map(d => d.id === memberId ? { ...d, status } : d);
        return {
          ...prev,
          owner: newOwner,
          dependents: newDeps
        };
      });

      // Update parent list if available
      if (setGuests && guests) {
        setGuests(guests.map(g => g.id === memberId ? { ...g, status } : g));
      }

      if (status === 'accepted') {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 }
        });
        const targetPerson = allMembers.find(m => m.id === memberId);
        if (showConfirmation) {
          showConfirmation('تم تأكيد الحضور!', `يسرنا تأكيد حضور (${targetPerson?.name || 'الضيف'})، تم إصدار بطاقة الدخول الخاصة به.`);
        }
      } else if (status === 'declined') {
        if (showConfirmation) {
          showConfirmation('تم تسجيل الاعتذار', 'نشكرك على إبلاغنا ونتمنى لك كل التوفيق.', 'info');
        }
      }

      if (refreshData) refreshData();
    } catch (err) {
      alert(err.message);
    } finally {
      setRsvpLoadingMap(prev => ({ ...prev, [memberId]: false }));
    }
  };

  // Open Maps Link (Phase 4 Req 5)
  const handleOpenMaps = () => {
    const rawLink = activeEv?.mapLink;
    if (rawLink && rawLink.trim() && rawLink !== 'https://maps.google.com') {
      window.open(rawLink, '_blank', 'noopener,noreferrer');
    } else if (activeEv?.location) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeEv.location)}`, '_blank', 'noopener,noreferrer');
    } else {
      window.open('https://maps.google.com', '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="guest-portal-wrapper" style={{ direction: 'rtl' }}>
      {/* Top Banner selector (Only in Admin Preview mode) */}
      {!isGuestMode && (
        <div className="apple-card" style={{ width: '100%', maxWidth: '430px', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem' }}>
            <Smartphone className="pink-dark" size={18} style={{ color: 'var(--pink-primary)' }} />
            <span>معاينة شاشة الضيف:</span>
          </div>
          <select
            className="apple-input"
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.84rem' }}
            value={resolvedOwner.id}
            onChange={(e) => {
              setActiveGuestId(e.target.value);
              setInvitationGroup(null);
            }}
          >
            {(guests || []).filter(g => !g.parent_guest_id).map(g => {
              const deps = (guests || []).filter(d => d.parent_guest_id === g.id);
              return (
                <option key={g.id} value={g.id}>
                  {g.name} {deps.length > 0 ? `(+${deps.length} مرافقين)` : '(دعوة فردية)'}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Realistic Mobile Screen Frame (Mobile-first responsive) */}
      <div className="guest-phone-mockup">
        {/* Dynamic Island / Top Notch */}
        <div className="phone-top-island">
          <div className="phone-speaker-pill">
            <div className="phone-camera-dot"></div>
          </div>
        </div>

        {/* Phone Screen Body Content */}
        <div className="phone-screen-body">

          {/* Invitation Header Tag */}
          <div style={{ textAlign: 'center' }}>
            <span
              className={resolvedDependents.length === 0 ? "ios-badge ios-badge-gold" : "ios-badge ios-badge-pink"}
              style={{ padding: '6px 18px', fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Mail size={15} />
              {resolvedDependents.length === 0
                ? 'دعوة شخصية خاصة'
                : `دعوة عائلية لـ (${allMembers.length}) مدعوين`}
            </span>
          </div>

          {/* Main Event Details Card */}
          <div style={{
            background: '#ffffff',
            border: '1.5px solid var(--apple-border-gold)',
            borderRadius: '22px',
            padding: '20px 16px',
            textAlign: 'center',
            boxShadow: '0 8px 25px rgba(64,123,161,0.08)'
          }}>
            <h1 style={{ fontSize: '1.35rem', color: '#407BA1', margin: '0 0 6px 0', fontWeight: 800 }}>
              {activeEv?.title || 'مناسبة خاصة'}
            </h1>
            <div style={{ height: '1.5px', background: 'linear-gradient(to right, transparent, #407BA1, transparent)', margin: '10px auto', width: '60%' }}></div>

            {/* Event Card Image */}
            {activeEv?.cardImage && (
              <div style={{ margin: '12px 0 16px 0', width: '100%', textAlign: 'center' }}>
                <img
                  src={activeEv.cardImage}
                  alt="كرت الدعوة"
                  style={{
                    width: '100%',
                    maxHeight: '380px',
                    borderRadius: '16px',
                    objectFit: 'contain',
                    boxShadow: '0 8px 24px rgba(64,123,161,0.12)',
                    border: '1px solid rgba(64, 123, 161, 0.3)',
                    cursor: 'pointer'
                  }}
                  onClick={() => window.open(activeEv.cardImage, '_blank')}
                  title="اضغط لتكبير صورة الكرت"
                />
              </div>
            )}

            {/* Dynamic Greeting Banner (Phase 4 Req 2) */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(253, 242, 245, 0.95), rgba(244, 165, 186, 0.2))',
              border: '1px solid rgba(244, 165, 186, 0.4)',
              borderRadius: '16px',
              padding: '14px 12px',
              margin: '12px 0 16px 0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--pink-dark)', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px' }}>
                <Sparkles size={16} /> ترحيب
              </div>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--pink-dark)', fontWeight: 800, margin: '2px 0' }}>
                {greetingText}
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                يسرنا ويسعدنا دعوتكم لحضور حفلنا وتكتمل فرحتنا بمشاركتكم
              </p>
            </div>

            {/* Event Time & Location Details with Unified Date Format (Phase 4 Req 6) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', textAlign: 'right', fontSize: '0.82rem', marginBottom: '14px' }}>
              {/* Unified Date & Time */}
              {formattedDateTime && (
                <div style={{ background: 'rgba(0, 0, 0, 0.03)', padding: '10px 14px', borderRadius: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <Calendar size={18} style={{ color: '#407BA1', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>موعد المناسبة</strong>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formattedDateTime}</span>
                  </div>
                </div>
              )}

              {/* Location */}
              {activeEv?.location && (
                <div style={{ background: 'rgba(0, 0, 0, 0.03)', padding: '10px 14px', borderRadius: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <MapPin size={18} style={{ color: '#407BA1', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>المكان</strong>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{activeEv.location}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons: Open Maps & Add to Calendar (Phase 4 Req 5) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className="apple-btn apple-btn-secondary"
                style={{ padding: '8px 12px', fontSize: '0.82rem', fontWeight: 700, justifyContent: 'center' }}
                onClick={handleOpenMaps}
              >
                <Navigation size={15} /> افتح الموقع
              </button>

              <button
                type="button"
                className="apple-btn apple-btn-secondary"
                style={{ padding: '8px 12px', fontSize: '0.82rem', fontWeight: 700, justifyContent: 'center' }}
                onClick={() => downloadIcsCalendar(activeEv)}
              >
                <CalendarPlus size={15} /> أضف للتقويم
              </button>
            </div>

          </div>

          {/* Event Closed / Locked Banner (Phase 4 Req 4) */}
          {isLocked && (
            <div style={{
              background: '#fef2f2',
              border: '1.5px solid #ef4444',
              borderRadius: '16px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#991b1b',
              fontSize: '0.85rem',
              fontWeight: 700
            }}>
              <Lock size={18} />
              <span>انتهى موعد المناسبة — تم إغلاق استقبال وتعديل الردود.</span>
            </div>
          )}

          {/* Section: One Card Per Person in Invitation (Phase 4 Req 1 & 3) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '0 4px' }}>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                تأكيد وبطاقات المدعوين ({allMembers.length})
              </h3>
              {allMembers.length > 1 && (
                <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  تأكيد مستقل لكل مدعو
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {allMembers.map((member) => {
                const memberStatus = member.status || 'pending';
                const isMemberLoading = Boolean(rsvpLoadingMap[member.id]);

                const qrPayload = JSON.stringify({
                  code: member.ticketCode,
                  id: member.id,
                  name: member.name,
                  eventId: activeEv?.id
                });

                return (
                  <div
                    key={member.id}
                    style={{
                      background: '#ffffff',
                      border: memberStatus === 'accepted'
                        ? '1.5px solid #22c55e'
                        : memberStatus === 'declined'
                        ? '1.5px solid #f87171'
                        : '1.5px solid rgba(64, 123, 161, 0.25)',
                      borderRadius: '18px',
                      padding: '16px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Member Top Bar: Name & Dependent Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                      <div>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block' }}>
                          {member.isOwner ? 'صاحب الدعوة:' : 'مرافق مدعو:'}
                        </span>
                        <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--pink-dark)', margin: '2px 0 0 0' }}>
                          {member.name}
                        </h4>
                      </div>

                      {/* Status Tag */}
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '50px',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        background: memberStatus === 'accepted' ? '#dcfce7' : memberStatus === 'declined' ? '#fee2e2' : '#fef3c7',
                        color: memberStatus === 'accepted' ? '#15803d' : memberStatus === 'declined' ? '#b91c1c' : '#b45309',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {memberStatus === 'accepted' && <><Check size={14} /> تم تأكيد الحضور</>}
                        {memberStatus === 'declined' && <><X size={14} /> معتذر عن الحضور</>}
                        {memberStatus === 'pending' && <><Clock size={14} /> بانتظار الرد</>}
                      </span>
                    </div>

                    {/* State 1: Pending -> Independent Confirm / Decline Buttons (Req 1) */}
                    {memberStatus === 'pending' && !isLocked && (
                      <div style={{ marginTop: '12px' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px', textAlign: 'center' }}>
                          هل سيشرفنا بالحضور؟
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <button
                            type="button"
                            className="apple-btn apple-btn-success-large"
                            style={{ padding: '9px 12px', fontSize: '0.86rem', fontWeight: 800, justifyContent: 'center' }}
                            disabled={isMemberLoading}
                            onClick={() => handleMemberRSVP(member.id, 'accepted')}
                          >
                            <Check size={18} /> تأكيد الحضور
                          </button>
                          <button
                            type="button"
                            className="apple-btn apple-btn-decline-large"
                            style={{ padding: '9px 12px', fontSize: '0.86rem', fontWeight: 800, justifyContent: 'center' }}
                            disabled={isMemberLoading}
                            onClick={() => handleMemberRSVP(member.id, 'declined')}
                          >
                            <X size={18} /> الاعتذار
                          </button>
                        </div>
                      </div>
                    )}

                    {/* State 2: Accepted -> Unique Ticket with Dedicated QR Code (Req 3) */}
                    {memberStatus === 'accepted' && (
                      <div style={{ marginTop: '10px' }}>
                        <div className="wallet-pass" style={{ margin: '8px 0', border: '1px solid rgba(64,123,161,0.2)' }}>
                          {/* Pass Header */}
                          <div className="pass-header" style={{ padding: '12px 14px' }}>
                            <div>
                              <div className="pass-header-title">بطاقة دخول المناسبة</div>
                              <div className="pass-header-name" style={{ fontSize: '1.05rem' }}>{member.name}</div>
                            </div>
                            <ShieldCheck size={24} />
                          </div>

                          {/* Pass Tear Notch */}
                          <div className="pass-cutout-line">
                            <div className="notch-left"></div>
                            <div className="dashed"></div>
                            <div className="notch-right"></div>
                          </div>

                          {/* Pass Body with Unique QR per person (Phase 4 Req 3) */}
                          <div className="pass-body" style={{ padding: '14px 12px' }}>
                            <div className="pass-qr-box" style={{ padding: '10px', background: '#ffffff', borderRadius: '14px' }}>
                              <QRCodeSVG value={qrPayload} size={135} level="H" includeMargin={false} />
                            </div>
                            <div style={{ marginTop: '8px' }}>
                              <div className="pass-code-pill" style={{ fontSize: '0.84rem', padding: '4px 14px' }}>
                                {member.ticketCode || 'EV-PASS'}
                              </div>
                            </div>
                            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>
                              ابرز هذا الباركود لمنظمي الحفل عند الدخول
                            </p>
                          </div>
                        </div>

                        {/* Change response button if not locked (Phase 4 Req 4) */}
                        {!isLocked && (
                          <div style={{ textAlign: 'center', marginTop: '10px' }}>
                            <button
                              type="button"
                              className="apple-btn apple-btn-secondary"
                              style={{ padding: '6px 14px', fontSize: '0.78rem', color: '#dc2626', borderColor: '#fca5a5' }}
                              disabled={isMemberLoading}
                              onClick={() => handleMemberRSVP(member.id, 'declined')}
                            >
                              <RotateCcw size={13} /> تعديل الرد (الاعتذار عن الحضور)
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* State 3: Declined -> Apology message with option to change (Req 4) */}
                    {memberStatus === 'declined' && (
                      <div style={{ textAlign: 'center', padding: '12px 8px', marginTop: '4px' }}>
                        <HeartHandshake size={34} style={{ color: '#ef4444', margin: '0 auto 6px auto' }} />
                        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                          تم تسجيل الاعتذار. نشكرك على إبلاغنا ونتمنى لك دوام التوفيق.
                        </p>
                        {!isLocked && (
                          <button
                            type="button"
                            className="apple-btn apple-btn-secondary"
                            style={{ padding: '6px 14px', fontSize: '0.78rem', color: '#16a34a', borderColor: '#86efac' }}
                            disabled={isMemberLoading}
                            onClick={() => handleMemberRSVP(member.id, 'accepted')}
                          >
                            <RotateCcw size={13} /> تعديل الرد (تأكيد الحضور بدلاً من ذلك)
                          </button>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

