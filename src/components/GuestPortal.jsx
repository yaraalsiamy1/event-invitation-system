import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { Smartphone, Calendar, Clock, MapPin, CheckCircle2, XCircle, Download, ShieldCheck, HeartHandshake, Check, X, Mail, Users, UserCheck, Sparkles } from 'lucide-react';

export default function GuestPortal({ eventData, guests, setGuests, activeGuestId, setActiveGuestId, refreshData, isGuestMode, showConfirmation }) {
  const [guestRecord, setGuestRecord] = useState(null);
  const [guestEvent, setGuestEvent] = useState(null);

  const urlGuestId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('guest') : null;
  const effectiveGuestId = urlGuestId || activeGuestId;

  React.useEffect(() => {
    if (effectiveGuestId) {
      fetch(`/api/guests/${effectiveGuestId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.guest) {
            setGuestRecord(data.guest);
            if (data.event) setGuestEvent(data.event);
          }
        })
        .catch(() => {});
    }
  }, [effectiveGuestId]);

  const activeGuest = (guestRecord && guestRecord.id === effectiveGuestId) 
    ? guestRecord 
    : ((guests || []).find(g => g.id === effectiveGuestId) || guestRecord || guests[0]);

  const activeEv = guestEvent || eventData;

  if (!activeGuest) {
    return (
      <div className="apple-card" style={{ textAlign: 'center', padding: '40px', maxWidth: '430px', margin: '0 auto' }}>
        <p style={{ color: 'var(--text-secondary)' }}>لا يوجد ضيف محدد للمعاينة. قم بإضافة مدعوين من لوحة التحكم.</p>
      </div>
    );
  }

  // Handle RSVP API Call
  const handleRSVP = async (status) => {
    try {
      const res = await fetch(`/api/guests/${activeGuest.id}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        const result = await res.json();
        if (result.guest) setGuestRecord(result.guest);
      } else {
        setGuestRecord({ ...activeGuest, status });
      }
    } catch (e) {
      setGuestRecord({ ...activeGuest, status });
    }

    if (status === 'accepted') {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 }
      });
      if (showConfirmation) {
        showConfirmation('تم تأكيد الحضور بنجاح!', 'يسرنا ويسعدنا تواجدك وتأكيد حضورك معنا، تم إصدار بطاقة وتذكرة الدخول الخاصة بك!');
      }
    } else if (status === 'declined') {
      if (showConfirmation) {
        showConfirmation('تم تسجيل اعتذارك بنجاح', 'نشكرك على إبلاغنا ونتمنى لك كل التوفيق والخير.', 'info');
      }
    }

    if (refreshData) refreshData();
  };

  const guestCount = parseInt(activeGuest.count) || parseInt(activeGuest.companions) || 1;
  const isSingle = guestCount === 1;

  const qrPayload = JSON.stringify({
    code: activeGuest.ticketCode,
    id: activeGuest.id,
    name: activeGuest.name,
    phone: activeGuest.phone,
    count: guestCount
  });

  return (
    <div className="guest-portal-wrapper">
      {/* Top Banner selector (Only rendered for Admin preview mode, hidden for actual guests) */}
      {!isGuestMode && (
        <div className="apple-card" style={{ width: '100%', maxWidth: '430px', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem' }}>
            <Smartphone className="pink-dark" size={18} style={{ color: 'var(--pink-primary)' }} />
            <span>معاينة شاشة الجوال للضيف:</span>
          </div>
          <select
            className="apple-input"
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.84rem' }}
            value={activeGuest.id}
            onChange={(e) => setActiveGuestId(e.target.value)}
          >
            {(guests || []).map(g => {
              const gCount = parseInt(g.count) || parseInt(g.companions) || 1;
              return (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.phone}) [{gCount > 1 ? `${gCount} مقاعد - ` : 'شخصية - '}{g.status === 'accepted' ? 'مقبول' : g.status === 'declined' ? 'معتذر' : 'بانتظار'}]
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Realistic Mobile Screen Frame (مقاس شاشة الجوال الفعلي) */}
      <div className="guest-phone-mockup">
        {/* Dynamic Island / Top Notch */}
        <div className="phone-top-island">
          <div className="phone-speaker-pill">
            <div className="phone-camera-dot"></div>
          </div>
        </div>

        {/* Phone Screen Body Content */}
        <div className="phone-screen-body">
          
          {/* Header Tag */}
          <div style={{ textAlign: 'center' }}>
            <span className={isSingle ? "ios-badge ios-badge-gold" : "ios-badge ios-badge-pink"} style={{ padding: '6px 18px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={15} /> {isSingle ? 'دعوة شخصية خاصة' : `دعوة مخصصة لـ (${guestCount}) مدعوين`}
            </span>
          </div>

          {/* Invitation Card */}
          <div style={{ background: '#ffffff', border: '1.5px solid var(--apple-border-gold)', borderRadius: '22px', padding: '20px 16px', textAlign: 'center', boxShadow: '0 8px 25px rgba(64,123,161,0.08)' }}>
            <h2 style={{ fontSize: '1.4rem', color: '#407BA1', marginBottom: '8px', fontWeight: 800 }}>{activeEv?.title}</h2>
            <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, #407BA1, transparent)', margin: '10px auto', width: '60%' }}></div>
            
            {/* Display Event Card Image if available - Large & Clear for Guest */}
            {activeEv?.cardImage && (
              <div style={{ margin: '14px 0', width: '100%', textAlign: 'center' }}>
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

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>يسرنا ويسعدنا دعوتكم لحضور حفلنا وتكتمل فرحتنا بمشاركتكم</p>

            {/* Guest Name & Guests Count / Personal Invite Badge */}
            <div style={{ background: 'rgba(64, 123, 161, 0.08)', borderRadius: '16px', padding: '14px 12px', marginBottom: '16px', border: '1px solid rgba(64, 123, 161, 0.2)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>المكرم / المكرمة:</span>
              <h3 style={{ fontSize: '1.35rem', color: 'var(--pink-dark)', fontWeight: 800, margin: '4px 0 6px 0' }}>{activeGuest.name}</h3>
              
              {isSingle ? (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(197, 160, 89, 0.15)',
                  color: '#9e7d3b',
                  border: '1.5px solid rgba(197, 160, 89, 0.4)',
                  padding: '5px 16px',
                  borderRadius: '50px',
                  fontSize: '0.86rem',
                  fontWeight: 800
                }}>
                  <UserCheck size={16} /> الدعوة شخصية
                </div>
              ) : (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(64, 123, 161, 0.12)',
                  color: 'var(--pink-dark)',
                  border: '1.5px solid rgba(64, 123, 161, 0.35)',
                  padding: '5px 16px',
                  borderRadius: '50px',
                  fontSize: '0.86rem',
                  fontWeight: 800
                }}>
                  <Users size={16} /> عدد المدعوين: {guestCount} أشخاص
                </div>
              )}
            </div>

            {/* Event Time & Location Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', textAlign: 'right', fontSize: '0.82rem' }}>
              <div style={{ background: 'rgba(0, 0, 0, 0.03)', padding: '10px', borderRadius: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Calendar size={16} style={{ color: '#407BA1', flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>التاريخ</strong>
                  <span>{activeEv?.date}</span>
                </div>
              </div>
              <div style={{ background: 'rgba(0, 0, 0, 0.03)', padding: '10px', borderRadius: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Clock size={16} style={{ color: '#407BA1', flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>الوقت</strong>
                  <span>{activeEv?.time}</span>
                </div>
              </div>
              <div style={{ gridColumn: 'span 2', background: 'rgba(0, 0, 0, 0.03)', padding: '10px', borderRadius: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <MapPin size={16} style={{ color: '#407BA1', flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>المكان</strong>
                  <span>{activeEv?.location}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pending State -> Prominent & Accessible Large RSVP Buttons */}
          {activeGuest.status === 'pending' && (
            <div className="apple-card" style={{ padding: '18px 14px', textAlign: 'center', marginBottom: 0 }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '4px', fontWeight: 800 }}>هل ستشرفنا بالحضور؟</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                يرجى تأكيد الحضور لتوليد تذكرة وباركود الدخول الخاص بك
              </p>

              {/* Large Clear RSVP Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button className="apple-btn apple-btn-success-large btn-block" onClick={() => handleRSVP('accepted')}>
                  <Check size={22} /> تأكيد الحضور
                </button>
                <button className="apple-btn apple-btn-decline-large btn-block" onClick={() => handleRSVP('declined')}>
                  <X size={22} /> الاعتذار عن الحضور
                </button>
              </div>
            </div>
          )}

          {/* Declined State */}
          {activeGuest.status === 'declined' && (
            <div className="apple-card" style={{ padding: '22px 16px', textAlign: 'center', borderColor: 'var(--system-red)', marginBottom: 0 }}>
              <HeartHandshake size={46} style={{ color: 'var(--system-red)', margin: '0 auto 10px' }} />
              <h3 style={{ color: 'var(--system-red)', marginBottom: '4px', fontSize: '1.2rem', fontWeight: 800 }}>تم تسجيل اعتذارك بنجاح</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 0 }}>نشكرك على إبلاغنا ونتمنى لك كل التوفيق.</p>
            </div>
          )}

          {/* Accepted State -> Apple Wallet Ticket */}
          {activeGuest.status === 'accepted' && (
            <div className="wallet-pass-container">
              <div className="wallet-pass">
                {/* Header */}
                <div className="pass-header">
                  <div>
                    <div className="pass-header-title">APPLE WALLET EVENT PASS</div>
                    <div className="pass-header-name">{activeGuest.name}</div>
                    <div style={{ fontSize: '0.82rem', opacity: 0.95, marginTop: '3px', fontWeight: 700 }}>
                      {isSingle ? 'الدعوة شخصية' : `عدد المقاعد / المدعوين: ${guestCount} أشخاص`}
                    </div>
                  </div>
                  <ShieldCheck size={28} />
                </div>

                {/* Tear Notch */}
                <div className="pass-cutout-line">
                  <div className="notch-left"></div>
                  <div className="dashed"></div>
                  <div className="notch-right"></div>
                </div>

                {/* Body */}
                <div className="pass-body">
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>ابرز هذا الرمز لمنظمي المناسبة عند الوصول</p>
                  
                  <div className="pass-qr-box">
                    <QRCodeSVG value={qrPayload} size={150} level="H" includeMargin={false} />
                  </div>

                  <div>
                    <div className="pass-code-pill">{activeGuest.ticketCode}</div>
                  </div>
                </div>

                <div className="pass-footer">
                  <button className="apple-btn apple-btn-pink btn-block" style={{ fontSize: '0.88rem' }} onClick={() => showConfirmation ? showConfirmation('تم الحفظ!', 'تم حفظ وتنزيل بطاقة الدخول للجوال بنجاح.') : alert('تم حفظ بطاقة الدخول محلياً على الجوال!')}>
                    <Download size={16} /> حفظ بطاقة الدخول للجوال
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
