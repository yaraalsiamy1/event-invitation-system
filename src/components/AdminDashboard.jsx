import React, { useState } from 'react';
import { Calendar, Users, CheckCircle2, XCircle, Clock, Upload, Download, Trash2, Plus, MessageCircle, Eye, FileSpreadsheet, Send, Info } from 'lucide-react';

export default function AdminDashboard({ eventData, setEventData, guests, setGuests, setActiveGuestId, setActiveTab }) {
  const [batchText, setBatchText] = useState('');

  // Save Event Details
  const handleEventSubmit = (e) => {
    e.preventDefault();
    alert('تم حفظ تفاصيل المناسبة بنجاح!');
  };

  // Image Upload for Card
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

  // Format Saudi Phone to 966
  const formatPhone = (phoneRaw) => {
    let clean = (phoneRaw || '').toString().replace(/\D/g, '');
    if (clean.startsWith('05')) {
      clean = '966' + clean.substring(1);
    } else if (clean.startsWith('5')) {
      clean = '966' + clean;
    }
    return clean;
  };

  // Download Sample Excel/CSV Template
  const downloadExcelTemplate = () => {
    const csvContent = "\uFEFFالاسم,رقم الجوال\nعبدالله المحمد,0501234567\nخالد العتيبي,0559876543\nد. سارة الشمري,0567778899\nم. فهد الدوسري,0541112233";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'قالب_المدعوين_دعواتنا.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse Uploaded Excel / CSV File
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const lines = content.split(/\r\n|\n/);
      const newGuests = [];

      lines.forEach((line, index) => {
        if (!line.trim()) return;
        
        // Skip header if contains 'الاسم' or 'name'
        if (index === 0 && (line.includes('الاسم') || line.toLowerCase().includes('name'))) {
          return;
        }

        const parts = line.split(',');
        let name = "";
        let phoneRaw = "";

        if (parts.length >= 2) {
          name = parts[0].replace(/"/g, '').trim();
          phoneRaw = parts[1].replace(/"/g, '').trim();
        } else {
          phoneRaw = parts[0].replace(/"/g, '').trim();
          name = "ضيف عزيز";
        }

        if (phoneRaw) {
          newGuests.push({
            id: "g_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
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

      if (newGuests.length > 0) {
        setGuests(prev => [...prev, ...newGuests]);
        alert(`تم استيراد ${newGuests.length} مدعو بنجاح من ملف الإكسل!`);
      } else {
        alert('لم يتم العثور على أرقام مدعوين صالحة في الملف.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Process Batch Text Entry
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

  // Sample Data Generator
  const handleLoadSample = () => {
    const samples = [
      { id: "g_1", name: "عبدالله المحمد", phone: "966501234567", status: "accepted", companions: 2, ticketCode: "EV-897412", checkedIn: false, checkInTime: null },
      { id: "g_2", name: "خالد العتيبي", phone: "966559876543", status: "pending", companions: 1, ticketCode: "EV-654321", checkedIn: false, checkInTime: null },
      { id: "g_3", name: "فهد الدوسري", phone: "966541112233", status: "declined", companions: 1, ticketCode: "EV-112233", checkedIn: false, checkInTime: null },
      { id: "g_4", name: "د. سارة الشمري", phone: "966567778899", status: "accepted", companions: 3, ticketCode: "EV-778899", checkedIn: false, checkInTime: null }
    ];
    setGuests(samples);
  };

  // Stats
  const total = guests.length;
  const accepted = guests.filter(g => g.status === 'accepted').length;
  const declined = guests.filter(g => g.status === 'declined').length;
  const pending = guests.filter(g => g.status === 'pending').length;

  return (
    <div class="apple-dashboard">

      {/* WhatsApp Official Activation Banner */}
      <div class="apple-card" style={{ background: 'rgba(37, 211, 102, 0.08)', border: '1px solid rgba(37, 211, 102, 0.3)', padding: '16px 20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MessageCircle size={28} style={{ color: '#25D366' }} />
          <div>
            <h3 style={{ fontSize: '1rem', color: '#14793b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              آلية إرسال الواتساب المباشر <span class="ios-badge ios-badge-green">مربوط ومفعّل مجاناً 100%</span>
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              يتم إنشاء رابط الواتساب الرسمي المباشر لكل ضيف تلقائياً. عند الضغط على زر "إرسال الواتساب" سيفتح تطبيق WhatsApp Web أو تطبيق الجوال مباشرة بالنص والكرت المخصص للضيف بنقرة واحدة.
            </p>
          </div>
        </div>
      </div>

      <div class="grid-2col">
        {/* Left: Event Details Form */}
        <div class="apple-card">
          <div class="card-title-row">
            <h2><Calendar class="system-gold" size={22} /> تفاصيل المناسبة وكرت الدعوة</h2>
            <span class="ios-badge ios-badge-gold">ثيم فاتح</span>
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
                  <Upload size={16} /> رفع تصميم الكرت
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
              حفظ تفاصيل المناسبة
            </button>
          </form>
        </div>

        {/* Right: Live Widgets & Excel Import */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* iOS Widgets */}
          <div class="apple-card">
            <div class="card-title-row">
              <h2>المؤشرات الإحصائية الحية</h2>
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
          </div>

          {/* Excel Import & Template Tools */}
          <div class="apple-card">
            <div class="card-title-row">
              <h2><FileSpreadsheet class="system-gold" size={20} /> استيراد الأرقام من ملف الإكسل (Excel)</h2>
            </div>
            
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              يمكنك رفع ملف Excel أو CSV يحتوي على قائمة الأسماء والأرقام لتسهيل الإدخال دفعة واحدة.
            </p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <button class="apple-btn apple-btn-secondary" style={{ flex: 1 }} onClick={downloadExcelTemplate}>
                <Download size={16} /> تحميل نموذج الإكسل (.CSV)
              </button>

              <label class="apple-btn apple-btn-primary" style={{ flex: 1, cursor: 'pointer' }}>
                <FileSpreadsheet size={16} /> رفع ملف الإكسل والمزامنة
                <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>

            {/* Alternative Manual Entry */}
            <form onSubmit={handleBatchSubmit} style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '14px' }}>
              <div class="form-group">
                <label>أو كتابة الأرقام يدوياً (الاسم، رقم الجوال):</label>
                <textarea
                  class="apple-input"
                  rows="2"
                  placeholder="مثال:&#10;عبدالله المحمد, 0501234567"
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                ></textarea>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" class="apple-btn apple-btn-gold" style={{ flex: 1 }}>
                  <Plus size={16} /> إضافة القائمة
                </button>
                <button type="button" class="apple-btn apple-btn-secondary" onClick={handleLoadSample}>
                  تحميل عيّنة تجريبية
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Recipient List Table & WhatsApp Actions */}
      <div class="apple-card" style={{ marginTop: '20px' }}>
        <div class="card-title-row">
          <div>
            <h2>قائمة المدعوين وإرسال الدعوات عبر الواتساب المباشر</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>اضغط على زر الواتساب لكل مدعو لإرسال كرت الدعوة ورابط التذكرة المخصص له</p>
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
                <th>إرسال عبر الواتساب</th>
                <th>معاينة التذكرة</th>
              </tr>
            </thead>
            <tbody>
              {guests.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                    لا يوجد مدعوين حالياً. قم برفع ملف الإكسل أو إضافة أسماء من المربع أعلاه.
                  </td>
                </tr>
              ) : (
                guests.map((guest, idx) => {
                  const waMsg = encodeURIComponent(
                    `مرحباً ${guest.name} ✨\nيسرنا دعوتكم لحضور ${eventData.title}.\nيرجى استلام تذكرة الـ QR وتأكيد حضورك عبر الرابط:\n` + window.location.href
                  );
                  const waUrl = `https://api.whatsapp.com/send?phone=${guest.phone}&text=${waMsg}`;

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
                        <a href={waUrl} target="_blank" rel="noreferrer" class="apple-btn apple-btn-whatsapp" style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
                          <Send size={14} /> إرسال الواتساب
                        </a>
                      </td>
                      <td>
                        <button
                          class="apple-btn apple-btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={() => {
                            setActiveGuestId(guest.id);
                            setActiveTab('guest');
                          }}
                        >
                          <Eye size={14} /> معاينة كرت الضيف
                        </button>
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
