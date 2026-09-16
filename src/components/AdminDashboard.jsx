import React, { useState } from 'react';
import { Calendar, Users, CheckCircle2, XCircle, Clock, UserCheck, Upload, Trash2, Plus, MessageCircle, Eye } from 'lucide-react';

export default function AdminDashboard({ eventData, setEventData, guests, setGuests, setActiveGuestId, setActiveTab }) {
  const [batchText, setBatchText] = useState('');

  // Save Event Details
  const handleEventSubmit = (e) => {
    e.preventDefault();
    alert('تم حفظ تفاصيل المناسبة بنجاح!');
  };

  // Image Upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setEventData(prev => ({ ...prev, cardImage: event.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Format Saudi Phone
  const formatPhone = (phoneRaw) => {
    let clean = phoneRaw.replace(/\D/g, '');
    if (clean.startsWith('05')) {
      clean = '966' + clean.substring(1);
    } else if (clean.startsWith('5')) {
      clean = '966' + clean;
    }
    return clean;
  };

  // Process Batch Guest Import
  const handleBatchSubmit = (e) => {
    e.preventDefault();
    if (!batchText.trim()) return;

    const lines = batchText.trim().split('\n');
    const newGuests = [];

    lines.forEach(line => {
      const parts = line.split(',');
      let name = "";
      let phoneRaw = "";

      if (parts.length >= 2) {
        name = parts[0].trim();
        phoneRaw = parts[1].trim();
      } else {
        phoneRaw = parts[0].trim();
        name = "ضيف عزيز";
      }

      if (phoneRaw) {
        newGuests.push({
          id: "g_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
          name: name || "ضيف عزيز",
          phone: formatPhone(phoneRaw),
          status: "pending",
          companions: 1,
          ticketCode: "EV-" + Math.floor(100000 + Math.random() * 900000),
          checkedIn: false,
          checkInTime: null
        });
      }
    });

    setGuests(prev => [...prev, ...newGuests]);
    setBatchText('');
    alert(`تم إضافة ${newGuests.length} مدعو بنجاح!`);
  };

  // Quick Sample Data Load
  const handleLoadSample = () => {
    const samples = [
      { id: "g_1", name: "عبدالله المحمد", phone: "966501234567", status: "accepted", companions: 2, ticketCode: "EV-897412", checkedIn: false, checkInTime: null },
      { id: "g_2", name: "خالد العتيبي", phone: "966559876543", status: "pending", companions: 1, ticketCode: "EV-654321", checkedIn: false, checkInTime: null },
      { id: "g_3", name: "فهد الدوسري", phone: "966541112233", status: "declined", companions: 1, ticketCode: "EV-112233", checkedIn: false, checkInTime: null },
      { id: "g_4", name: "د. سارة الشمري", phone: "966567778899", status: "accepted", companions: 3, ticketCode: "EV-778899", checkedIn: true, checkInTime: "08:15 مساءً" }
    ];
    setGuests(samples);
  };

  // Delete Guest
  const handleDeleteGuest = (id) => {
    if (confirm('هل ترغب بحذف هذا المدعو؟')) {
      setGuests(prev => prev.filter(g => g.id !== id));
    }
  };

  // Stats
  const total = guests.length;
  const accepted = guests.filter(g => g.status === 'accepted').length;
  const declined = guests.filter(g => g.status === 'declined').length;
  const pending = guests.filter(g => g.status === 'pending').length;
  const checkedIn = guests.filter(g => g.checkedIn).length;

  return (
    <div class="apple-dashboard">
      <div class="grid-2col">
        {/* Left: Event Details Form */}
        <div class="apple-card">
          <div class="card-title-row">
            <h2><Calendar class="system-gold" size={22} /> تفاصيل المناسبة وكرت الدعوة</h2>
            <span class="ios-badge ios-badge-gold">إعداد أبل</span>
          </div>

          <form onSubmit={handleEventSubmit}>
            <div class="form-group">
              <label>عنوان المناسبة / الحفل</label>
              <input
                type="text"
                class="apple-input"
                value={eventData.title}
                onChange={(e) => setEventData({ ...eventData, title: e.target.value })}
                required
              />
            </div>

            <div class="grid-2col" style={{ gap: '12px' }}>
              <div class="form-group">
                <label>تاريخ المناسبة</label>
                <input
                  type="date"
                  class="apple-input"
                  value={eventData.date}
                  onChange={(e) => setEventData({ ...eventData, date: e.target.value })}
                  required
                />
              </div>
              <div class="form-group">
                <label>التوقيت</label>
                <input
                  type="time"
                  class="apple-input"
                  value={eventData.time}
                  onChange={(e) => setEventData({ ...eventData, time: e.target.value })}
                  required
                />
              </div>
            </div>

            <div class="form-group">
              <label>مكان الحفل / القاعة</label>
              <input
                type="text"
                class="apple-input"
                value={eventData.location}
                onChange={(e) => setEventData({ ...eventData, location: e.target.value })}
                required
              />
            </div>

            <div class="form-group">
              <label>صورة كرت الدعوة</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label class="apple-btn apple-btn-secondary" style={{ cursor: 'pointer' }}>
                  <Upload size={16} /> رفع كرت دعوة جديد
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>
                {eventData.cardImage && (
                  <button type="button" class="apple-btn apple-btn-danger" onClick={() => setEventData({ ...eventData, cardImage: null })}>
                    إزالة الصورة
                  </button>
                )}
              </div>
            </div>

            <button type="submit" class="apple-btn apple-btn-gold btn-block" style={{ marginTop: '10px' }}>
              حفظ وتثبيت البيانات
            </button>
          </form>
        </div>

        {/* Right: Apple Stats Widgets & Batch Add */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* iOS Widgets */}
          <div class="apple-card">
            <div class="card-title-row">
              <h2>المؤشرات الحية (Apple iOS Widgets)</h2>
            </div>
            <div class="widgets-grid">
              <div class="apple-widget">
                <div class="widget-icon blue"><Users size={24} /></div>
                <div>
                  <div class="widget-val">{total}</div>
                  <div class="widget-lbl">إجمالي المدعوين</div>
                </div>
              </div>
              <div class="apple-widget">
                <div class="widget-icon green"><CheckCircle2 size={24} /></div>
                <div>
                  <div class="widget-val">{accepted}</div>
                  <div class="widget-lbl">تأكيد القبول</div>
                </div>
              </div>
              <div class="apple-widget">
                <div class="widget-icon red"><XCircle size={24} /></div>
                <div>
                  <div class="widget-val">{declined}</div>
                  <div class="widget-lbl">معتذرون</div>
                </div>
              </div>
              <div class="apple-widget">
                <div class="widget-icon amber"><Clock size={24} /></div>
                <div>
                  <div class="widget-val">{pending}</div>
                  <div class="widget-lbl">بانتظار الرد</div>
                </div>
              </div>
            </div>

            <div class="apple-widget" style={{ marginTop: '16px', background: 'rgba(48, 209, 88, 0.1)', borderColor: 'rgba(48, 209, 88, 0.3)' }}>
              <div class="widget-icon green" style={{ background: 'var(--system-green)', color: '#000' }}><UserCheck size={24} /></div>
              <div>
                <div class="widget-val" style={{ color: 'var(--system-green)' }}>{checkedIn}</div>
                <div class="widget-lbl">تم تسجيل دخولهم بالقاعة (QR Gate)</div>
              </div>
            </div>
          </div>

          {/* Batch Add Form */}
          <div class="apple-card">
            <div class="card-title-row">
              <h2>إضافة المدعوين بالجوالات</h2>
            </div>
            <form onSubmit={handleBatchSubmit}>
              <div class="form-group">
                <label>إدخال قائمة الأرقام (سطر لكل مدعو: الاسم، رقم الجوال):</label>
                <textarea
                  class="apple-input"
                  rows="3"
                  placeholder="مثال:&#10;عبدالله المحمد, 0501234567&#10;خالد العتيبي, 0559876543"
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                ></textarea>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" class="apple-btn apple-btn-primary" style={{ flex: 1 }}>
                  <Plus size={16} /> إضافة القائمة
                </button>
                <button type="button" class="apple-btn apple-btn-secondary" onClick={handleLoadSample}>
                  تحميل عيّنة
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Recipient List Table */}
      <div class="apple-card" style={{ marginTop: '20px' }}>
        <div class="card-title-row">
          <div>
            <h2>قائمة المدعوين وإرسال الدعوات المباشرة</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>اضغط على زر الواتساب لإرسال كرت الدعوة وتأكيد الحضور للضيف بنقرة واحدة</p>
          </div>
          {guests.length > 0 && (
            <button class="apple-btn apple-btn-danger" onClick={() => setGuests([])} style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
              مسح القائمة
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table class="apple-table">
            <thead>
              <tr>
                <th>#</th>
                <th>اسم الضيف</th>
                <th>رقم الجوال</th>
                <th>حالة الدعوة</th>
                <th>كود التذكرة</th>
                <th>حالة الحضور</th>
                <th>إرسال واتساب</th>
                <th>خيارات</th>
              </tr>
            </thead>
            <tbody>
              {guests.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                    لا يوجد مدعوين حالياً. قم بإضافة أسماء من مربع الإدخال أعلاه.
                  </td>
                </tr>
              ) : (
                guests.map((guest, idx) => {
                  const waMsg = encodeURIComponent(
                    `مرحباً ${guest.name} ✨\nيسرنا دعوتكم لحضور ${eventData.title}.\nيرجى استلام تذكرة الـ QR وتأكيد حضورك عبر الرابط:\n` + window.location.href
                  );
                  const waUrl = `https://wa.me/${guest.phone}?text=${waMsg}`;

                  return (
                    <tr key={guest.id}>
                      <td>{idx + 1}</td>
                      <td><strong>{guest.name}</strong></td>
                      <td dir="ltr">{guest.phone}</td>
                      <td>
                        {guest.status === 'accepted' && <span class="ios-badge ios-badge-green">مقبول ({guest.companions})</span>}
                        {guest.status === 'declined' && <span class="ios-badge ios-badge-red">معتذر</span>}
                        {guest.status === 'pending' && <span class="ios-badge ios-badge-gold">بانتظار الرد</span>}
                      </td>
                      <td><code>{guest.ticketCode}</code></td>
                      <td>
                        {guest.checkedIn ? (
                          <span class="ios-badge ios-badge-green"><UserCheck size={12} /> تم الحضور ({guest.checkInTime})</span>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>لم يحضر</span>
                        )}
                      </td>
                      <td>
                        <a href={waUrl} target="_blank" rel="noreferrer" class="apple-btn apple-btn-whatsapp" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                          <MessageCircle size={14} /> إرسال الواتساب
                        </a>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            class="apple-btn apple-btn-secondary"
                            style={{ padding: '6px 10px' }}
                            onClick={() => {
                              setActiveGuestId(guest.id);
                              setActiveTab('guest');
                            }}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            class="apple-btn apple-btn-danger"
                            style={{ padding: '6px 10px' }}
                            onClick={() => handleDeleteGuest(guest.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
