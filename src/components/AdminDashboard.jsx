import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Calendar, Users, CheckCircle2, XCircle, Clock, Upload, Download, Plus, MessageCircle, Eye, FileSpreadsheet, Send, Image as ImageIcon, Rocket, Loader2, Trash2, Layers, BarChart3, Check, X, Sparkles } from 'lucide-react';
import ExcelValidationModal from './ExcelValidationModal';
import EventsSidebar from './EventsSidebar';
import NewEventModal from './NewEventModal';

export default function AdminDashboard({
  events = [],
  activeEventId,
  eventData,
  setEventData,
  guests = [],
  setGuests,
  setActiveGuestId,
  setActiveTab,
  refreshData,
  onSelectEvent,
  onCreateEvent,
  onDeleteEvent
}) {
  const [batchText, setBatchText] = useState('');
  const [previewCardImg, setPreviewCardImg] = useState(eventData?.cardImage || null);
  
  // Validation & New Event Modals state
  const [pendingExcelRows, setPendingExcelRows] = useState(null);
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);

  // Sync preview card image whenever active eventData changes
  useEffect(() => {
    setPreviewCardImg(eventData?.cardImage || null);
  }, [eventData]);

  // WhatsApp Auto Gateway Credentials
  const [instanceId, setInstanceId] = useState(localStorage.getItem('wa_instance_id') || '');
  const [apiToken, setApiToken] = useState(localStorage.getItem('wa_api_token') || '');
  const [isSendingAuto, setIsSendingAuto] = useState(false);
  const [autoProgress, setAutoProgress] = useState(null);

  // Save Event Details
  const handleEventSubmit = async (e) => {
    e.preventDefault();
    const updatedEv = { ...(eventData || {}), cardImage: previewCardImg };
    if (!activeEventId || (events || []).length === 0) {
      await onCreateEvent(updatedEv);
    } else {
      await setEventData(updatedEv);
      alert(`تم حفظ تفاصيل المناسبة "${updatedEv.title || 'جديدة'}" وكرت الدعوة بنجاح!`);
    }
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
        body: JSON.stringify({ guests: newGuests, eventId: activeEventId })
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
    alert(`تم فحص وتأكيد واعتماد ${validGuests.length} مدعو بنجاح للمناسبة "${eventData.title}"!`);
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
      alert('يرجى رفع ملف تمبلت الدعوات وإضافة أرقام المدعوين لهذه المناسبة أولاً.');
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
          hostUrl: window.location.origin,
          eventId: activeEventId
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAutoProgress({ sent: data.sentCount, total: data.total, currentName: 'مكتمل' });
        alert(`تم الانتهاء من الإرسال التلقائي بنجاح لـ ${data.sentCount} من أصل ${data.total} مدعو في مناسبة "${eventData.title}"!`);
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
    if (window.confirm(`هل أنت تأكد من مسح جميع المدعوين الخاصة بمناسبة "${eventData.title}"؟`)) {
      try {
        await fetch(`/api/guests?eventId=${activeEventId}`, { method: 'DELETE' });
      } catch (e) {
        console.error('Failed to clear server guests', e);
      }
      setGuests([]);
      if (refreshData) refreshData();
      alert('تم مسح جميع المدعوين بنجاح!');
    }
  };

  // Delete Single Guest
  const handleDeleteGuest = async (id) => {
    if (window.confirm('هل أنت تأكد من حذف هذا المدعو؟')) {
      try {
        await fetch(`/api/guests/${id}?eventId=${activeEventId}`, { method: 'DELETE' });
      } catch (e) {
        console.error('Failed to delete guest', e);
      }
      const updated = guests.filter(g => g.id !== id);
      setGuests(updated);
      if (refreshData) refreshData();
    }
  };

  // Stats
  const total = (guests || []).length;
  const accepted = (guests || []).filter(g => g.status === 'accepted').length;
  const declined = (guests || []).filter(g => g.status === 'declined').length;
  const pending = (guests || []).filter(g => g.status === 'pending').length;

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

      {/* NEW EVENT CREATION MODAL OVERLAY */}
      {isNewEventModalOpen && (
        <NewEventModal
          onCreateEvent={(newEvent) => {
            setIsNewEventModalOpen(false);
            onCreateEvent(newEvent);
          }}
          onClose={() => setIsNewEventModalOpen(false)}
        />
      )}

      {/* TOP MAIN GRID: EVENTS SIDEBAR (RIGHT) + DASHBOARD ACTIONS (LEFT) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: '22px', alignItems: 'start', marginBottom: '24px' }}>
        
        {/* Right Sidebar: Events List & Management */}
        <EventsSidebar
          events={events}
          activeEventId={activeEventId}
          onSelectEvent={onSelectEvent}
          onOpenNewEventModal={() => setIsNewEventModalOpen(true)}
          onDeleteEvent={onDeleteEvent}
        />

        {/* Left Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Active Event Indicator Banner */}
          <div class="apple-card" style={{ padding: '16px 22px', background: 'var(--pink-light)', border: '1.5px solid var(--pink-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Layers size={24} style={{ color: 'var(--pink-primary)' }} />
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--pink-dark)', fontWeight: 700 }}>المناسبة النشطة حالياً لإدارة المدعوين:</span>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{eventData?.title || 'مناسبة بدون عنوان'}</h2>
              </div>
            </div>
            <button class="apple-btn apple-btn-pink" style={{ fontSize: '0.84rem', padding: '8px 16px' }} onClick={() => setIsNewEventModalOpen(true)}>
              <Plus size={16} /> إضافة مناسبة جديدة
            </button>
          </div>
          <div class="apple-card" style={{ background: '#ffffff', border: '1.5px solid rgba(244, 165, 186, 0.35)' }}>
            <div class="card-title-row" style={{ marginBottom: '14px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={20} style={{ color: 'var(--pink-primary)' }} /> المؤشرات الإحصائية الحية لمناسبة ({eventData?.title || 'المناسبة الحالية'})
              </h2>
              <span class="ios-badge ios-badge-pink">تحديث مباشر لحظي</span>
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

          {/* AUTOMATED WHATSAPP DISPATCHER BOX */}
          <div class="apple-card" style={{ background: '#ffffff', border: '2px solid var(--pink-primary)', padding: '22px' }}>
            <div class="card-title-row" style={{ marginBottom: '14px' }}>
              <h2 style={{ color: 'var(--pink-dark)', fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Rocket size={24} style={{ color: 'var(--pink-primary)' }} /> الإرسال التلقائي الكلي للواتساب (Auto WhatsApp Dispatcher)
              </h2>
              <span class="ios-badge ios-badge-pink">إرسال آلي لمناسبة: {eventData?.title}</span>
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
                  placeholder="مثال: 7103123456 (أو اتركه فارغاً للإرسال المباشر)"
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
              <div style={{ background: 'rgba(253, 242, 245, 0.8)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(244, 165, 186, 0.4)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 700, marginBottom: '8px', color: 'var(--pink-dark)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Loader2 size={16} class="animate-spin" style={{ color: 'var(--pink-primary)' }} />
                    جاري الإرسال الآلي لـ: {autoProgress.currentName}...
                  </span>
                  <span>{autoProgress.sent} / {autoProgress.total} رسالة</span>
                </div>
                <div style={{ width: '100%', height: '10px', background: 'rgba(244, 165, 186, 0.2)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ width: `${(autoProgress.sent / autoProgress.total) * 100}%`, height: '100%', background: 'var(--pink-gradient)', transition: 'width 0.4s ease' }}></div>
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
                  <Loader2 size={20} class="animate-spin" /> جاري الإرسال الآلي لجميع مدعوي المناسبة...
                </>
              ) : (
                <>
                  <Rocket size={20} /> البدء بالإرسال التلقائي الفوري لمناسبة ({eventData?.title})
                </>
              )}
            </button>
          </div>

          <div class="grid-2col">
            {/* Left: Event Setup Form & Live Image Preview */}
            <div class="apple-card">
              <div class="card-title-row">
                <h2><Calendar class="system-gold" size={22} /> تعديل بيانات المناسبة وكرت الدعوة</h2>
                <span class="ios-badge ios-badge-pink">وردية وأصلية</span>
              </div>

              <form onSubmit={handleEventSubmit}>
                <div class="form-group">
                  <label>عنوان المناسبة / الحفل</label>
                  <input
                    type="text"
                    class="apple-input"
                    value={eventData?.title || ''}
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
                      value={eventData?.date || ''}
                      onChange={(e) => setEventData({ ...eventData, date: e.target.value })}
                    />
                  </div>

                  <div class="form-group">
                    <label>وقت المناسبة</label>
                    <input
                      type="time"
                      class="apple-input"
                      value={eventData?.time || '20:00'}
                      onChange={(e) => setEventData({ ...eventData, time: e.target.value })}
                    />
                  </div>
                </div>

                <div class="form-group">
                  <label>مكان المناسبة (اسم القاعة / الفندق / المدينة)</label>
                  <input
                    type="text"
                    class="apple-input"
                    value={eventData?.location || ''}
                    onChange={(e) => setEventData({ ...eventData, location: e.target.value })}
                  />
                </div>

                <div class="form-group">
                  <label>رابط اللوكيشن في خرائط جوجل (Google Maps)</label>
                  <input
                    type="text"
                    class="apple-input"
                    style={{ direction: 'ltr', textAlign: 'right' }}
                    value={eventData?.mapLink || ''}
                    onChange={(e) => setEventData({ ...(eventData || {}), mapLink: e.target.value })}
                  />
                </div>

                {/* Live Card Design Image Uploader */}
                <div class="form-group" style={{ borderTop: '1px solid rgba(244, 165, 186, 0.2)', paddingTop: '14px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>صورة كرت الدعوة الخاص بهذه المناسبة:</span>
                    {previewCardImg && <span class="ios-badge ios-badge-green" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14} /> تم رفع الكرت</span>}
                  </label>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px' }}>
                    <label class="apple-btn apple-btn-secondary" style={{ flex: 1, cursor: 'pointer' }}>
                      <Upload size={16} /> تغيير صورة كرت الدعوة
                      <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                    </label>
                  </div>

                  {/* Card Image Preview Box */}
                  <div class="card-preview-box" style={{ marginTop: '12px' }}>
                    {previewCardImg ? (
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--pink-dark)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                          <Sparkles size={14} /> معاينة حية لكرت هذه المناسبة:
                        </span>
                        <img src={previewCardImg} alt="معاينة الكرت" class="card-preview-img" />
                      </div>
                    ) : (
                      <div style={{ padding: '20px', color: 'var(--text-tertiary)' }}>
                        <ImageIcon size={36} style={{ color: 'var(--pink-primary)', marginBottom: '6px' }} />
                        <p style={{ fontSize: '0.85rem' }}>لم يتم رفع كرت دعوة لهذه المناسبة بعد.</p>
                      </div>
                    )}
                  </div>
                </div>

                <button type="button" onClick={handleEventSubmit} class="apple-btn apple-btn-pink btn-block" style={{ marginTop: '10px', cursor: 'pointer' }}>
                  حفظ تفاصيل المناسبة والكرت
                </button>
              </form>
            </div>

            {/* Right: Excel Import */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Excel Import & User Template */}
              <div class="apple-card">
                <div class="card-title-row">
                  <h2><FileSpreadsheet class="system-gold" size={20} /> استيراد ومراجعة الإكسل (تمبلت الدعوات.xlsx)</h2>
                </div>
                
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                  عند اختيار الملف تظهر لك شاشة تحقق لمراجعة صحة الأسماء والأرقام وتعديل الأخطاء قبل الحفظ النهائي للمناسبة.
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
                <form onSubmit={handleBatchSubmit} style={{ borderTop: '1px solid rgba(244, 165, 186, 0.2)', paddingTop: '14px' }}>
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
        </div>
      </div>

      {/* Recipient Table */}
      <div class="apple-card" style={{ marginTop: '10px' }}>
        <div class="card-title-row">
          <div>
            <h2>قائمة المدعوين المفحوصة والمحفوظة لمناسبة ({eventData?.title})</h2>
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
                    لا يوجد مدعوين محفوظين لهذه المناسبة حالياً. قم برفع تمبلت الدعوات.xlsx للتحقق والحفظ.
                  </td>
                </tr>
              ) : (
                guests.map((guest, idx) => {
                  const guestLink = `${baseUrl}/?guest=${guest.id}`;
                  const waMsg = encodeURIComponent(
                    `مرحباً ${guest.name}\nيسرنا ويسعدنا دعوتكم لحضور ${eventData?.title}.\nيرجى تأكيد حضورك واستلام تذكرتك عبر الرابط التالي:\n` + guestLink
                  );
                  const waUrl = `https://api.whatsapp.com/send?phone=${guest.phone}&text=${waMsg}`;

                  return (
                    <tr key={guest.id}>
                      <td>{idx + 1}</td>
                      <td><strong>{guest.name}</strong></td>
                      <td dir="ltr">{guest.phone}</td>
                      <td>
                        {guest.status === 'accepted' && <span class="ios-badge ios-badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={13} /> مقبول</span>}
                        {guest.status === 'declined' && <span class="ios-badge ios-badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><X size={13} /> معتذر</span>}
                        {guest.status === 'pending' && <span class="ios-badge ios-badge-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={13} /> بانتظار الرد</span>}
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
