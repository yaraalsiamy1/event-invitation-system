import React, { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, Search, CheckCircle2, AlertTriangle, History, Camera } from 'lucide-react';

export default function GateScanner({ guests, setGuests, gateLogs, setGateLogs }) {
  const [inputVal, setInputVal] = useState('');
  const [scanResult, setScanResult] = useState(null); // { type: 'success'|'error'|'duplicate', guest, message }
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Play Web Audio chime for iOS experience
  const playChime = (isSuccess) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isSuccess) {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {}
  };

  // Check Ticket or Phone
  const handleCheckIn = (codeOrPhone) => {
    const clean = codeOrPhone.trim().toLowerCase();
    if (!clean) return;

    const guest = guests.find(g => 
      g.ticketCode.toLowerCase() === clean ||
      g.phone.includes(clean) ||
      clean.includes(g.ticketCode.toLowerCase())
    );

    if (!guest) {
      setScanResult({
        type: 'error',
        message: `الرمز أو رقم الجوال (${clean}) غير مسجل في قائمة المدعوين.`
      });
      playChime(false);
      return;
    }

    if (guest.checkedIn) {
      setScanResult({
        type: 'duplicate',
        guest,
        message: `تم تسجيل دخول صاحب هذه التذكرة سابقاً الساعة (${guest.checkInTime}). يرجى منع إعادة الدخول!`
      });
      playChime(false);
    } else {
      const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      
      // Update guest state
      setGuests(prev => prev.map(g => {
        if (g.id === guest.id) {
          return { ...g, checkedIn: true, checkInTime: timeStr };
        }
        return g;
      }));

      // Add to log
      const newLog = {
        id: Date.now(),
        name: guest.name,
        code: guest.ticketCode,
        count: guest.companions || 1,
        time: timeStr
      };

      setGateLogs(prev => [newLog, ...prev]);
      setScanResult({
        type: 'success',
        guest: { ...guest, checkInTime: timeStr },
        message: 'تم تأكيد تسجيل حضور الضيف ومرافقيه بنجاح!'
      });
      playChime(true);
    }
  };

  // Toggle Camera QR Scanner
  const toggleCamera = () => {
    if (isCameraActive) {
      const html5QrCode = new Html5Qrcode("reader");
      html5QrCode.stop().then(() => setIsCameraActive(false)).catch(() => setIsCameraActive(false));
    } else {
      setIsCameraActive(true);
      setTimeout(() => {
        const html5QrCode = new Html5Qrcode("reader");
        html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            let code = decodedText;
            try {
              const parsed = JSON.parse(decodedText);
              if (parsed.code) code = parsed.code;
            } catch(e) {}
            handleCheckIn(code);
          },
          () => {}
        ).catch(err => {
          alert('تعذر فتح كاميرا الجهاز. يمكنك استخدام الإدخال اليدوي للكود.');
          setIsCameraActive(false);
        });
      }, 300);
    }
  };

  return (
    <div className="apple-gate-scanner">
      <div className="apple-card" style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2><QrCode className="system-gold" size={24} /> جهاز فحص باركود البوابة (iOS Gate Check-in)</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          امسح رمز الـ QR من تذكرة الضيف أو أدخل كود التذكرة/رقم الجوال للتحقق والتسجيل المباشر
        </p>
      </div>

      <div className="grid-2col">
        {/* Left: Camera & Manual Entry */}
        <div>
          <div className="apple-card" style={{ padding: '20px' }}>
            <div
              id="reader"
              style={{
                width: '100%',
                minHeight: '220px',
                background: '#000',
                borderRadius: '16px',
                overflow: 'hidden',
                display: isCameraActive ? 'block' : 'none'
              }}
            ></div>

            {!isCameraActive && (
              <div style={{ height: '200px', background: 'rgba(0, 0, 0, 0.4)', border: '2px dashed var(--apple-border-gold)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                <Camera size={48} className="system-gold" style={{ marginBottom: '10px', opacity: 0.7 }} />
                <p style={{ fontSize: '0.88rem' }}>اضغط على تشغيل الكاميرا لمسح رمز الـ QR</p>
              </div>
            )}

            <button className="apple-btn apple-btn-primary btn-block" style={{ marginTop: '14px' }} onClick={toggleCamera}>
              <Camera size={18} /> {isCameraActive ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا لمسح الـ QR'}
            </button>
          </div>

          {/* Manual Entry Input */}
          <div className="apple-card">
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              أو أدخل كود التذكرة / رقم الجوال يدويًا:
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className="apple-input"
                placeholder="مثال: EV-897412 أو 0501234567"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCheckIn(inputVal)}
              />
              <button className="apple-btn apple-btn-gold" onClick={() => handleCheckIn(inputVal)}>
                <Search size={16} /> تحقق
              </button>
            </div>
          </div>
        </div>

        {/* Right: Scan Results & Log */}
        <div>
          {/* Result Card */}
          <div className="apple-card" style={{ minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            {!scanResult ? (
              <div style={{ color: 'var(--text-secondary)' }}>
                <QrCode size={54} className="system-gold" style={{ opacity: 0.4, marginBottom: '12px' }} />
                <h3>في انتظار مسح التذكرة...</h3>
                <p style={{ fontSize: '0.82rem', marginTop: '6px' }}>ستظهر نتائج التحقق من هويات الضيوف هنا فوراً.</p>
              </div>
            ) : scanResult.type === 'success' ? (
              <div>
                <CheckCircle2 size={58} style={{ color: 'var(--system-green)', margin: '0 auto 12px' }} />
                <span className="ios-badge ios-badge-green" style={{ fontSize: '0.9rem', marginBottom: '10px' }}>دخول مسموح - تذكرة معتمدة</span>
                <h2 style={{ fontSize: '1.4rem', marginTop: '8px' }}>{scanResult.guest.name}</h2>
                
                <div style={{ background: 'rgba(48, 209, 88, 0.08)', border: '1px solid rgba(48, 209, 88, 0.3)', borderRadius: '14px', padding: '14px', marginTop: '14px', textAlign: 'right', fontSize: '0.85rem' }}>
                  <p><strong>الجوال:</strong> {scanResult.guest.phone}</p>
                  <p><strong>عدد المرافقين:</strong> {scanResult.guest.companions || 1} أشخاص</p>
                  <p><strong>كود التذكرة:</strong> <code>{scanResult.guest.ticketCode}</code></p>
                  <p><strong>وقت تسجيل الدخول:</strong> {scanResult.guest.checkInTime}</p>
                </div>
              </div>
            ) : (
              <div>
                <AlertTriangle size={58} style={{ color: 'var(--system-red)', margin: '0 auto 12px' }} />
                <span className="ios-badge ios-badge-red" style={{ fontSize: '0.9rem', marginBottom: '10px' }}>تنبيه: محاولة غير صالحة</span>
                {scanResult.guest && <h2 style={{ fontSize: '1.3rem', marginTop: '8px' }}>{scanResult.guest.name}</h2>}
                <p style={{ color: 'var(--system-red)', marginTop: '10px', fontSize: '0.9rem' }}>{scanResult.message}</p>
              </div>
            )}
          </div>

          {/* Activity Log */}
          <div className="apple-card">
            <div className="card-title-row">
              <h3><History className="system-gold" size={18} /> سجل الحضور الفوري عند البوابة</h3>
              <small style={{ color: 'var(--text-secondary)' }}>{gateLogs.length} سجلات</small>
            </div>
            
            <ul style={{ listStyle: 'none', maxHeight: '180px', overflowY: 'auto' }}>
              {gateLogs.length === 0 ? (
                <li style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '15px' }}>لم يتم تسجيل أي حضور حتى الآن</li>
              ) : (
                gateLogs.slice(0, 10).map(log => (
                  <li key={log.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', fontSize: '0.85rem' }}>
                    <div>
                      <strong>{log.name}</strong> <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>({log.count} أشخاص)</span>
                    </div>
                    <div style={{ color: 'var(--system-gold)' }}>{log.time}</div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
