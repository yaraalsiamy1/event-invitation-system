import React, { useState } from 'react';
import { Calendar, Users, CheckCircle2, XCircle, Clock, Upload, Download, Plus, MessageCircle, Eye, FileSpreadsheet, Send, Image as ImageIcon, Info } from 'lucide-react';

export default function AdminDashboard({ eventData, setEventData, guests, setGuests, setActiveGuestId, setActiveTab, refreshData }) {
  const [batchText, setBatchText] = useState('');
  const [previewCardImg, setPreviewCardImg] = useState(eventData.cardImage || null);

  // Save Event Details
  const handleEventSubmit = async (e) => {
    e.preventDefault();
    const updatedEv = { ...eventData, cardImage: previewCardImg };
    setEventData(updatedEv);
    alert('تم حفظ تفاصيل المناسبة وكرت الدعوة بنجاح!');
  };

  // Image Upload with Instant Live Preview
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewCardImg(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Format Saudi Phone
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

  // Batch Post Guests to API & DB
  const saveBatchToApi = async (newGuests) => {
    try {
      await fetch('/api/guests/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests: newGuests })
      });
      if (refreshData) refreshData();
    } catch (e) {
      setGuests([...guests, ...newGuests]);
    }
  };

  // Handle Excel File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target.result;
      const lines = content.split(/\r\n|\n/);
      const newGuests = [];

      lines.forEach((line, index) => {
        if (!line.trim()) return;
        if (index === 0 && (line.includes('الاسم') || line.toLowerCase().includes('name'))) return;

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
            ticketCode: "EV-" + Math.floor(100000 + Math.random() * 900000),
            checkedIn: false,
            checkInTime: null
          });
        }
      });

      if (newGuests.length > 0) {
        await saveBatchToApi(newGuests);
        alert(`تم استيراد وحفظ ${newGuests.length} مدعو بنجاح في قاعدة البيانات!`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Process Batch Text Entry
  const handleBatchSubmit = async (e) => {
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
          ticketCode: "EV-" + Math.floor(100000 + Math.random() * 900000),
          checkedIn: false,
          checkInTime: null
        });
      }
    });

    await saveBatchToApi(newGuests);
    setBatchText('');
    alert(`تم إضافة ${newGuests.length} مدعو بنجاح!`);
  };

  // Clear Guests
  const handleClearAll = async () => {
    if (confirm('هل أنت تأكد من مسح كافة المدعوين من قاعدة البيانات؟')) {
      try {
        await fetch('/api/guests', { method: 'DELETE' });
        if (refreshData) refreshData();
      } catch (e) {
        setGuests([]);
      }
    }
  };

  // Stats
  const total = guests.length;
  const accepted = guests.filter(g => g.status === 'accepted').length;
  const declined = guests.filter(g => g.status === 'declined').length;
  const pending = guests.filter(g => g.status === 'pending').length;

  // Base URL (Adapts dynamically to localhost or Railway live domain!)
  const baseUrl = window.location.origin;

  return (
    <div class="apple-dashboard">

      {/* WhatsApp Official Banner */}
      <div class="apple-card" style={{ background: 'rgba(37, 211, 102, 0.08)', border: '1px solid rgba(37, 211, 102, 0.3)', padding: '18px 22px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <MessageCircle size={32} style={{ color: '#25D366' }} />
          <div>
            <h3 style={{ fontSize: '1.05rem', color: '#14793b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              آلية إرسال الدعوات المباشرة بالواتساب <span class="ios-badge ios-badge-green">مربوطة ومفعلة تلقائياً 100%</span>
            </h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              تفتح الروابط مباشرة عبر تطبيق الواتساب أو <strong>WhatsApp Web</strong> بنقرة واحدة لكل ضيف. يتضمّن النص الترحيبي ورابط بطاقة الضيف الشخصية الإلكترونية.
            </p>
          </div>
        </div>
      </div>

      <div class="grid-2col">
        {/* Left: Event Setup Form & Live Image Preview */}
        <div class="apple-card">
          <div class="card-title-row">
            <h2><Calendar class="system-gold" size={22} /> تفاصيل المناسبة وكرت الدعوة</h2>
            <span class="ios-badge ios-badge-pink">وردي وأبيض هادئ</span>
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

            {/* Card Image Upload & Instant Preview Box */}
            <div class="form-group">
              <label>صورة كرت الدعوة ومعاينتها الحية</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label class="apple-btn apple-btn-secondary" style={{ cursor: 'pointer' }}>
                  <Upload size={16} /> اختيار تصميم كرت الدعوة
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>
                {previewCardImg && (
                  <button type="button" class="apple-btn apple-btn-danger" onClick={() => setPreviewCardImg(null)}>
                    حذف الكرت
                  </button>
                )}
              </div>

              {/* Instant Live Image Preview */}
              <div class="card-preview-container">
                {previewCardImg ? (
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--pink-dark)', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                      ✨ معاينة حية للتصميم قبل الحفظ:
                    </span>
                    <img src={previewCardImg} alt="معاينة الكرت" class="card-preview-img" />
                  </div>
                ) : (
                  <div style={{ padding: '20px', color: 'var(--text-tertiary)' }}>
                    <ImageIcon size={36} style={{ color: 'var(--pink-light)', marginBottom: '6px' }} />
                    <p style={{ fontSize: '0.85rem' }}>لم يتم رفع كرت دعوة بعد. اختر صورة لمعاينتها فوراً هنا.</p>
                  </div>
                )}
              </div>
            </div>

            <button type="submit" class="apple-btn apple-btn-pink btn-block" style={{ marginTop: '10px' }}>
              حفظ تفاصيل المناسبة والكرت
            </button>
          </form>
        </div>

        {/* Right: Live Widgets & Excel Import */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Live Widgets */}
          <div class="apple-card">
            <div class="card-title-row">
              <h2>المؤشرات الإحصائية الحية</h2>
            </div>
            <div class="widgets-grid">
              <div class="apple-widget">
                <div class="widget-icon pink"><Users size={24} /></div>
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

          {/* Excel Import & Template */}
          <div class="apple-card">
            <div class="card-title-row">
              <h2><FileSpreadsheet class="system-gold" size={20} /> استيراد الأرقام من ملف الإكسل (Excel)</h2>
            </div>
            
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              يمكنك رفع ملف Excel أو CSV يحتوي على قائمة الأسماء والأرقام لتعبئتها وتخزينها تلقائياً.
            </p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <button class="apple-btn apple-btn-secondary" style={{ flex: 1 }} onClick={downloadExcelTemplate}>
                <Download size={16} /> تحميل قالب الإكسل (.CSV)
              </button>

              <label class="apple-btn apple-btn-pink" style={{ flex: 1, cursor: 'pointer' }}>
                <FileSpreadsheet size={16} /> رفع ملف الإكسل ومزامنة
                <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>

            {/* Manual Entry */}
            <form onSubmit={handleBatchSubmit} style={{ borderTop: '1px solid rgba(244, 114, 182, 0.15)', paddingTop: '14px' }}>
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
              <button type="submit" class="apple-btn apple-btn-secondary btn-block">
                <Plus size={16} /> إضافة وحفظ في القائمة
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Recipient Table */}
      <div class="apple-card" style={{ marginTop: '20px' }}>
        <div class="card-title-row">
          <div>
            <h2>قائمة المدعوين وإرسال الدعوات عبر الواتساب المباشر</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>اضغط على زر الواتساب لكل مدعو لإرسال كرت الدعوة ورابط التذكرة المخصص له</p>
          </div>
          {guests.length > 0 && (
            <button class="apple-btn apple-btn-danger" onClick={handleClearAll} style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
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
                  const guestLink = `${baseUrl}/?guest=${guest.id}`;
                  const waMsg = encodeURIComponent(
                    `مرحباً ${guest.name} ✨\nيسرنا ويسعدنا دعوتكم لحضور ${eventData.title}.\nيرجى تأكيد حضورك واستلام تذكرتك عبر الرابط التالي:\n` + guestLink
                  );
                  const waUrl = `https://api.whatsapp.com/send?phone=${guest.phone}&text=${waMsg}`;

                  return (
                    <tr key={guest.id}>
                      <td>{idx + 1}</td>
                      <td><strong>{guest.name}</strong></td>
                      <td dir="ltr">{guest.phone}</td>
                      <td>
                        {guest.status === 'accepted' && <span class="ios-badge ios-badge-green">مقبول ✅</span>}
                        {guest.status === 'declined' && <span class="ios-badge ios-badge-red">معتذر ❌</span>}
                        {guest.status === 'pending' && <span class="ios-badge ios-badge-gold">بانتظار الرد ⏳</span>}
                      </td>
                      <td><code>{guest.ticketCode}</code></td>
                      <td>
                        <a href={waUrl} target="_blank" rel="noreferrer" class="apple-btn apple-btn-whatsapp" style={{ padding: '7px 14px', fontSize: '0.84rem' }}>
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
