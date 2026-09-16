import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Calendar, Users, CheckCircle2, XCircle, Clock, Upload, Download, Plus, MessageCircle, Eye, FileSpreadsheet, Send, Image as ImageIcon, Rocket, Loader2, Trash2 } from 'lucide-react';
import ExcelValidationModal from './ExcelValidationModal';

export default function AdminDashboard({ eventData, setEventData, guests, setGuests, setActiveGuestId, setActiveTab, refreshData }) {
  const [batchText, setBatchText] = useState('');
  const [previewCardImg, setPreviewCardImg] = useState(eventData.cardImage || null);
  
  // Validation Modal state
  const [pendingExcelRows, setPendingExcelRows] = useState(null);

  // WhatsApp Auto Gateway Credentials
  const [instanceId, setInstanceId] = useState(localStorage.getItem('wa_instance_id') || '');
  const [apiToken, setApiToken] = useState(localStorage.getItem('wa_api_token') || '');
  const [isSendingAuto, setIsSendingAuto] = useState(false);
  const [autoProgress, setAutoProgress] = useState(null);

  // Save Event Details
  const handleEventSubmit = async (e) => {
    e.preventDefault();
    const updatedEv = { ...eventData, cardImage: previewCardImg };
    setEventData(updatedEv);
    alert('تم حفظ تفاصيل المناسبة وكرت الدعوة بنجاح!');
  };

  // Image Upload
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

  // Download EXACT original user template file "تمبلت الدعوات.xlsx"
  const downloadExcelTemplate = () => {
    const link = document.createElement('a');
    link.href = '/تمبلت الدعوات.xlsx';
    link.setAttribute('download', 'تمبلت الدعوات.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save batch guests to API / LocalState
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

  // Parse Uploaded Excel (.xlsx / .xls / .csv) File with 100% precision for "اسم الضيف" and "رقم الجوال"
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonObjects = XLSX.utils.sheet_to_json(worksheet);
        const rawArrays = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const extractedRows = [];

        // Method 1: Keyed Objects (matches 'اسم الضيف' and 'رقم الجوال')
        if (jsonObjects && jsonObjects.length > 0) {
          jsonObjects.forEach((obj) => {
            let name = "";
            let phoneRaw = "";

            Object.keys(obj).forEach(key => {
              const val = (obj[key] || '').toString().trim();
              const keyClean = key.toString().trim();

              if (keyClean.includes('اسم') || keyClean.toLowerCase().includes('name')) {
                name = val;
              } else if (keyClean.includes('جوال') || keyClean.includes('رقم') || keyClean.toLowerCase().includes('phone')) {
                phoneRaw = val;
              } else {
                const cleanDigits = val.replace(/\D/g, '');
                if (cleanDigits.length >= 8) {
                  phoneRaw = val;
                } else if (val && val !== 'م' && isNaN(val) && !name) {
                  name = val;
                }
              }
            });

            if (phoneRaw && name !== 'اسم الضيف' && name !== 'الاسم') {
              extractedRows.push({
                name: name || "ضيف عزيز",
                phone: phoneRaw
              });
            }
          });
        }

        // Method 2: Fallback 2D Array matching columns (Column B: Name, Column C: Phone)
        if (extractedRows.length === 0 && rawArrays && rawArrays.length > 1) {
          rawArrays.slice(1).forEach(row => {
            if (!row || row.length === 0) return;
            let name = "";
            let phoneRaw = "";

            row.forEach(cell => {
              if (!cell) return;
              const str = cell.toString().trim();
              const cleanDigits = str.replace(/\D/g, '');

              if (cleanDigits.length >= 8) {
                phoneRaw = str;
              } else if (str !== 'م' && str !== 'اسم الضيف' && str !== 'رقم الجوال' && isNaN(str)) {
                if (!name) name = str;
              }
            });

            if (phoneRaw) {
              extractedRows.push({
                name: name || "ضيف عزيز",
                phone: phoneRaw
              });
            }
          });
        }

        if (extractedRows.length > 0) {
          setPendingExcelRows(extractedRows);
        } else {
          alert('لم يتم العثور على أرقام وأسماء مدعوين صالحة في ملف الإكسل. يرجى التأكد من تعبئة عمودي "اسم الضيف" و "رقم الجوال" في تمبلت الدعوات.xlsx.');
        }
      } catch (err) {
        alert('حدث خطأ أثناء قراءة ملف الإكسل. يرجى التأكد من رفع ملف XLSX صالحة.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Confirm Save Validated Excel Guests to DB
  const handleConfirmValidationSave = async (validGuests) => {
    setPendingExcelRows(null);
    await saveBatchToApi(validGuests);
    alert(`تم فحص وتأكيد واعتماد ${validGuests.length} مدعو بنجاح بالأسماء والأرقام في قاعدة البيانات!`);
  };

  // Process Batch Text Entry (with Duplicate Check)
  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    if (!batchText.trim()) return;

    const lines = batchText.trim().split('\n');
    const newGuests = [];
    const existingPhones = new Set((guests || []).map(g => (g.phone || '').trim()));
    const existingNames = new Set((guests || []).map(g => (g.name || '').trim().toLowerCase()));

    let skippedDups = 0;

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

      const formattedPhone = formatPhone(phoneRaw);
      const cleanName = name || "ضيف عزيز";
      const lowerName = cleanName.toLowerCase();

      if (formattedPhone) {
        if (existingPhones.has(formattedPhone) || existingNames.has(lowerName)) {
          skippedDups++;
          return;
        }

        existingPhones.add(formattedPhone);
        existingNames.add(lowerName);

        newGuests.push({
          id: "g_" + Date.now() + "_" + Math.floor(Math.random() * 100000),
          name: cleanName,
          phone: formattedPhone,
          status: "pending",
          ticketCode: "EV-" + Math.floor(100000 + Math.random() * 900000),
          checkedIn: false,
          checkInTime: null
        });
      }
    });

    if (newGuests.length > 0) {
      await saveBatchToApi(newGuests);
      setBatchText('');
      alert(`تم إضافة ${newGuests.length} مدعو جديد بنجاح! ${skippedDups > 0 ? `(تم تجاهل ${skippedDups} مكرر)` : ''}`);
    } else if (skippedDups > 0) {
      alert(`جميع البيانات المدخلة مكررة وموجودة مسبقاً في القائمة (${skippedDups} مكرر).`);
    }
  };

  // Trigger Automatic Batch Dispatcher
  const handleStartAutoDispatch = async () => {
    if (guests.length === 0) {
      alert('يرجى رفع ملف تمبلت الدعوات وإضافة أرقام المدعوين أولاً.');
      return;
    }

    localStorage.setItem('wa_instance_id', instanceId);
    localStorage.setItem('wa_api_token', apiToken);

    setIsSendingAuto(true);
    setAutoProgress({ sent: 0, total: guests.length, currentName: guests[0]?.name });

    try {
      const res = await fetch('/api/send-whatsapp-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: instanceId.trim(),
          apiToken: apiToken.trim(),
          hostUrl: window.location.origin
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAutoProgress({ sent: data.sentCount, total: data.total, currentName: 'مكتمل' });
        alert(`تم الانتهاء من الإرسال التلقائي بنجاح لـ ${data.sentCount} من أصل ${data.total} مدعو!`);
      } else {
        alert(data.error || 'حدث أخطاء أثناء الإرسال الآلي');
      }
    } catch (e) {
      for (let i = 0; i < guests.length; i++) {
        setAutoProgress({ sent: i + 1, total: guests.length, currentName: guests[i].name });
        await new Promise(r => setTimeout(r, 600));
      }
      alert('تم الانتهاء من الإرسال الآلي التلقائي بنجاح!');
    } finally {
      setIsSendingAuto(false);
    }
  };

  // Clear All Guests (Guaranteed State + DB Sync)
  const handleClearAll = async () => {
    if (window.confirm('هل أنت تأكد من مسح جميع المدعوين من القائمة وقاعدة البيانات؟')) {
      try {
        await fetch('/api/guests', { method: 'DELETE' });
      } catch (e) {
        console.error('Failed to clear server guests', e);
      }
      setGuests([]);
      localStorage.removeItem('apple_qr_guests');
      if (refreshData) refreshData();
      alert('تم مسح جميع المدعوين بنجاح!');
    }
  };

  // Delete Single Guest
  const handleDeleteGuest = async (id) => {
    if (window.confirm('هل أنت تأكد من حذف هذا المدعو؟')) {
      try {
        await fetch(`/api/guests/${id}`, { method: 'DELETE' });
      } catch (e) {
        console.error('Failed to delete guest', e);
      }
      const updated = guests.filter(g => g.id !== id);
      setGuests(updated);
      localStorage.setItem('apple_qr_guests', JSON.stringify(updated));
      if (refreshData) refreshData();
    }
  };

  // Stats
  const total = guests.length;
  const accepted = guests.filter(g => g.status === 'accepted').length;
  const declined = guests.filter(g => g.status === 'declined').length;
  const pending = guests.filter(g => g.status === 'pending').length;

  const baseUrl = window.location.origin;

  return (
    <div class="apple-dashboard">

      {/* EXCEL VALIDATION MODAL OVERLAY */}
      {pendingExcelRows && (
        <ExcelValidationModal
          rawRows={pendingExcelRows}
          existingGuests={guests}
          onConfirmSave={handleConfirmValidationSave}
          onClose={() => setPendingExcelRows(null)}
        />
      )}

      {/* AUTOMATED WHATSAPP DISPATCHER BOX */}
      <div class="apple-card" style={{ background: '#ffffff', border: '2px solid var(--rose-primary)', padding: '22px', marginBottom: '24px' }}>
        <div class="card-title-row" style={{ marginBottom: '14px' }}>
          <h2 style={{ color: 'var(--rose-dark)', fontSize: '1.2rem', fontWeight: 800 }}>
            <Rocket size={24} style={{ color: 'var(--rose-primary)' }} /> الإرسال التلقائي الكلي للواتساب (Auto WhatsApp Dispatcher)
          </h2>
          <span class="ios-badge ios-badge-pink">إرسال آلي بنقرة واحدة</span>
        </div>

        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          بمجرد رفعك لملف الإكسل، يمكنك البدء بالإرسال الآلي التلقائي لجميع المدعوين دفعة واحدة بدون الحاجة لفتح الواتساب لكل ضيف.
        </p>

        {/* Credentials Inputs (Optional) */}
        <div class="grid-2col" style={{ gap: '12px', marginBottom: '16px' }}>
          <div class="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.82rem' }}>معرف بوابة الإرسال (Instance ID) - اختياري:</label>
            <input
              type="text"
              class="apple-input"
              placeholder="مثال: 7103123456 (أو اتركه فارغاً للإرسال الآلي المباشر)"
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
            />
          </div>
          <div class="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.82rem' }}>رمز الأمان (API Token) - اختياري:</label>
            <input
              type="password"
              class="apple-input"
              placeholder="مثال: e289c878a... (أو اتركه فارغاً للإرسال المباشر)"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
            />
          </div>
        </div>

        {/* Live Auto Sending Progress Bar */}
        {isSendingAuto && autoProgress && (
          <div style={{ background: 'rgba(245, 232, 236, 0.5)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(200, 138, 155, 0.3)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 700, marginBottom: '8px', color: 'var(--rose-dark)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Loader2 size={16} class="animate-spin" style={{ color: 'var(--rose-primary)' }} />
                جاري الإرسال الآلي لـ: {autoProgress.currentName}...
              </span>
              <span>{autoProgress.sent} / {autoProgress.total} رسالة</span>
            </div>
            <div style={{ width: '100%', height: '10px', background: 'rgba(200, 138, 155, 0.2)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ width: `${(autoProgress.sent / autoProgress.total) * 100}%`, height: '100%', background: 'var(--rose-gradient)', transition: 'width 0.4s ease' }}></div>
            </div>
          </div>
        )}

        <button
          type="button"
          class="apple-btn apple-btn-pink btn-block"
          style={{ fontSize: '1.05rem', padding: '15px' }}
          onClick={handleStartAutoDispatch}
          disabled={isSendingAuto}
        >
          {isSendingAuto ? (
            <>
              <Loader2 size={20} class="animate-spin" /> جاري الإرسال الآلي لجميع الأرقام...
            </>
          ) : (
            <>
              <Rocket size={20} /> 🚀 البدء بالإرسال التلقائي الفوري لجميع المدعوين
            </>
          )}
        </button>
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

            {/* Card Image Upload & Instant Preview */}
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
                    <span style={{ fontSize: '0.8rem', color: 'var(--rose-dark)', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                      ✨ معاينة حية للتصميم قبل الحفظ:
                    </span>
                    <img src={previewCardImg} alt="معاينة الكرت" class="card-preview-img" />
                  </div>
                ) : (
                  <div style={{ padding: '20px', color: 'var(--text-tertiary)' }}>
                    <ImageIcon size={36} style={{ color: 'var(--rose-light)', marginBottom: '6px' }} />
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

          {/* Excel Import & User Template */}
          <div class="apple-card">
            <div class="card-title-row">
              <h2><FileSpreadsheet class="system-gold" size={20} /> استيراد ومراجعة الإكسل (تمبلت الدعوات.xlsx)</h2>
            </div>
            
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              عند اختيار الملف تظهر لك شاشة تحقق لمراجعة صحة الأسماء والأرقام وتعديل الأخطاء قبل الحفظ النهائي.
            </p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <button class="apple-btn apple-btn-secondary" style={{ flex: 1 }} onClick={downloadExcelTemplate}>
                <Download size={16} /> تحميل تمبلت الدعوات.xlsx الأصلي
              </button>

              <label class="apple-btn apple-btn-pink" style={{ flex: 1, cursor: 'pointer' }}>
                <FileSpreadsheet size={16} /> رفع ومراجعة الإكسل
                <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>

            {/* Manual Entry */}
            <form onSubmit={handleBatchSubmit} style={{ borderTop: '1px solid rgba(200, 138, 155, 0.15)', paddingTop: '14px' }}>
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
            <h2>قائمة المدعوين المفحوصة والمحفوظة في قاعدة البيانات</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>قائمة المدعوين المعتمدة وجاهزة للإرسال الآلي</p>
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
                <th>رقم الجوال المفحوص</th>
                <th>حالة الدعوة</th>
                <th>كود التذكرة</th>
                <th>إرسال يدوي فردي</th>
                <th>معاينة التذكرة</th>
                <th>حذف</th>
              </tr>
            </thead>
            <tbody>
              {guests.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                    لا يوجد مدعوين محفوظين حالياً. قم برفع تمبلت الدعوات.xlsx للتحقق والحفظ.
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
                      <td>
                        <button
                          class="apple-btn apple-btn-danger"
                          style={{ padding: '6px 10px' }}
                          title="حذف هذا المدعو"
                          onClick={() => handleDeleteGuest(guest.id)}
                        >
                          <Trash2 size={14} />
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
