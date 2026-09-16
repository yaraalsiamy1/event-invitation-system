import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { Smartphone, Calendar, Clock, MapPin, CheckCircle, XCircle, Download, ShieldCheck, HeartHandshake } from 'lucide-react';

export default function GuestPortal({ eventData, guests, setGuests, activeGuestId, setActiveGuestId }) {
  const activeGuest = guests.find(g => g.id === activeGuestId) || guests[0];
  const [companions, setCompanions] = useState(activeGuest?.companions || 1);

  useEffect(() => {
    if (activeGuest) {
      setCompanions(activeGuest.companions || 1);
    }
  }, [activeGuestId]);

  if (!activeGuest) {
    return (
      <div class="apple-card" style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>لا يوجد ضيف محدد للمعاينة. قم بإضافة مدعوين من لوحة التحكم.</p>
      </div>
    );
  }

  // Handle RSVP Action
  const handleRSVP = (status) => {
    setGuests(prev => prev.map(g => {
      if (g.id === activeGuest.id) {
        return { ...g, status, companions: status === 'accepted' ? companions : g.companions };
      }
      return g;
    }));

    if (status === 'accepted') {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  };

  const qrPayload = JSON.stringify({
    code: activeGuest.ticketCode,
    id: activeGuest.id,
    name: activeGuest.name,
    phone: activeGuest.phone,
    count: activeGuest.companions
  });

  return (
    <div class="apple-guest-portal">
      {/* Top Banner selector */}
      <div class="apple-card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
          <Smartphone class="system-gold" size={18} />
          <span>معاينة واجهة iPhone الفاتحة الخاصة بالضيف:</span>
        </div>
        <select
          class="apple-input"
          style={{ width: 'auto', padding: '6px 14px', fontSize: '0.85rem' }}
          value={activeGuest.id}
          onChange={(e) => setActiveGuestId(e.target.value)}
        >
          {guests.map(g => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.phone}) - [{g.status === 'accepted' ? 'مقبول' : g.status === 'declined' ? 'معتذر' : 'بانتظار'}]
            </option>
          ))}
        </select>
      </div>

      {/* iPhone Simulator Frame */}
      <div class="iphone-frame">
        <div style={{ background: '#f9f9fb', borderRadius: '36px', padding: '24px 16px', minHeight: '620px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Header Tag */}
          <div style={{ textAlign: 'center' }}>
            <span class="ios-badge ios-badge-gold" style={{ padding: '6px 16px', fontSize: '0.82rem' }}>
              ✉️ دعوة خاصة رسمية
            </span>
          </div>

          {/* Invitation Card */}
          <div style={{ background: '#ffffff', border: '1px solid var(--apple-border-gold)', borderRadius: '20px', padding: '24px 18px', textAlign: 'center', boxShadow: '0 8px 25px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontSize: '1.5rem', color: '#997a15', marginBottom: '8px' }}>{eventData.title}</h2>
            <div style={{ color: '#d4af37', letterSpacing: '4px', margin: '8px 0', fontSize: '0.8rem' }}>❖ ❖ ❖</div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>يسرنا ويسعدنا دعوتكم لحضور حفلنا وتكتمل فرحتنا بمشاركتكم</p>

            <div style={{ background: 'rgba(212, 175, 55, 0.08)', borderRadius: '14px', padding: '12px', marginBottom: '18px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>المكرم / المكرمة:</span>
              <h3 style={{ fontSize: '1.25rem', color: '#997a15', fontWeight: 800 }}>{activeGuest.name}</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'right', fontSize: '0.82rem' }}>
              <div style={{ background: 'rgba(0, 0, 0, 0.03)', padding: '10px', borderRadius: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Calendar size={16} style={{ color: '#d4af37' }} />
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>التاريخ</strong>
                  <span>{eventData.date}</span>
                </div>
              </div>
              <div style={{ background: 'rgba(0, 0, 0, 0.03)', padding: '10px', borderRadius: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Clock size={16} style={{ color: '#d4af37' }} />
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>الوقت</strong>
                  <span>{eventData.time}</span>
                </div>
              </div>
              <div style={{ gridColumn: 'span 2', background: 'rgba(0, 0, 0, 0.03)', padding: '10px', borderRadius: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <MapPin size={16} style={{ color: '#d4af37' }} />
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>المكان</strong>
                  <span>{eventData.location}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pending State */}
          {activeGuest.status === 'pending' && (
            <div class="apple-card" style={{ padding: '18px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '4px' }}>هل ستتشرفنا بالحضور؟</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>يرجى تأكيد القبول لتوليد باركود تذكرة الـ QR الخاصة بك</p>

              <div class="form-group" style={{ textAlign: 'right', marginBottom: '14px' }}>
                <label style={{ fontSize: '0.8rem' }}>عدد المرافقين معك:</label>
                <select
                  class="apple-input"
                  style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                  value={companions}
                  onChange={(e) => setCompanions(parseInt(e.target.value, 10))}
                >
                  <option value={1}>شخص واحد (أنا فقط)</option>
                  <option value={2}>شخصان (2)</option>
                  <option value={3}>3 أشخاص</option>
                  <option value={4}>4 أشخاص</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button class="apple-btn apple-btn-success" style={{ flex: 1 }} onClick={() => handleRSVP('accepted')}>
                  <CheckCircle size={16} /> قبول الدعوة
                </button>
                <button class="apple-btn apple-btn-danger" style={{ flex: 1 }} onClick={() => handleRSVP('declined')}>
                  <XCircle size={16} /> اعتذار
                </button>
              </div>
            </div>
          )}

          {/* Declined State */}
          {activeGuest.status === 'declined' && (
            <div class="apple-card" style={{ padding: '24px', textAlign: 'center', borderColor: 'var(--system-red)' }}>
              <HeartHandshake size={48} style={{ color: 'var(--system-red)', margin: '0 auto 10px' }} />
              <h3 style={{ color: 'var(--system-red)', marginBottom: '6px' }}>تم تسجيل اعتذارك بنجاح</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>نشكرك على إبلاغنا ونتمنى لك كل التوفيق.</p>
              <button class="apple-btn apple-btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 14px' }} onClick={() => handleRSVP('pending')}>
                تغيير الرغبة
              </button>
            </div>
          )}

          {/* Accepted -> Light Apple Wallet Ticket */}
          {activeGuest.status === 'accepted' && (
            <div class="wallet-pass-container">
              <div class="wallet-pass">
                {/* Header */}
                <div class="pass-header">
                  <div>
                    <div class="pass-header-title">APPLE WALLET EVENT PASS</div>
                    <div class="pass-header-name">{activeGuest.name}</div>
                  </div>
                  <ShieldCheck size={26} />
                </div>

                {/* Tear Cutout */}
                <div class="pass-cutout-line">
                  <div class="notch-left"></div>
                  <div class="dashed"></div>
                  <div class="notch-right"></div>
                </div>

                {/* Pass Body with QR Code */}
                <div class="pass-body">
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>ابرز هذا الرمز لمنظمي البوابة عند الوصول</p>
                  
                  <div class="pass-qr-box">
                    <QRCodeSVG value={qrPayload} size={150} level="H" includeMargin={false} />
                  </div>

                  <div>
                    <div class="pass-code-pill">{activeGuest.ticketCode}</div>
                  </div>

                  <div class="pass-info-grid">
                    <div>
                      <strong>عدد الحضور:</strong> {activeGuest.companions || 1} أشخاص
                    </div>
                    <div>
                      <strong>حالة التذكرة:</strong> <span style={{ color: 'var(--system-green)' }}>مقبولة ومعتمدة</span>
                    </div>
                  </div>
                </div>

                <div class="pass-footer">
                  <button class="apple-btn apple-btn-gold btn-block" style={{ fontSize: '0.85rem' }} onClick={() => alert('تم حفظ التذكرة محلياً بالجوال!')}>
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
