import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { Smartphone, Calendar, Clock, MapPin, CheckCircle2, XCircle, Download, ShieldCheck, HeartHandshake, Check, X } from 'lucide-react';

export default function GuestPortal({ eventData, guests, setGuests, activeGuestId, setActiveGuestId, refreshData }) {
  const [guestRecord, setGuestRecord] = useState(null);
  const [guestEvent, setGuestEvent] = useState(null);

  React.useEffect(() => {
    if (activeGuestId) {
      fetch(`/api/guests/${activeGuestId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.guest) {
            setGuestRecord(data.guest);
            if (data.event) setGuestEvent(data.event);
          }
        })
        .catch(() => {});
    }
  }, [activeGuestId]);

  const activeGuest = guestRecord || (guests || []).find(g => g.id === activeGuestId) || guests[0];
  const activeEv = guestEvent || eventData;

  if (!activeGuest) {
    return (
      <div class="apple-card" style={{ textAlign: 'center', padding: '40px' }}>
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
    }

    if (refreshData) refreshData();
  };

  const qrPayload = JSON.stringify({
    code: activeGuest.ticketCode,
    id: activeGuest.id,
    name: activeGuest.name,
    phone: activeGuest.phone
  });

  return (
    <div class="apple-guest-portal">
      {/* Top Banner selector */}
      <div class="apple-card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
          <Smartphone class="pink-dark" size={18} style={{ color: 'var(--pink-primary)' }} />
          <span>معاينة واجهة iPhone الفاتحة الخاصة بالضيف:</span>
        </div>
        <select
          class="apple-input"
          style={{ width: 'auto', padding: '6px 14px', fontSize: '0.85rem' }}
          value={activeGuest.id}
          onChange={(e) => setActiveGuestId(e.target.value)}
        >
          {(guests || []).map(g => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.phone}) - [{g.status === 'accepted' ? 'مقبول' : g.status === 'declined' ? 'معتذر' : 'بانتظار'}]
            </option>
          ))}
        </select>
      </div>

      {/* iPhone Simulator Frame */}
      <div class="iphone-frame">
        <div style={{ background: '#fff5f7', borderRadius: '36px', padding: '24px 16px', minHeight: '620px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Header Tag */}
          <div style={{ textAlign: 'center' }}>
            <span class="ios-badge ios-badge-pink" style={{ padding: '6px 18px', fontSize: '0.85rem' }}>
              ✉️ دعوة خاصة رسمية
            </span>
          </div>

          {/* Invitation Card */}
          <div style={{ background: '#ffffff', border: '1.5px solid var(--apple-border-gold)', borderRadius: '22px', padding: '24px 18px', textAlign: 'center', boxShadow: '0 8px 25px rgba(236,72,153,0.06)' }}>
            <h2 style={{ fontSize: '1.55rem', color: '#997a15', marginBottom: '8px', fontWeight: 800 }}>{activeEv?.title}</h2>
            <div style={{ color: '#d4af37', letterSpacing: '4px', margin: '8px 0', fontSize: '0.8rem' }}>❖ ❖ ❖</div>
            
            {/* Display Event Card Image if available */}
            {activeEv?.cardImage && (
              <div style={{ margin: '14px 0' }}>
                <img src={activeEv.cardImage} alt="كرت الدعوة" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '14px', objectFit: 'contain' }} />
              </div>
            )}

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>يسرنا ويسعدنا دعوتكم لحضور حفلنا وتكتمل فرحتنا بمشاركتكم</p>

            <div style={{ background: 'rgba(236, 72, 153, 0.08)', borderRadius: '16px', padding: '14px', marginBottom: '18px', border: '1px solid rgba(236, 72, 153, 0.15)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>المكرم / المكرمة:</span>
              <h3 style={{ fontSize: '1.35rem', color: 'var(--pink-dark)', fontWeight: 800 }}>{activeGuest.name}</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'right', fontSize: '0.84rem' }}>
              <div style={{ background: 'rgba(0, 0, 0, 0.03)', padding: '12px', borderRadius: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Calendar size={18} style={{ color: '#d4af37' }} />
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>التاريخ</strong>
                  <span>{activeEv?.date}</span>
                </div>
              </div>
              <div style={{ background: 'rgba(0, 0, 0, 0.03)', padding: '12px', borderRadius: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Clock size={18} style={{ color: '#d4af37' }} />
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>الوقت</strong>
                  <span>{activeEv?.time}</span>
                </div>
              </div>
              <div style={{ gridColumn: 'span 2', background: 'rgba(0, 0, 0, 0.03)', padding: '12px', borderRadius: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <MapPin size={18} style={{ color: '#d4af37' }} />
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>المكان</strong>
                  <span>{activeEv?.location}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pending State -> Prominent & Accessible Large RSVP Buttons */}
          {activeGuest.status === 'pending' && (
            <div class="apple-card" style={{ padding: '22px 18px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '6px', fontWeight: 800 }}>هل ستتشرفنا بالحضور؟</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                يرجى تحديد اختيارك لتوليد تذكرة وباركود الحضور الخاص بك
              </p>

              {/* Ultra Clear Large Buttons for All Ages */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <button class="apple-btn apple-btn-success-large btn-block" onClick={() => handleRSVP('accepted')}>
                  <Check size={26} /> تأكيد الحضور ✅
                </button>
                <button class="apple-btn apple-btn-decline-large btn-block" onClick={() => handleRSVP('declined')}>
                  <X size={26} /> الاعتذار عن الحضور ❌
                </button>
              </div>
            </div>
          )}

          {/* Declined State */}
          {activeGuest.status === 'declined' && (
            <div class="apple-card" style={{ padding: '24px', textAlign: 'center', borderColor: 'var(--system-red)' }}>
              <HeartHandshake size={52} style={{ color: 'var(--system-red)', margin: '0 auto 12px' }} />
              <h3 style={{ color: 'var(--system-red)', marginBottom: '6px', fontSize: '1.25rem', fontWeight: 800 }}>تم تسجيل اعتذارك بنجاح</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>نشكرك على إبلاغنا ونتمنى لك كل التوفيق.</p>
              <button class="apple-btn apple-btn-secondary" style={{ fontSize: '0.85rem', padding: '8px 16px' }} onClick={() => handleRSVP('pending')}>
                تغيير الرغبة
              </button>
            </div>
          )}

          {/* Accepted State -> Apple Wallet Ticket */}
          {activeGuest.status === 'accepted' && (
            <div class="wallet-pass-container">
              <div class="wallet-pass">
                {/* Header */}
                <div class="pass-header">
                  <div>
                    <div class="pass-header-title">APPLE WALLET EVENT PASS</div>
                    <div class="pass-header-name">{activeGuest.name}</div>
                  </div>
                  <ShieldCheck size={28} />
                </div>

                {/* Tear Notch */}
                <div class="pass-cutout-line">
                  <div class="notch-left"></div>
                  <div class="dashed"></div>
                  <div class="notch-right"></div>
                </div>

                {/* Body */}
                <div class="pass-body">
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>ابرز هذا الرمز لمنظمي المناسبة عند الوصول</p>
                  
                  <div class="pass-qr-box">
                    <QRCodeSVG value={qrPayload} size={160} level="H" includeMargin={false} />
                  </div>

                  <div>
                    <div class="pass-code-pill">{activeGuest.ticketCode}</div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(244,114,182,0.15)', paddingTop: '12px', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--system-green)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <CheckCircle2 size={18} /> تذكرة صالحة ومؤكدة باسمك
                    </span>
                  </div>
                </div>

                <div class="pass-footer">
                  <button class="apple-btn apple-btn-pink btn-block" style={{ fontSize: '0.88rem' }} onClick={() => alert('تم حفظ بطاقة الدخول محلياً على الجوال!')}>
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
