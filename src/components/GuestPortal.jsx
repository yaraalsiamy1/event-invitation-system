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
  const mapLinkStr = event?.mapLink || event?.location_link || '';
  const effectiveBaseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const inviteLink = `${effectiveBaseUrl}/?guest=${guest.invite_token || guest.id}`;

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
  const [declineConfirmMemberId, setDeclineConfirmMemberId] = useState(null);

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

  // Formatted unified date (without time per user request)
  const formattedDateTime = useMemo(() => {
    return formatArabicDateOnly(activeEv?.date);
  }, [activeEv?.date]);

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

          {/* 1. Full Invitation Card Image (Without Any Frame/Border) */}
          {activeEv?.cardImage && (
            <div style={{ width: '100%', margin: '0 0 4px 0', textAlign: 'center' }}>
              <img
                src={activeEv.cardImage}
                alt="كرت الدعوة"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  borderRadius: '18px',
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer'
                }}
                onClick={() => window.open(activeEv.cardImage, '_blank')}
                title="اضغط لتكبير صورة كرت الدعوة"
              />
            </div>
          )}

          {/* 2. Honorific Header: المكرمة / [اسم الضيف] */}
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '20px 16px',
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(64,123,161,0.06)'
          }}>
            <span style={{
              display: 'block',
              fontSize: '0.96rem',
              color: 'var(--text-secondary)',
              fontWeight: 700,
              marginBottom: '6px'
            }}>
              المكرمة /
            </span>
            <h2 style={{
              fontSize: '1.45rem',
              fontWeight: 800,
              color: 'var(--pink-dark)',
              margin: '0 0 4px 0',
              lineHeight: 1.4
            }}>
              {resolvedOwner.name}
              {resolvedDependents.length > 0 && (
                <span style={{ display: 'block', fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '4px' }}>
                  ومرافقيها الكرام
                </span>
              )}
            </h2>
            <p style={{
              fontSize: '0.84rem',
              color: 'var(--text-secondary)',
              margin: '8px 0 0 0',
              lineHeight: 1.6
            }}>
              يسرنا ويسعدنا دعوتكم لحضور حفلنا وتكتمل فرحتنا بمشاركتكم
            </p>
          </div>

          {/* 3. Event Details: موعد ومكان المناسبة ونوع الدعوة */}
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '20px 16px',
            boxShadow: '0 4px 20px rgba(64,123,161,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            {/* Invitation Type Badge & Event Title */}
            <div style={{ textAlign: 'center' }}>
              <span
                className={resolvedDependents.length === 0 ? "ios-badge ios-badge-gold" : "ios-badge ios-badge-pink"}
                style={{ padding: '6px 18px', fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}
              >
                <Mail size={15} />
                {resolvedDependents.length === 0
                  ? 'دعوة شخصية'
                  : `دعوة عائلية لـ (${allMembers.length}) مدعوين`}
              </span>
              <h1 style={{ fontSize: '1.3rem', color: '#407BA1', margin: '0', fontWeight: 800 }}>
                {activeEv?.title || 'مناسبة خاصة'}
              </h1>
            </div>

            {/* Time & Location with compact small action icon-pills underneath */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', textAlign: 'right', fontSize: '0.84rem' }}>
              {/* Event Date & Add to Calendar */}
              {formattedDateTime && (
                <div style={{ background: 'rgba(0, 0, 0, 0.025)', padding: '10px 14px', borderRadius: '14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <Calendar size={18} style={{ color: '#407BA1', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.74rem' }}>موعد المناسبة</strong>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem', display: 'block' }}>{formattedDateTime}</span>
                    <button
                      type="button"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 9px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#407BA1',
                        background: '#ffffff',
                        border: '1px solid rgba(64, 123, 161, 0.25)',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        marginTop: '5px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => downloadIcsCalendar(activeEv)}
                    >
                      <CalendarPlus size={12} /> أضف للتقويم
                    </button>
                  </div>
                </div>
              )}

              {/* Event Location & Open Maps */}
              {activeEv?.location && (
                <div style={{ background: 'rgba(0, 0, 0, 0.025)', padding: '10px 14px', borderRadius: '14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <MapPin size={18} style={{ color: '#407BA1', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.74rem' }}>مكان المناسبة</strong>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem', display: 'block' }}>{activeEv.location}</span>
                    <button
                      type="button"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 9px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#407BA1',
                        background: '#ffffff',
                        border: '1px solid rgba(64, 123, 161, 0.25)',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        marginTop: '5px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={handleOpenMaps}
                    >
                      <Navigation size={12} /> افتح الموقع
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* RSVP Response Buttons (Inside the same box, phrase 'هل يسعدنا حضورك؟' deleted) */}
            {allMembers.map((member) => {
              const memberStatus = member.status || 'pending';
              const isMemberLoading = Boolean(rsvpLoadingMap[member.id]);

              return (
                <div key={member.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
                  {/* Companion Identification Tag */}
                  {!member.isOwner && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      marginTop: '12px',
                      marginBottom: '4px',
                      paddingTop: '12px',
                      borderTop: '1px dashed rgba(64, 123, 161, 0.22)'
                    }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        المرافق:
                      </span>
                      <span style={{
                        fontSize: '0.94rem',
                        color: 'var(--pink-dark)',
                        fontWeight: 800,
                        background: 'rgba(64, 123, 161, 0.08)',
                        padding: '3px 12px',
                        borderRadius: '20px'
                      }}>
                        {member.name}
                      </span>
                    </div>
                  )}

                  {/* Status Tag ONLY when accepted or declined (hidden when pending) */}
                  {memberStatus !== 'pending' && (
                    <div style={{ textAlign: 'center', marginTop: '4px' }}>
                      <span style={{
                        padding: '6px 18px',
                        borderRadius: '50px',
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        background: memberStatus === 'accepted' ? '#dcfce7' : '#fee2e2',
                        color: memberStatus === 'accepted' ? '#15803d' : '#b91c1c',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {memberStatus === 'accepted' ? (
                          <><Check size={14} /> تم قبول الدعوة {!member.isOwner ? `(لـ ${member.name})` : ''}</>
                        ) : (
                          <><X size={14} /> تم الإعتذار عن الدعوة {!member.isOwner ? `(لـ ${member.name})` : ''}</>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Pending State: Direct RSVP Buttons */}
                  {memberStatus === 'pending' && !isLocked && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '2px' }}>
                      <button
                        type="button"
                        className="apple-btn apple-btn-success-large"
                        style={{ padding: '11px 14px', fontSize: '0.92rem', fontWeight: 800, justifyContent: 'center' }}
                        disabled={isMemberLoading}
                        onClick={() => handleMemberRSVP(member.id, 'accepted')}
                      >
                        <Check size={18} /> قبول الدعوة
                      </button>
                      <button
                        type="button"
                        className="apple-btn apple-btn-decline-large"
                        style={{ padding: '11px 14px', fontSize: '0.92rem', fontWeight: 800, justifyContent: 'center' }}
                        disabled={isMemberLoading}
                        onClick={() => setDeclineConfirmMemberId(member.id)}
                      >
                        <X size={18} /> الإعتذار عن الدعوة
                      </button>
                    </div>
                  )}

                  {/* Declined Note */}
                  {memberStatus === 'declined' && (
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '4px 0 0 0', textAlign: 'center', fontWeight: 600 }}>
                      تم تسجيل الإعتذار. نشكرك على إبلاغنا ونتمنى لك دوام التوفيق.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Event Closed / Locked Banner */}
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

          {/* Accepted State: Dedicated Barcode Card Matching Reference Image */}
          {allMembers.filter(m => m.status === 'accepted').map((member) => {
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
                  border: '1.5px solid rgba(197, 160, 89, 0.35)',
                  borderRadius: '24px',
                  padding: '24px 20px',
                  textAlign: 'center',
                  boxShadow: '0 8px 30px rgba(64, 123, 161, 0.08)',
                  margin: '0 auto',
                  width: '100%'
                }}
              >
                {/* Title above QR */}
                <div style={{
                  fontSize: '0.92rem',
                  color: '#78716c',
                  fontWeight: 700,
                  marginBottom: '16px'
                }}>
                  باركود دخولك
                </div>

                {/* Centered QR Code */}
                <div style={{
                  background: '#ffffff',
                  padding: '14px',
                  borderRadius: '16px',
                  display: 'inline-block',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  marginBottom: '16px'
                }}>
                  <QRCodeSVG value={qrPayload} size={160} level="H" includeMargin={false} />
                </div>

                {/* Name below QR: المكرمة : [الاسم] */}
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  margin: '0 0 6px 0',
                  lineHeight: 1.4
                }}>
                  المكرمة : {member.name}
                </div>

                {/* Number of companions or personal invitation */}
                <div style={{
                  fontSize: '0.88rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 600
                }}>
                  {resolvedDependents.length > 0 ? `${resolvedDependents.length} مرافق` : 'دعوة شخصية'}
                </div>
              </div>
            );
          })}

          {/* Footer inside Guest Interface */}
          <footer style={{
            marginTop: '16px',
            paddingTop: '20px',
            borderTop: '1px solid rgba(64, 123, 161, 0.14)',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.84rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            flexWrap: 'wrap'
          }}>
            <span>تم تطوير النظام بواسطة</span>
            <span dir="ltr" style={{ fontWeight: 700, color: 'inherit' }}>YaraAlsiamy</span>
            <span dir="ltr" style={{ color: 'inherit' }}>&copy; 2026</span>
          </footer>

        </div>
      </div>

      {/* Decline Confirmation Dialog Modal */}
      {declineConfirmMemberId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '26px',
            padding: '28px 22px',
            maxWidth: '360px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 60px rgba(0,0,0,0.22)',
            animation: 'appleModalSlide 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{
              width: '62px',
              height: '62px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <XCircle size={36} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
              تأكيد الإعتذار عن الحضور
            </h3>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 22px 0', lineHeight: 1.5 }}>
              {allMembers.find(m => m.id === declineConfirmMemberId && !m.isOwner)
                ? `هل أنتِ متأكدة من رغبتك في الإعتذار عن الحضور للمرافق (${allMembers.find(m => m.id === declineConfirmMemberId)?.name})؟`
                : 'هل أنتِ متأكدة من رغبتك في الإعتذار عن الحضور؟'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                className="apple-btn apple-btn-secondary"
                style={{ padding: '11px 14px', fontSize: '0.9rem', fontWeight: 700, justifyContent: 'center' }}
                onClick={() => setDeclineConfirmMemberId(null)}
              >
                تراجع
              </button>

              <button
                type="button"
                className="apple-btn"
                style={{
                  padding: '11px 14px',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  justifyContent: 'center',
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)'
                }}
                onClick={() => {
                  const targetId = declineConfirmMemberId;
                  setDeclineConfirmMemberId(null);
                  handleMemberRSVP(targetId, 'declined');
                }}
              >
                تأكيد الإعتذار
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

