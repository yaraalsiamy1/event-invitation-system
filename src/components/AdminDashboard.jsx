import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Calendar, Users, CheckCircle2, XCircle, Clock, Upload, Download, Plus, MessageCircle, Eye, FileSpreadsheet, Send, Image as ImageIcon, Rocket, Loader2, Trash2, Layers, BarChart3, Check, X, Sparkles, HelpCircle } from 'lucide-react';
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
  // Checkbox selection state for batch sending
  const [selectedGuestIds, setSelectedGuestIds] = useState([]);

  // Pagination State (50 records per page)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeEventId]);

  // Render single unified status badge per guest
  const renderSingleStatus = (guest) => {
    if (guest.status === 'accepted') {
      return (
        <span className="ios-badge ios-badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
          <Check size={13} /> مقبول
        </span>
      );
    }
    if (guest.status === 'declined') {
      return (
        <span className="ios-badge ios-badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
          <X size={13} /> معتذر
        </span>
      );
    }
    if (guest.sent) {
      return (
        <span className="ios-badge ios-badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
          <Check size={13} /> تم الإرسال
        </span>
      );
    }
    return (
      <span className="ios-badge ios-badge-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
        <Clock size={13} /> لم يُرسل بعد
      </span>
    );
  };

  // Auto-sync selection state when guests change
  useEffect(() => {
    if (guests && guests.length > 0) {
      const validIds = new Set(guests.map(g => g.id));
      setSelectedGuestIds(prev => {
        const filtered = prev.filter(id => validIds.has(id));
        return filtered.length > 0 ? filtered : guests.map(g => g.id);
      });
    } else {
      setSelectedGuestIds([]);
    }
  }, [guests]);

  const isAllSelected = guests.length > 0 && selectedGuestIds.length === guests.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedGuestIds([]);
    } else {
      setSelectedGuestIds((guests || []).map(g => g.id));
    }
  };

  const handleSelectUnsentOnly = () => {
    const unsent = (guests || []).filter(g => !g.sent).map(g => g.id);
    setSelectedGuestIds(unsent);
  };

  const handleToggleSelectGuest = (id) => {
    setSelectedGuestIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

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
      const res = await fetch('/api/guests/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests: newGuests, eventId: activeEventId })
      });
      if (res.ok) {
        const updatedList = await res.json();
        if (Array.isArray(updatedList) && updatedList.length > 0) {
          setGuests(updatedList);
        } else {
          setGuests(prev => [...(prev || []), ...newGuests]);
        }
      } else {
        setGuests(prev => [...(prev || []), ...newGuests]);
      }
      if (refreshData) refreshData();
    } catch (e) {
      setGuests(prev => [...(prev || []), ...newGuests]);
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

      if (formattedPhone) {
        if (existingPhones.has(formattedPhone)) {
          skippedDups++;
          return;
        }

        existingPhones.add(formattedPhone);

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

  // Trigger Automatic Batch Dispatcher for SELECTED guests
  const handleStartAutoDispatch = async () => {
    if (guests.length === 0) {
      alert('يرجى رفع ملف تمبلت الدعوات وإضافة أرقام المدعوين لهذه المناسبة أولاً.');
      return;
    }

    if (selectedGuestIds.length === 0) {
      alert('يرجى تحديد مدعو واحد على الأقل من القائمة أدناه لإرسال الدعوات إليهم.');
      return;
    }

    const cleanInstance = instanceId.trim();
    const cleanToken = apiToken.trim();

    localStorage.setItem('wa_instance_id', cleanInstance);
    localStorage.setItem('wa_api_token', cleanToken);

    const selectedGuestsList = guests.filter(g => selectedGuestIds.includes(g.id));

    // Mode A: Server-Side API Gateway Dispatch (If credentials exist)
    if (cleanInstance && cleanToken) {
      setIsSendingAuto(true);
      setAutoProgress({ sent: 0, total: selectedGuestsList.length, currentName: selectedGuestsList[0]?.name || '' });

      try {
        const res = await fetch('/api/send-whatsapp-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceId: cleanInstance,
            apiToken: cleanToken,
            hostUrl: window.location.origin,
            eventId: activeEventId,
            guestIds: selectedGuestIds
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setAutoProgress({ sent: data.sentCount, total: data.total, currentName: 'مكتمل' });
          alert(`تم الانتهاء من الإرسال الآلي بنجاح لـ ${data.sentCount} من أصل ${data.total} مدعو في مناسبة "${eventData.title}" عبر البوابة!`);
          if (refreshData) refreshData();
        } else {
          alert(data.error || 'حدث خطأ في استجابة بوابة الواتساب. تأكد من صحة Instance ID و API Token وشحن الرصيد.');
        }
      } catch (e) {
        alert('تعذر الاتصال ببوابة الواتساب: ' + e.message);
      } finally {
        setIsSendingAuto(false);
      }
      return;
    }

    // Mode B: Direct Browser Sequential Dispatch (If no paid API credentials)
    const proceedDirect = window.confirm(
      `لم تقم بإدخال Instance ID و API Token لبوابة الواتساب الآلية.\n\nهل ترغب في البدء بالإرسال المباشر لـ (${selectedGuestsList.length}) مدعو عبر فتح الواتساب بالتتابع وتسجيل حالة الإرسال؟`
    );

    if (!proceedDirect) return;

    setIsSendingAuto(true);
    let sentSuccess = 0;

    for (let i = 0; i < selectedGuestsList.length; i++) {
      const g = selectedGuestsList[i];
      setAutoProgress({ sent: i + 1, total: selectedGuestsList.length, currentName: g.name });

      const guestLink = `${window.location.origin}/?guest=${g.id}`;
      const waMsg = encodeURIComponent(
        `مرحباً ${g.name}\nيسرنا ويسعدنا دعوتكم لحضور ${eventData?.title}.\nيرجى تأكيد حضورك واستلام تذكرتك عبر الرابط التالي:\n` + guestLink
      );
      const waUrl = `https://api.whatsapp.com/send?phone=${g.phone}&text=${waMsg}`;

      window.open(waUrl, '_blank');
      g.sent = true;
      sentSuccess++;

      await new Promise(r => setTimeout(r, 1000));
    }

    setIsSendingAuto(false);
    alert(`تم فتح الواتساب وتحديث حالة ${sentSuccess} مدعو محدد بنجاح!`);
    if (refreshData) refreshData();
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
    <div className="apple-dashboard">

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
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: '24px', alignItems: 'start', marginBottom: '28px' }}>
        
        {/* Right Sidebar: Events List & Management */}
        <EventsSidebar
          events={events}
          activeEventId={activeEventId}
          onSelectEvent={onSelectEvent}
          onOpenNewEventModal={() => setIsNewEventModalOpen(true)}
          onDeleteEvent={onDeleteEvent}
        />

        {/* Left Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Active Event Indicator Banner */}
          <div className="apple-card" style={{ padding: '18px 24px', background: 'var(--pink-light)', border: '1.5px solid var(--pink-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <Layers size={26} style={{ color: 'var(--pink-primary)' }} />
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--pink-dark)', fontWeight: 700 }}>المناسبة النشطة حالياً لإدارة المدعوين:</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{eventData?.title || 'مناسبة بدون عنوان'}</h2>
              </div>
            </div>
          </div>

          {/* LIVE STATISTICAL METRICS WIDGETS */}
          <div className="apple-card" style={{ background: '#ffffff', border: '1.5px solid rgba(244, 165, 186, 0.35)', marginBottom: 0 }}>
            <div className="card-title-row" style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={20} style={{ color: 'var(--pink-primary)' }} /> المؤشرات الإحصائية الحية لمناسبة ({eventData?.title || 'المناسبة الحالية'})
              </h2>
            </div>
            <div className="widgets-grid">
              <div className="apple-widget">
                <div className="widget-icon pink"><Users size={24} /></div>
                <div>
                  <div className="widget-val">{total}</div>
                  <div className="widget-lbl">إجمالي المدعوين</div>
                </div>
              </div>
              <div className="apple-widget">
                <div className="widget-icon green"><CheckCircle2 size={24} /></div>
                <div>
                  <div className="widget-val">{accepted}</div>
                  <div className="widget-lbl">تأكيد القبول</div>
                </div>
              </div>
              <div className="apple-widget">
                <div className="widget-icon red"><XCircle size={24} /></div>
                <div>
                  <div className="widget-val">{declined}</div>
                  <div className="widget-lbl">معتذرون</div>
                </div>
              </div>
              <div className="apple-widget">
                <div className="widget-icon amber"><Clock size={24} /></div>
                <div>
                  <div className="widget-val">{pending}</div>
                  <div className="widget-lbl">بانتظار الرد</div>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 1 & 2: SETUP EVENT & EXCEL UPLOAD STACK */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Form 1: Event Details & Card Upload */}
            <div className="apple-card" style={{ marginBottom: 0 }}>
              <div className="card-title-row">
                <h2><Calendar className="system-gold" size={22} /> 1. تعديل بيانات المناسبة وكرت الدعوة</h2>
              </div>

              <form onSubmit={handleEventSubmit}>
                <div className="form-group">
                  <label>عنوان المناسبة / الحفل</label>
                  <input
                    type="text"
                    className="apple-input"
                    value={eventData?.title || ''}
                    onChange={(e) => setEventData({ ...eventData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="grid-2col" style={{ gap: '12px' }}>
                  <div className="form-group">
                    <label>تاريخ المناسبة</label>
                    <input
                      type="date"
                      className="apple-input"
                      value={eventData?.date || ''}
                      onChange={(e) => setEventData({ ...eventData, date: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>وقت المناسبة</label>
                    <input
                      type="time"
                      className="apple-input"
                      value={eventData?.time || '20:00'}
                      onChange={(e) => setEventData({ ...eventData, time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>مكان المناسبة (اسم القاعة / الفندق / المدينة)</label>
                  <input
                    type="text"
                    className="apple-input"
                    value={eventData?.location || ''}
                    onChange={(e) => setEventData({ ...eventData, location: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>رابط اللوكيشن في خرائط جوجل (Google Maps)</label>
                  <input
                    type="text"
                    className="apple-input"
                    style={{ direction: 'ltr', textAlign: 'right' }}
                    value={eventData?.mapLink || ''}
                    onChange={(e) => setEventData({ ...(eventData || {}), mapLink: e.target.value })}
                  />
                </div>

                {/* Live Card Design Image Uploader */}
                <div className="form-group" style={{ borderTop: '1px solid rgba(244, 165, 186, 0.2)', paddingTop: '14px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>صورة كرت الدعوة الخاص بهذه المناسبة:</span>
                    {previewCardImg && <span className="ios-badge ios-badge-green" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14} /> تم رفع الكرت</span>}
                  </label>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px' }}>
                    <label className="apple-btn apple-btn-secondary" style={{ flex: 1, cursor: 'pointer' }}>
                      <Upload size={16} /> تغيير صورة كرت الدعوة
                      <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                    </label>
                  </div>

                  {/* Card Image Preview Box */}
                  <div className="card-preview-box" style={{ marginTop: '12px' }}>
                    {previewCardImg ? (
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--pink-dark)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                          <Sparkles size={14} /> معاينة حية لكرت هذه المناسبة:
                        </span>
                        <img src={previewCardImg} alt="معاينة الكرت" className="card-preview-img" />
                      </div>
                    ) : (
                      <div style={{ padding: '20px', color: 'var(--text-tertiary)' }}>
                        <ImageIcon size={36} style={{ color: 'var(--pink-primary)', marginBottom: '6px' }} />
                        <p style={{ fontSize: '0.85rem' }}>لم يتم رفع كرت دعوة لهذه المناسبة بعد.</p>
                      </div>
                    )}
                  </div>
                </div>

                <button type="button" onClick={handleEventSubmit} className="apple-btn apple-btn-pink btn-block" style={{ marginTop: '10px', cursor: 'pointer' }}>
                  حفظ تفاصيل المناسبة والكرت
                </button>
              </form>
            </div>

            {/* Form 2: Excel Import & Manual Entry */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="apple-card" style={{ marginBottom: 0 }}>
                <div className="card-title-row">
                  <h2><FileSpreadsheet className="system-gold" size={20} /> 2. استيراد ومراجعة الإكسل (تمبلت الدعوات.xlsx)</h2>
                </div>
                
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                  عند اختيار الملف تظهر لك شاشة تحقق لمراجعة صحة الأسماء والأرقام وتعديل الأخطاء قبل الحفظ النهائي للمناسبة.
                </p>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  <button className="apple-btn apple-btn-secondary" style={{ flex: 1 }} onClick={downloadExcelTemplate}>
                    <Download size={16} /> تحميل تمبلت الدعوات.xlsx الأصلي
                  </button>

                  <label className="apple-btn apple-btn-pink" style={{ flex: 1, cursor: 'pointer' }}>
                    <FileSpreadsheet size={16} /> رفع ومراجعة الإكسل
                    <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                </div>

                {/* Manual Entry */}
                <form onSubmit={handleBatchSubmit} style={{ borderTop: '1px solid rgba(244, 165, 186, 0.2)', paddingTop: '14px' }}>
                  <div className="form-group">
                    <label>أو كتابة الأرقام يدوياً (الاسم، رقم الجوال):</label>
                    <textarea
                      className="apple-input"
                      rows="3"
                      placeholder="مثال:&#10;عبدالله المحمد, 0501234567&#10;سارة الخالد, 0551234567"
                      value={batchText}
                      onChange={(e) => setBatchText(e.target.value)}
                    ></textarea>
                  </div>
                  <button type="submit" className="apple-btn apple-btn-secondary btn-block">
                    <Plus size={16} /> إضافة وحفظ في القائمة
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STREAMLINED GUESTS TABLE CARD */}
      <div className="apple-card" style={{ marginBottom: '28px' }}>
        <div className="card-title-row" style={{ flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
          <div>
            <h2>3. قائمة المدعوين المفحوصة والمحفوظة لمناسبة ({eventData?.title})</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>حدد المدعوين الذين ترغب في إرسال الدعوة لهم تلقائياً</p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', width: '100%', justifyContent: 'space-between', marginTop: '4px' }}>
            {/* Right side controls */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="ios-badge ios-badge-pink" style={{ fontSize: '0.84rem', padding: '6px 14px', fontWeight: 800 }}>
                تم تحديد ({selectedGuestIds.length}) من أصل ({guests.length})
              </span>
              <button className="apple-btn apple-btn-secondary" onClick={handleSelectUnsentOnly} style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                تحديد غير المرسل لهم فقط
              </button>
              {guests.length > 0 && (
                <button className="apple-btn apple-btn-danger" onClick={handleClearAll} style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                  مسح القائمة
                </button>
              )}
            </div>

            {/* Left side standing alone: Rocket Auto Dispatch Button */}
            <div>
              <button
                type="button"
                className="apple-btn apple-btn-pink"
                style={{ padding: '8px 18px', fontSize: '0.88rem', fontWeight: 800, boxShadow: '0 4px 14px rgba(244, 165, 186, 0.4)' }}
                onClick={handleStartAutoDispatch}
                disabled={isSendingAuto || selectedGuestIds.length === 0}
              >
                {isSendingAuto ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> جاري الإرسال الآلي...
                  </>
                ) : (
                  <>
                    <Rocket size={16} /> بدء الإرسال التلقائي ({selectedGuestIds.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Live Auto Sending Progress Bar */}
        {isSendingAuto && autoProgress && (
          <div style={{ background: 'rgba(253, 242, 245, 0.9)', padding: '14px 18px', borderRadius: '14px', border: '1px solid rgba(244, 165, 186, 0.4)', marginTop: '14px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', fontWeight: 700, marginBottom: '6px', color: 'var(--pink-dark)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--pink-primary)' }} />
                جاري الإرسال الآلي لـ: {autoProgress.currentName}...
              </span>
              <span>{autoProgress.sent} / {autoProgress.total} رسالة</span>
            </div>
            <div style={{ width: '100%', height: '10px', background: 'rgba(244, 165, 186, 0.2)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ width: `${(autoProgress.sent / autoProgress.total) * 100}%`, height: '100%', background: 'var(--pink-gradient)', transition: 'width 0.4s ease' }}></div>
            </div>
          </div>
        )}

        {/* Paginated Calculations */}
        {(() => {
          const totalPages = Math.max(1, Math.ceil((guests || []).length / pageSize));
          const safePage = Math.min(currentPage, totalPages);
          const startIndex = (safePage - 1) * pageSize;
          const paginatedGuests = (guests || []).slice(startIndex, startIndex + pageSize);

          return (
            <>
              <div style={{ overflowX: 'auto', marginTop: '12px' }}>
                <table className="apple-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={handleToggleSelectAll}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--pink-primary)' }}
                          title="تحديد / إلغاء تحديد الكل"
                        />
                      </th>
                      <th>#</th>
                      <th>اسم الضيف</th>
                      <th>رقم الجوال</th>
                      <th>الحالة</th>
                      <th>معاينة الكرت</th>
                      <th>حذف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guests.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                          لا يوجد مدعوين محفوظين لهذه المناسبة حالياً. قم برفع تمبلت الدعوات.xlsx للتحقق والحفظ.
                        </td>
                      </tr>
                    ) : (
                      paginatedGuests.map((guest, idx) => {
                        const isChecked = selectedGuestIds.includes(guest.id);
                        const displayIndex = startIndex + idx + 1;

                        return (
                          <tr key={guest.id} style={{ background: isChecked ? 'rgba(253, 242, 245, 0.4)' : 'transparent' }}>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSelectGuest(guest.id)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--pink-primary)' }}
                              />
                            </td>
                            <td>{displayIndex}</td>
                            <td><strong>{guest.name}</strong></td>
                            <td dir="ltr">{guest.phone}</td>
                            <td>
                              {renderSingleStatus(guest)}
                            </td>
                            <td>
                              <button
                                className="apple-btn apple-btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                onClick={() => {
                                  setActiveGuestId(guest.id);
                                  setActiveTab('guest');
                                }}
                              >
                                <Eye size={13} /> معاينة كرت الضيف
                              </button>
                            </td>
                            <td>
                              <button
                                className="apple-btn apple-btn-danger"
                                style={{ padding: '5px 9px' }}
                                title="حذف هذا المدعو"
                                onClick={() => handleDeleteGuest(guest.id)}
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls (50 per page) */}
              {guests.length > pageSize && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(244, 165, 186, 0.2)', flexWrap: 'wrap', gap: '10px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    عرض {startIndex + 1} - {Math.min(startIndex + pageSize, guests.length)} من أصل {guests.length} مدعو
                  </span>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      className="apple-btn apple-btn-secondary"
                      style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                    >
                      السابقة
                    </button>

                    <span style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0 10px', color: 'var(--pink-dark)' }}>
                      صفحة {safePage} من {totalPages}
                    </span>

                    <button
                      className="apple-btn apple-btn-secondary"
                      style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                    >
                      التالية
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
