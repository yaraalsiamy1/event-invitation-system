import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Calendar, Users, CheckCircle2, XCircle, Clock, Upload, Download,
  Plus, MessageCircle, Eye, EyeOff, FileSpreadsheet, Send, Image as ImageIcon,
  Rocket, Loader2, Trash2, Layers, BarChart3, Check, X, Sparkles,
  HelpCircle, Filter, ChevronDown, ChevronRight, ChevronLeft, Search, Edit, UserPlus, Smartphone,
  AlertTriangle, RefreshCw, Copy, Settings
} from 'lucide-react';
import ExcelValidationModal from './ExcelValidationModal';
import EventsSidebar from './EventsSidebar';
import NewEventModal from './NewEventModal';
import {
  renderWhatsAppMessage,
  DEFAULT_TEMPLATE_SINGLE,
  DEFAULT_TEMPLATE_WITH_COMPANIONS,
  DEFAULT_REMINDER_TEMPLATE,
  formatArabicDateOnly,
  formatArabicTimeOnly
} from './GuestPortal';

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
  onDeleteEvent,
  showConfirmation
}) {
  const [batchText, setBatchText] = useState('');
  const [singleName, setSingleName] = useState('');
  const [singlePhone, setSinglePhone] = useState('');
  const [singleParentId, setSingleParentId] = useState('');
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);
  const [previewCardImg, setPreviewCardImg] = useState(eventData?.cardImage || null);
  const [fullViewImage, setFullViewImage] = useState(null);

  // Phase 8: Card Upload & Replacement State
  const [pendingCardFile, setPendingCardFile] = useState(null);
  const [pendingCardPreview, setPendingCardPreview] = useState(null);
  const [pendingCardCompressed, setPendingCardCompressed] = useState(null);
  const [cardUploadError, setCardUploadError] = useState(null);
  const [isSavingCard, setIsSavingCard] = useState(false);
  
  // Validation, Add Guest & New Event Modals state
  const [pendingExcelRows, setPendingExcelRows] = useState(null);
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const [isAddGuestModalOpen, setIsAddGuestModalOpen] = useState(false);
  const [isMessagePreviewOpen, setIsMessagePreviewOpen] = useState(false);

  // Track saved state of event fields to only show save button when fields are modified
  const lastSyncedEventIdRef = useRef(null);
  const [savedEventFields, setSavedEventFields] = useState(null);

  useEffect(() => {
    if (eventData) {
      if (!savedEventFields || lastSyncedEventIdRef.current !== (eventData.id || activeEventId)) {
        lastSyncedEventIdRef.current = eventData.id || activeEventId;
        setSavedEventFields({
          title: eventData.title || '',
          location: eventData.location || '',
          date: eventData.date || '',
          time: eventData.time || '20:00',
          mapLink: eventData.mapLink || ''
        });
      }
    }
  }, [eventData?.id, activeEventId]);

  const hasEventChanges = useMemo(() => {
    if (!eventData || !savedEventFields) return false;
    return (
      (eventData.title || '') !== savedEventFields.title ||
      (eventData.location || '') !== savedEventFields.location ||
      (eventData.date || '') !== savedEventFields.date ||
      (eventData.time || '20:00') !== savedEventFields.time ||
      (eventData.mapLink || '') !== savedEventFields.mapLink
    );
  }, [eventData, savedEventFields]);

  // Sync preview card image whenever active eventData changes
  useEffect(() => {
    setPreviewCardImg(eventData?.cardImage || null);
    setPendingCardPreview(null);
    setPendingCardCompressed(null);
    setPendingCardFile(null);
    setCardUploadError(null);
  }, [eventData]);

  // WhatsApp Auto Gateway Credentials & Custom Text (Phase 5 & 7)
  const [instanceId, setInstanceId] = useState(localStorage.getItem('wa_instance_id') || '');
  const [apiToken, setApiToken] = useState(localStorage.getItem('wa_api_token') || '');
  const [hasServerWhatsAppConfig, setHasServerWhatsAppConfig] = useState(false);
  const [isCardVerified, setIsCardVerified] = useState(false);
  const [customMessage, setCustomMessage] = useState(() => {
    const saved = localStorage.getItem('wa_custom_message');
    if (!saved || saved.includes('{guest_name}') || saved.includes('{event_name}')) {
      return 'يسرنا ويسعدنا دعوتكم لحضور حفلنا وتكتمل فرحتنا بمشاركتكم.';
    }
    return saved;
  });
  const [isSendingAuto, setIsSendingAuto] = useState(false);
  const [autoProgress, setAutoProgress] = useState(null);
  // Checkbox selection state for batch sending
  const [selectedGuestIds, setSelectedGuestIds] = useState([]);
  const [isGatewayModalOpen, setIsGatewayModalOpen] = useState(false);

  // Phase 7 Req 1: Load server-side WhatsApp configuration (masked)
  useEffect(() => {
    fetch('/api/whatsapp/config')
      .then(res => res.ok ? res.json() : null)
      .then(cfg => {
        if (cfg) {
          if (cfg.instanceIdMasked) setInstanceId(cfg.instanceIdMasked);
          if (cfg.apiTokenMasked) setApiToken(cfg.apiTokenMasked);
          setHasServerWhatsAppConfig(!!cfg.hasConfig);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveWhatsAppConfig = async (inst, tok) => {
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: inst, apiToken: tok })
      });
      if (res.ok) {
        const cfg = await res.json();
        if (cfg.instanceIdMasked) setInstanceId(cfg.instanceIdMasked);
        if (cfg.apiTokenMasked) setApiToken(cfg.apiTokenMasked);
        setHasServerWhatsAppConfig(!!cfg.hasConfig);
        // Clear plaintext credentials from localStorage for security
        localStorage.removeItem('wa_instance_id');
        localStorage.removeItem('wa_api_token');
        return true;
      }
    } catch (e) {
      console.warn('Failed to save WhatsApp config:', e);
    }
    return false;
  };

  // Phase 5 States: WhatsApp message templates, preview guest, test send, and failed log
  const [previewGuestId, setPreviewGuestId] = useState('');
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testPhone, setTestPhone] = useState(localStorage.getItem('wa_test_phone') || '');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testFeedback, setTestFeedback] = useState(null);
  const [failedSends, setFailedSends] = useState([]);

  // Template Variables (Phase 5 Req 1)
  const TEMPLATE_VARIABLES = [
    { key: '{guest_name}', label: 'اسم الضيف' },
    { key: '{companions}', label: 'المرافقين' },
    { key: '{event_name}', label: 'اسم المناسبة' },
    { key: '{date}', label: 'التاريخ' },
    { key: '{time}', label: 'الوقت' },
    { key: '{venue}', label: 'المكان' },
    { key: '{invite_link}', label: 'رابط الدعوة' }
  ];

  const insertVariableTag = (tag) => {
    setCustomMessage(prev => {
      const updated = prev ? `${prev} ${tag}` : tag;
      localStorage.setItem('wa_custom_message', updated);
      return updated;
    });
  };

  // Search by Name or Phone (Phase 2 Requirement 6)
  const [searchQuery, setSearchQuery] = useState('');

  // Status Filter State ('all' | 'accepted' | 'declined' | 'pending' | 'sent' | 'unsent')
  const [statusFilter, setStatusFilter] = useState('all');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  // Pagination State (10 records per page)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal states for Quick-Add Companion & Edit Guest (Phase 2 Requirements 3 & 4)
  const [addCompanionModal, setAddCompanionModal] = useState(null); // { ownerId, ownerName, companionName }
  const [editingGuestModal, setEditingGuestModal] = useState(null); // { id, name, phone, parent_guest_id, isDependent, ... }

  useEffect(() => {
    setCurrentPage(1);
  }, [activeEventId, statusFilter, searchQuery]);

  // Render single unified status badge per guest
  // Rule (Phase 2 Req 5): Dependents do not show "لم يُرسل بعد". Show "عبر دعوة [owner name]" instead.
  const renderSingleStatus = (guest) => {
    if (guest.status === 'accepted') {
      return (
        <span className="ios-badge ios-badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
          <Check size={13} /> حضور مؤكد
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
    if (guest.parent_guest_id) {
      const owner = (guests || []).find(g => g.id === guest.parent_guest_id);
      return (
        <span className="ios-badge" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
          عبر دعوة {owner ? owner.name : 'صاحبها'}
        </span>
      );
    }
    if (guest.sent) {
      return (
        <span className="ios-badge ios-badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
          <Check size={13} /> تم الإرسال (بانتظار الرد)
        </span>
      );
    }
    return (
      <span className="ios-badge ios-badge-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
        <Clock size={13} /> لم يُرسل بعد
      </span>
    );
  };

  // Rule (Phase 2 Req 5): Only owners are selected for sending (dependents never receive messages directly)
  const ownerGuests = useMemo(() => (guests || []).filter(g => !g.parent_guest_id), [guests]);

  // Live Message Preview calculations (Phase 5 Req 2)
  const selectedPreviewGuest = useMemo(() => {
    if (previewGuestId) {
      const found = ownerGuests.find(g => g.id === previewGuestId);
      if (found) return found;
    }
    return ownerGuests[0] || null;
  }, [ownerGuests, previewGuestId]);

  const previewDependents = useMemo(() => {
    if (!selectedPreviewGuest) return [];
    return (guests || []).filter(d => d.parent_guest_id === selectedPreviewGuest.id);
  }, [guests, selectedPreviewGuest]);

  const renderedLivePreview = useMemo(() => {
    if (!selectedPreviewGuest) {
      return 'لا يوجد مدعوين في هذه المناسبة بعد لمعاينة الرسالة الحية.';
    }
    return renderWhatsAppMessage(customMessage, {
      guest: selectedPreviewGuest,
      dependents: previewDependents,
      event: eventData,
      baseUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    });
  }, [customMessage, selectedPreviewGuest, previewDependents, eventData]);

  // Auto-sync selection state when owners change (keep user selection, clean up deleted ones)
  useEffect(() => {
    if (ownerGuests.length > 0) {
      const validOwnerIds = new Set(ownerGuests.map(g => g.id));
      setSelectedGuestIds(prev => prev.filter(id => validOwnerIds.has(id)));
    } else {
      setSelectedGuestIds([]);
    }
  }, [ownerGuests]);

  const isAllSelected = ownerGuests.length > 0 && ownerGuests.every(o => selectedGuestIds.includes(o.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedGuestIds([]);
    } else {
      setSelectedGuestIds(ownerGuests.map(g => g.id));
    }
  };

  const handleSelectUnsentOnly = () => {
    const unsentOwners = ownerGuests.filter(g => !g.sent).map(g => g.id);
    setSelectedGuestIds(unsentOwners);
  };

  // Select non-responders for reminder sending (Phase 5 Req 4)
  const handleSelectPendingReminderOnly = () => {
    const pendingOwners = ownerGuests.filter(g => g.sent && (!g.status || g.status === 'pending')).map(g => g.id);
    if (pendingOwners.length === 0) {
      alert('لا يوجد مدعوين بانتظار الرد ممن تم إرسال الدعوة لهم مسبقاً في هذه المناسبة.');
      return;
    }
    setSelectedGuestIds(pendingOwners);
    if (window.confirm(`تم تحديد (${pendingOwners.length}) مدعو بانتظار الرد.\nهل ترغب في تبديل مقدمة الرسالة إلى صيغة "التذكير" تلقائياً؟`)) {
      const reminderIntro = 'نود تذكيركم بموعد حفلنا القريب، ويسعدنا ويشرفنا تأكيد حضوركم لمشاركتنا هذه الفرحة.';
      setCustomMessage(reminderIntro);
      localStorage.setItem('wa_custom_message', reminderIntro);
    }
  };

  const handleToggleSelectGuest = (id) => {
    const target = (guests || []).find(g => g.id === id);
    if (target?.parent_guest_id) {
      // Dependents are never selectable for batch dispatch
      return;
    }
    setSelectedGuestIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Save Event Details
  const handleEventSubmit = async (e) => {
    e.preventDefault();

    // Phase 7 Req 4: Validate Google Maps URL before save
    const cleanMap = (eventData?.mapLink || '').trim();
    if (cleanMap) {
      try {
        const parsed = new URL(cleanMap);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error();
        }
      } catch (err) {
        alert('يرجى إدخال رابط خرائط صحيح يبدأ بـ https:// (مثال: https://maps.app.goo.gl/... أو اتركه فارغاً)');
        return;
      }
    }

    const updatedEv = { ...(eventData || {}), mapLink: cleanMap };
    if (!activeEventId || (events || []).length === 0) {
      await onCreateEvent(updatedEv);
      setSavedEventFields({
        title: updatedEv.title || '',
        location: updatedEv.location || '',
        date: updatedEv.date || '',
        time: updatedEv.time || '20:00',
        mapLink: updatedEv.mapLink || ''
      });
    } else {
      await setEventData(updatedEv);
      setSavedEventFields({
        title: updatedEv.title || '',
        location: updatedEv.location || '',
        date: updatedEv.date || '',
        time: updatedEv.time || '20:00',
        mapLink: updatedEv.mapLink || ''
      });
      if (showConfirmation) {
        showConfirmation('تم حفظ التعديلات بنجاح!', `تم حفظ تفاصيل المناسبة "${updatedEv.title || 'جديدة'}" بنجاح.`);
      } else {
        alert(`تم حفظ تفاصيل المناسبة "${updatedEv.title || 'جديدة'}" بنجاح!`);
      }
    }
  };

  // Phase 8 Helper: Generate lightweight compressed image for WhatsApp sending via HTML5 Canvas
  const compressImageForWhatsApp = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.70));
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  // Phase 8: Handle Card File Selection & Strict Validation
  const handleCardFileSelect = (e) => {
    setCardUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so user can re-pick same filename if desired
    e.target.value = '';

    // Requirement 3: PNG or JPG only
    const validExtensions = /\.(png|jpe?g)$/i;
    const validMimes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validMimes.includes(file.type) && !validExtensions.test(file.name)) {
      setCardUploadError('عذراً، يسمح فقط برفع صور بصيغة PNG أو JPG.');
      return;
    }

    // Requirement 3: max 5 MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setCardUploadError('حجم الصورة يتجاوز الحد المسموح به (5 ميجابايت كحد أقصى).');
      return;
    }

    // Read original base64 & generate compressed version
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const origBase64 = ev.target.result;
      setPendingCardPreview(origBase64);
      setPendingCardFile(file);

      try {
        const compressedBase64 = await compressImageForWhatsApp(file);
        setPendingCardCompressed(compressedBase64 || origBase64);
      } catch (err) {
        setPendingCardCompressed(origBase64);
      }
    };
    reader.readAsDataURL(file);
  };

  // Phase 8: Cancel pending card selection
  const handleCancelPendingCard = () => {
    setPendingCardPreview(null);
    setPendingCardCompressed(null);
    setPendingCardFile(null);
    setCardUploadError(null);
  };

  // Phase 8: Confirm and Save Card to Server (Per Event)
  const handleConfirmSaveCard = async () => {
    if (!pendingCardPreview) return;
    if (!activeEventId) {
      alert('يرجى تحديد مناسبة نشطة أولاً.');
      return;
    }

    // Requirement 6: Check DB count of sent invitees for this event
    const isReplacing = Boolean(eventData?.cardImage);
    if (isReplacing) {
      try {
        const res = await fetch(`/api/guests?eventId=${activeEventId}`);
        if (res.ok) {
          const dbGuests = await res.json();
          const sentCount = (dbGuests || []).filter(g => !g.parent_guest_id && g.sent).length;
          if (sentCount > 0) {
            const confirmed = window.confirm(`تم إرسال الدعوة لـ ${sentCount} ضيف. الصورة الجديدة ستظهر لكل من يفتح رابطه. متأكد؟`);
            if (!confirmed) {
              return;
            }
          }
        }
      } catch (e) {
        console.warn('Could not check sent guests count from DB:', e);
      }
    }

    setIsSavingCard(true);
    setCardUploadError(null);

    try {
      const res = await fetch(`/api/events/${activeEventId}/card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardImage: pendingCardPreview,
          cardImageCompressed: pendingCardCompressed || pendingCardPreview
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'فشل حفظ كرت الدعوة في الخادم');
      }

      const updatedEv = await res.json();

      setEventData(updatedEv);
      setPreviewCardImg(updatedEv.cardImage);
      handleCancelPendingCard();

      if (refreshData) {
        await refreshData(activeEventId);
      }

      if (showConfirmation) {
        showConfirmation('تم حفظ الكرت بنجاح!', 'تم رفع كرت الدعوة وحفظه لهذه المناسبة بنجاح.', 'success');
      }
    } catch (err) {
      console.error('Failed to save card:', err);
      setCardUploadError(err.message || 'تعذر حفظ الكرت، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSavingCard(false);
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

  // Download Updated Template File "تمبلت_الدعوات_المحدث.xlsx" (Phase 3 Req 4)
  const downloadExcelTemplate = () => {
    const link = document.createElement('a');
    link.href = '/تمبلت_الدعوات_المحدث.xlsx';
    link.setAttribute('download', 'تمبلت_الدعوات_المحدث.xlsx');
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

  // Parse Uploaded Excel (.xlsx / .xls / .csv) File supporting the updated template columns:
  // "م", "اسم الضيف", "رقم الجوال", "مرافق لـ", "التحقق (تلقائي)", "سبب المشكلة" (Phase 3 Req 5)
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
        
        const jsonObjects = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        const rawArrays = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        const extractedRows = [];

        // Method 1: Keyed Objects matching column headers
        if (jsonObjects && jsonObjects.length > 0) {
          jsonObjects.forEach((obj) => {
            let name = "";
            let phoneRaw = "";
            let companionOf = "";

            Object.keys(obj).forEach(key => {
              const val = (obj[key] !== undefined && obj[key] !== null) ? obj[key].toString().trim() : '';
              const keyClean = key.toString().trim();

              // Ignore validation / error reason columns
              if (keyClean.includes('التحقق') || keyClean.includes('تلقائي') || keyClean.includes('سبب المشكلة') || keyClean.includes('سبب')) {
                return;
              }

              if (keyClean.includes('مرافق') || keyClean.includes('تابع') || keyClean.toLowerCase().includes('companion') || keyClean.toLowerCase().includes('parent')) {
                companionOf = val;
              } else if (keyClean.includes('اسم') || keyClean.toLowerCase().includes('name')) {
                name = val;
              } else if (keyClean.includes('جوال') || keyClean.includes('هاتف') || keyClean.includes('موبايل') || keyClean.toLowerCase().includes('phone') || keyClean.toLowerCase().includes('mobile')) {
                phoneRaw = val;
              } else if (keyClean === 'م' || keyClean.toLowerCase() === 'id' || keyClean.toLowerCase() === '#') {
                // Row counter, ignore
              } else {
                // Heuristic fallback for unexpected headers
                const cleanDigits = val.replace(/\D/g, '');
                if (cleanDigits.length >= 8 && !phoneRaw) {
                  phoneRaw = val;
                } else if (val && isNaN(val) && !name) {
                  name = val;
                }
              }
            });

            // Skip fully empty rows
            if (!name && !phoneRaw && !companionOf) return;
            if (name === 'اسم الضيف' || name === 'الاسم') return;

            extractedRows.push({
              name,
              phone: phoneRaw,
              companionOf
            });
          });
        }

        // Method 2: Fallback 2D Array matching columns by header row
        if (extractedRows.length === 0 && rawArrays && rawArrays.length > 1) {
          let headerRowIdx = -1;
          let nameCol = -1;
          let phoneCol = -1;
          let companionCol = -1;

          for (let r = 0; r < Math.min(5, rawArrays.length); r++) {
            const row = rawArrays[r];
            if (!Array.isArray(row)) continue;
            row.forEach((cell, c) => {
              const str = (cell || '').toString().trim();
              if (str.includes('مرافق') || str.includes('تابع')) companionCol = c;
              else if (str.includes('اسم') || str.toLowerCase().includes('name')) nameCol = c;
              else if (str.includes('جوال') || str.includes('هاتف') || str.toLowerCase().includes('phone')) phoneCol = c;
            });
            if (nameCol !== -1) {
              headerRowIdx = r;
              break;
            }
          }

          const startIdx = headerRowIdx !== -1 ? headerRowIdx + 1 : 1;
          rawArrays.slice(startIdx).forEach(row => {
            if (!row || !Array.isArray(row) || row.length === 0) return;
            let name = "";
            let phoneRaw = "";
            let companionOf = "";

            if (nameCol !== -1) {
              name = (row[nameCol] || '').toString().trim();
              phoneRaw = phoneCol !== -1 ? (row[phoneCol] || '').toString().trim() : '';
              companionOf = companionCol !== -1 ? (row[companionCol] || '').toString().trim() : '';
            } else {
              row.forEach((cell, idx) => {
                if (!cell) return;
                const str = cell.toString().trim();
                const cleanDigits = str.replace(/\D/g, '');
                if (cleanDigits.length >= 8 && !phoneRaw) {
                  phoneRaw = str;
                } else if (idx === 1 && !name) {
                  name = str;
                } else if (idx === 3 && !companionOf) {
                  companionOf = str;
                }
              });
            }

            if (!name && !phoneRaw && !companionOf) return;
            if (name === 'اسم الضيف' || name === 'الاسم') return;

            extractedRows.push({
              name,
              phone: phoneRaw,
              companionOf
            });
          });
        }

        if (extractedRows.length > 0) {
          setPendingExcelRows(extractedRows);
        } else {
          alert('لم يتم العثور على بيانات صالحة في ملف الإكسل. يرجى التأكد من تعبئة عمود "اسم الضيف" في تمبلت_الدعوات_المحدث.xlsx.');
        }
      } catch (err) {
        alert('حدث خطأ أثناء قراءة ملف الإكسل. يرجى التأكد من رفع ملف XLSX صالح.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Confirm Save Validated Excel Guests (Called after atomic save in ExcelValidationModal)
  const handleConfirmValidationSave = async (result) => {
    if (refreshData) refreshData();
    const count = result?.savedCount || 0;
    if (result && (!result.errorCount || result.errorCount === 0)) {
      setPendingExcelRows(null);
    }
    if (showConfirmation) {
      showConfirmation('تم استيراد قائمة الضيوف بنجاح!', `تم فحص واعتماد ${count} مدعو بنجاح للمناسبة "${eventData?.title || ''}".`);
    } else {
      alert(`تم فحص واعتماد ${count} مدعو بنجاح للمناسبة "${eventData?.title || ''}"!`);
    }
  };

  // Smart Line Parser for Guest Name, Phone, and optional Count (e.g., وسن السيامي 0501234567 2)
  const parseGuestLine = (line) => {
    if (!line || !line.trim()) return null;
    let text = line.trim();

    // Remove leading numbering like "1.", "1-", etc.
    text = text.replace(/^\d+[\.\-\)]\s*/, '').trim();

    let phoneRaw = "";
    let nameRaw = "";
    let countRaw = 1;

    // Check if count is specified in parentheses like (2) or (2 مدعوين)
    const parenMatch = text.match(/\((\d+)[^\)]*\)/);
    if (parenMatch) {
      countRaw = parseInt(parenMatch[1]) || 1;
      text = text.replace(parenMatch[0], ' ').trim();
    }

    // Priority 1: Check standard separators (comma, arabic comma, dash, colon, tab)
    const separators = [',', '،', '\t', ' - ', ' – ', ' — ', '-', '|', ';'];
    const foundSep = separators.find(s => text.includes(s));

    if (foundSep) {
      const parts = text.split(foundSep).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const phoneIdx = parts.findIndex(p => p.replace(/\D/g, '').length >= 8);
        if (phoneIdx !== -1) {
          phoneRaw = parts[phoneIdx];
          const remainingParts = parts.filter((_, i) => i !== phoneIdx);
          const countIdx = remainingParts.findIndex(p => /^\d{1,2}$/.test(p));
          if (countIdx !== -1) {
            countRaw = parseInt(remainingParts[countIdx]) || countRaw;
            remainingParts.splice(countIdx, 1);
          }
          nameRaw = remainingParts.join(' ');
        } else {
          nameRaw = parts[0];
          phoneRaw = parts[1];
          if (parts[2] && /^\d{1,2}$/.test(parts[2])) {
            countRaw = parseInt(parts[2]) || 1;
          }
        }
      }
    }

    // Priority 2: Extract phone sequence matching Saudi or International formats
    if (!phoneRaw) {
      const phoneMatch = text.match(/(?:\+|00)?(?:966|0)?[5]\d{8}|\b05\d{8}\b|\b5\d{8}\b|\b\d{8,15}\b/);
      if (phoneMatch) {
        phoneRaw = phoneMatch[0];
        let remaining = text.replace(phoneRaw, '')
                            .replace(/[,،\-:\t|;]/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim();
        const endCountMatch = remaining.match(/\b([1-9]\d?)\s*$/);
        if (endCountMatch) {
          countRaw = parseInt(endCountMatch[1]) || countRaw;
          remaining = remaining.replace(endCountMatch[0], '').trim();
        }
        nameRaw = remaining;
      }
    }

    // Format the phone number
    const formatted = formatPhone(phoneRaw);
    if (!formatted) return null;

    const cleanName = nameRaw.trim() || 'ضيف عزيز';

    return {
      name: cleanName,
      phone: formatted,
      count: Math.max(1, countRaw)
    };
  };

  // Quick adjust guest seats count (+ / -) with instant DB sync
  const handleUpdateGuestCount = async (guestId, newCount) => {
    const cleanCount = Math.max(1, parseInt(newCount) || 1);
    const updated = (guests || []).map(g => g.id === guestId ? { ...g, count: cleanCount, companions: cleanCount } : g);
    setGuests(updated);

    try {
      await fetch(`/api/guests/${guestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: cleanCount, companions: cleanCount })
      });
      if (refreshData) refreshData();
    } catch (e) {
      console.error('Failed to update guest count on server', e);
    }
  };

  // Add Single Guest Directly (supports independent owner OR dependent)
  const handleSingleGuestSubmit = async (e) => {
    e.preventDefault();

    if (!singleName.trim()) {
      if (showConfirmation) {
        showConfirmation('حقل إلزامي', 'يرجى إدخال اسم الضيف (اسم الضيف حقل إلزامي).', 'info');
      } else {
        alert('يرجى إدخال اسم الضيف.');
      }
      return;
    }

    const isDependent = Boolean(singleParentId);
    let formattedPhone = null;

    if (!isDependent) {
      if (!singlePhone.trim()) {
        if (showConfirmation) {
          showConfirmation('حقل إلزامي', 'يرجى إدخال رقم جوال الضيف المستقل.', 'info');
        } else {
          alert('يرجى إدخال رقم جوال الضيف المستقل.');
        }
        return;
      }

      formattedPhone = formatPhone(singlePhone.trim());
      if (!formattedPhone || formattedPhone.length !== 12 || !formattedPhone.startsWith('9665')) {
        if (showConfirmation) {
          showConfirmation('رقم غير صالح', 'يرجى إدخال رقم جوال صحيح يبدأ بـ 05 ويتكون من 10 أرقام (مثال: 0501234567).', 'info');
        } else {
          alert('يرجى إدخال رقم جوال صحيح يبدأ بـ 05.');
        }
        return;
      }

      const existingPhones = new Set((guests || []).filter(g => !g.parent_guest_id).map(g => (g.phone || '').trim()));
      if (existingPhones.has(formattedPhone)) {
        if (showConfirmation) {
          showConfirmation('رقم مكرر', 'هذا الرقم موجود مسبقاً في قائمة هذه المناسبة.', 'info');
        } else {
          alert('هذا الرقم موجود مسبقاً في قائمة هذه المناسبة.');
        }
        return;
      }
    }

    const cleanName = singleName.trim();

    const newGuest = {
      id: "g_" + Date.now() + "_" + Math.floor(Math.random() * 100000),
      name: cleanName,
      phone: isDependent ? null : formattedPhone,
      parent_guest_id: isDependent ? singleParentId : null,
      status: "pending",
      ticketCode: "EV-" + Math.floor(100000 + Math.random() * 900000),
      checkedIn: false,
      checkInTime: null
    };

    try {
      const res = await fetch('/api/guests/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests: [newGuest], eventId: activeEventId })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'فشلت إضافة الضيف');
      }

      setSingleName('');
      setSinglePhone('');
      setSingleParentId('');
      setIsAddGuestModalOpen(false);
      if (refreshData) refreshData();

      const ownerName = isDependent ? (guests.find(g => g.id === singleParentId)?.name || 'صاحب الدعوة') : null;
      const successMsg = isDependent
        ? `تمت إضافة "${cleanName}" كمرافق للمدعو "${ownerName}" بنجاح.`
        : `تمت إضافة صاحب الدعوة "${cleanName}" برقم (${formattedPhone}) بنجاح.`;

      if (showConfirmation) {
        showConfirmation('تمت إضافة الضيف بنجاح!', successMsg);
      } else {
        alert(successMsg);
      }
    } catch (err) {
      if (showConfirmation) {
        showConfirmation('خطأ في البيانات', err.message, 'error');
      } else {
        alert(err.message);
      }
    }
  };

  // Process Batch Text Entry (with Smart Duplicate Check, Parsing, and Count)
  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    if (!batchText.trim()) return;

    const lines = batchText.trim().split('\n');
    const newGuests = [];
    const existingPhones = new Set((guests || []).map(g => (g.phone || '').trim()));

    let skippedDups = 0;

    lines.forEach(line => {
      const parsed = parseGuestLine(line);
      if (!parsed) return;

      if (existingPhones.has(parsed.phone)) {
        skippedDups++;
        return;
      }

      existingPhones.add(parsed.phone);

      newGuests.push({
        id: "g_" + Date.now() + "_" + Math.floor(Math.random() * 100000),
        name: parsed.name,
        phone: parsed.phone,
        count: parsed.count || 1,
        companions: parsed.count || 1,
        status: "pending",
        ticketCode: "EV-" + Math.floor(100000 + Math.random() * 900000),
        checkedIn: false,
        checkInTime: null
      });
    });

    if (newGuests.length > 0) {
      await saveBatchToApi(newGuests);
      setBatchText('');
      if (showConfirmation) {
        showConfirmation('تم إضافة الضيوف بنجاح!', `تم إضافة ${newGuests.length} مدعو جديد بنجاح إلى قائمة المناسبة.`);
      } else {
        alert(`تم إضافة ${newGuests.length} مدعو جديد بنجاح!`);
      }
    } else if (skippedDups > 0) {
      if (showConfirmation) {
        showConfirmation('بيانات مكررة', `جميع البيانات المدخلة مكررة وموجودة مسبقاً في القائمة (${skippedDups} مكرر).`, 'info');
      } else {
        alert(`جميع البيانات المدخلة مكررة وموجودة مسبقاً في القائمة (${skippedDups} مكرر).`);
      }
    }
  };

  // Retry single failed recipient (Phase 5 Req 5)
  const handleRetryFailedSingle = async (failedItem) => {
    const cleanInstance = instanceId.trim();
    const cleanToken = apiToken.trim();

    if (cleanInstance && cleanToken) {
      try {
        const res = await fetch('/api/whatsapp/send-single', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: failedItem.guestId,
            instanceId: cleanInstance,
            apiToken: cleanToken,
            hostUrl: window.location.origin,
            eventId: activeEventId,
            customMessage
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setFailedSends(prev => prev.filter(f => f.guestId !== failedItem.guestId));
          alert(`تمت إعادة الإرسال للمدعو "${failedItem.name}" بنجاح!`);
          if (refreshData) refreshData();
          return;
        }
        alert(data.error || 'فشلت إعادة الإرسال عبر البوابة');
      } catch (err) {
        alert('خطأ في الاتصال: ' + err.message);
      }
    } else {
      const g = (guests || []).find(item => item.id === failedItem.guestId);
      if (g) {
        const depList = (guests || []).filter(d => d.parent_guest_id === g.id);
        const fullText = renderWhatsAppMessage(customMessage, {
          guest: g,
          dependents: depList,
          event: eventData,
          baseUrl: window.location.origin
        });
        window.open(`https://api.whatsapp.com/send?phone=${g.phone}&text=${encodeURIComponent(fullText)}`, '_blank');
        setFailedSends(prev => prev.filter(f => f.guestId !== failedItem.guestId));
        if (refreshData) refreshData();
      }
    }
  };

  // Test Message Sender to Admin Number (Phase 5 Req 3)
  const handleSendTestMessage = async () => {
    if (!testPhone || !testPhone.trim()) {
      alert('يرجى إدخال رقم الجوال التجريبي أولاً');
      return;
    }

    const cleanTestPhone = testPhone.trim();
    localStorage.setItem('wa_test_phone', cleanTestPhone);

    const cleanInstance = instanceId.trim();
    const cleanToken = apiToken.trim();
    setIsSendingTest(true);
    setTestFeedback(null);

    const testGuest = selectedPreviewGuest || { name: 'ضيف تجريبي', id: 'test_sample', invite_token: 'test' };
    const testDeps = previewDependents || [];

    if (cleanInstance && cleanToken) {
      try {
        const res = await fetch('/api/whatsapp/send-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            testPhone: cleanTestPhone,
            instanceId: cleanInstance,
            apiToken: cleanToken,
            hostUrl: window.location.origin,
            eventId: activeEventId,
            customMessage,
            previewGuestId: testGuest.id
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setTestFeedback({ success: true, message: 'تم إرسال الرسالة التجريبية لرقمك بنجاح عبر البوابة!' });
        } else {
          setTestFeedback({ success: false, message: data.error || 'فشل إرسال الرسالة التجريبية عبر البوابة' });
        }
      } catch (err) {
        setTestFeedback({ success: false, message: 'تعذر الاتصال بالخادم: ' + err.message });
      } finally {
        setIsSendingTest(false);
      }
    } else {
      const renderedMsg = renderWhatsAppMessage(customMessage, {
        guest: testGuest,
        dependents: testDeps,
        event: eventData,
        baseUrl: window.location.origin
      });
      const waUrl = `https://api.whatsapp.com/send?phone=${cleanTestPhone}&text=${encodeURIComponent(renderedMsg)}`;
      window.open(waUrl, '_blank');
      setIsSendingTest(false);
      setTestFeedback({ success: true, message: 'تم فتح تطبيق واتساب لإرسال الرسالة التجريبية لرقمك بنجاح!' });
    }
  };

  // Trigger Automatic Batch Dispatcher for SELECTED guests (Phase 5 Requirements)
  const handleStartAutoDispatch = async () => {
    if (guests.length === 0) {
      alert('يرجى رفع ملف تمبلت الدعوات وإضافة أرقام المدعوين لهذه المناسبة أولاً.');
      return;
    }

    const selectedGuestsList = guests.filter(g => selectedGuestIds.includes(g.id) && !g.parent_guest_id);

    if (selectedGuestsList.length === 0) {
      alert('يرجى تحديد صاحب دعوة واحد على الأقل من القائمة أدناه لإرسال الدعوات إليهم.');
      return;
    }

    // Protection against accidental re-sending (Phase 5 Req 5)
    const alreadySentGuests = selectedGuestsList.filter(g => g.sent);
    let allowResend = false;
    if (alreadySentGuests.length > 0) {
      const confirmResend = window.confirm(
        `تنبيه:\nيوجد (${alreadySentGuests.length}) مدعو من أصل (${selectedGuestsList.length}) محدد تم إرسال الدعوة لهم مسبقاً.\n\nهل ترغب في إعادة الإرسال لهم بالتأكيد؟\n(اضغط "موافق" لإعادة الإرسال للجميع، أو "إلغاء" لاستبعادهم وإرسال الدعوة لمن لم يُرسل لهم فقط)`
      );
      if (confirmResend) {
        allowResend = true;
      }
    }

    const finalTargets = allowResend ? selectedGuestsList : selectedGuestsList.filter(g => !g.sent);
    if (finalTargets.length === 0) {
      alert('تم استبعاد جميع المحددين لأن الدعوة أُرسلت لهم مسبقاً، ولم يتم تأكيد خيار إعادة الإرسال.');
      return;
    }

    // Mandatory confirmation showing exact count (Phase 5 Req 5)
    const proceedConfirm = window.confirm(
      `سيتم إرسال (${finalTargets.length}) رسالة واتساب لمناسبة "${eventData?.title || ''}".\nهل أنت متأكد من المتابعة؟`
    );
    if (!proceedConfirm) return;

    const cleanInstance = instanceId.trim();
    const cleanToken = apiToken.trim();

    if (cleanInstance && !cleanInstance.includes('••••') && cleanToken && !cleanToken.includes('••••')) {
      handleSaveWhatsAppConfig(cleanInstance, cleanToken);
    }
    localStorage.setItem('wa_custom_message', customMessage);

    setFailedSends([]);

    // Mode A: Server-Side API Gateway Dispatch (If server config exists OR credentials typed)
    if (hasServerWhatsAppConfig || (cleanInstance && cleanToken)) {
      setIsSendingAuto(true);
      setAutoProgress({ sent: 0, total: finalTargets.length, currentName: finalTargets[0]?.name || '' });

      try {
        const res = await fetch('/api/send-whatsapp-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceId: cleanInstance,
            apiToken: cleanToken,
            hostUrl: window.location.origin,
            eventId: activeEventId,
            guestIds: finalTargets.map(g => g.id),
            customMessage: customMessage,
            allowResend: true
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setAutoProgress({ sent: data.sentCount, total: data.total, currentName: 'مكتمل' });
          if (data.failed && data.failed.length > 0) {
            setFailedSends(data.failed);
          }
          const successNotice = `تم الانتهاء من الإرسال بنجاح لـ ${data.sentCount} من أصل ${data.total} مدعو في مناسبة "${eventData?.title || ''}"!`;
          const failedNotice = data.failed?.length > 0 ? `\n(تعذر الإرسال لـ ${data.failed.length} مدعو، يمكنك مراجعة سجل الإرسال المتعثر وإعادة المحاولة أدناه)` : '';
          alert(successNotice + failedNotice);
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
      `لم تقم بإدخال Instance ID و API Token لبوابة الواتساب الآلية.\n\nهل ترغب في البدء بالإرسال المباشر لـ (${finalTargets.length}) مدعو عبر فتح تطبيق الواتساب بالتتابع؟`
    );

    if (!proceedDirect) return;

    setIsSendingAuto(true);
    let sentSuccess = 0;
    const failedList = [];

    for (let i = 0; i < finalTargets.length; i++) {
      const g = finalTargets[i];
      setAutoProgress({ sent: i + 1, total: finalTargets.length, currentName: g.name });

      try {
        const depList = (guests || []).filter(d => d.parent_guest_id === g.id);
        const fullText = renderWhatsAppMessage(customMessage, {
          guest: g,
          dependents: depList,
          event: eventData,
          baseUrl: window.location.origin
        });

        const waMsg = encodeURIComponent(fullText);
        const waUrl = `https://api.whatsapp.com/send?phone=${g.phone}&text=${waMsg}`;

        window.open(waUrl, '_blank');
        g.sent = true;
        sentSuccess++;

        try {
          await fetch('/api/guests/sent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId: activeEventId, guestIds: [g.id] })
          });
        } catch (err) {
          console.warn('Failed to sync sent state:', err);
        }

        // Random delay between 3-8 seconds to protect sending (Phase 5 Req 5)
        if (i < finalTargets.length - 1) {
          const delay = Math.floor(Math.random() * (4500 - 2500 + 1)) + 2500;
          await new Promise(r => setTimeout(r, delay));
        }
      } catch (err) {
        failedList.push({ guestId: g.id, name: g.name, phone: g.phone, errorReason: err.message });
      }
    }

    setIsSendingAuto(false);
    if (failedList.length > 0) {
      setFailedSends(failedList);
    }
    alert(`تم فتح الواتساب وإتمام الإرسال لـ ${sentSuccess} مدعو بنجاح!`);
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

  // Delete Single Guest with dependent check
  const handleDeleteGuest = async (id) => {
    const targetGuest = (guests || []).find(g => g.id === id);
    if (!targetGuest) return;

    const dependents = (guests || []).filter(g => g.parent_guest_id === id);

    if (dependents.length > 0) {
      setDeleteConfirmModal({
        isOpen: true,
        guest: targetGuest,
        dependents
      });
      return;
    }

    if (window.confirm(`هل أنت متأكد من حذف المدعو "${targetGuest.name}"؟`)) {
      await executeDeleteGuest(id, true);
    }
  };

  const executeDeleteGuest = async (id, deleteDependents = true) => {
    try {
      await fetch(`/api/guests/${id}?eventId=${activeEventId}&deleteDependents=${deleteDependents}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to delete guest from server', e);
    }
    setDeleteConfirmModal(null);
    if (refreshData) refreshData();
  };

  // Group all guests into owner units (each unit contains owner + their dependents)
  const ownerUnits = useMemo(() => {
    const ownerMap = new Map();

    (guests || []).forEach(g => {
      if (!g.parent_guest_id) {
        ownerMap.set(g.id, { ...g, dependents: [] });
      }
    });

    (guests || []).forEach(g => {
      if (g.parent_guest_id) {
        if (ownerMap.has(g.parent_guest_id)) {
          ownerMap.get(g.parent_guest_id).dependents.push(g);
        } else {
          ownerMap.set(g.id, { ...g, dependents: [], isOrphan: true });
        }
      }
    });

    return Array.from(ownerMap.values());
  }, [guests]);

  // Filter owner units by search query and status filter
  const filteredUnits = useMemo(() => {
    let result = ownerUnits;

    // 1. Search Query (Name or Phone)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const qNorm = q.replace(/[\u064B-\u065F\u0670]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ');
      const qDigits = q.replace(/\D/g, '');

      result = result.filter(unit => {
        const ownerNameNorm = (unit.name || '').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').toLowerCase();
        const ownerPhone = (unit.phone || '').replace(/\D/g, '');

        const ownerMatch = ownerNameNorm.includes(qNorm) || (qDigits.length >= 3 && ownerPhone.includes(qDigits));
        const depMatch = unit.dependents.some(d => {
          const depNameNorm = (d.name || '').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').toLowerCase();
          return depNameNorm.includes(qNorm);
        });

        return ownerMatch || depMatch;
      });
    }

    // 2. Status Filter
    if (statusFilter !== 'all') {
      result = result.filter(unit => {
        const ownerMatches = statusFilter === 'accepted' ? unit.status === 'accepted'
          : statusFilter === 'declined' ? unit.status === 'declined'
          : statusFilter === 'pending' ? unit.status === 'pending'
          : statusFilter === 'unsent' ? !unit.sent
          : true;

        const depMatches = unit.dependents.some(d => {
          if (statusFilter === 'accepted') return d.status === 'accepted';
          if (statusFilter === 'declined') return d.status === 'declined';
          if (statusFilter === 'pending') return d.status === 'pending';
          if (statusFilter === 'unsent') return !unit.sent;
          return true;
        });

        return ownerMatches || depMatches;
      });
    }

    return result;
  }, [ownerUnits, searchQuery, statusFilter]);

  // Total people in current filtered view (owners + companions)
  const filteredPeopleCount = useMemo(() => {
    return filteredUnits.reduce((acc, u) => acc + 1 + (u.dependents?.length || 0), 0);
  }, [filteredUnits]);

  // Flat list of all table rows (owners + companions), preserving parent-dependent grouping
  const allTableRows = useMemo(() => {
    const rows = [];
    filteredUnits.forEach(owner => {
      rows.push({
        type: 'owner',
        guest: owner,
        owner: owner
      });
      if (owner.dependents && owner.dependents.length > 0) {
        owner.dependents.forEach(dep => {
          rows.push({
            type: 'dependent',
            guest: dep,
            owner: owner
          });
        });
      }
    });
    return rows;
  }, [filteredUnits]);

  // Phase 6: Overall Live Statistics (Counting actual people, not invitations)
  const total = (guests || []).length;
  const ownersCount = (guests || []).filter(g => !g.parent_guest_id).length;
  const dependentsCount = (guests || []).filter(g => g.parent_guest_id).length;

  const accepted = (guests || []).filter(g => g.status === 'accepted').length;
  const acceptedOwners = (guests || []).filter(g => !g.parent_guest_id && g.status === 'accepted').length;
  const acceptedDeps = (guests || []).filter(g => g.parent_guest_id && g.status === 'accepted').length;

  const declined = (guests || []).filter(g => g.status === 'declined').length;
  const declinedOwners = (guests || []).filter(g => !g.parent_guest_id && g.status === 'declined').length;
  const declinedDeps = (guests || []).filter(g => g.parent_guest_id && g.status === 'declined').length;

  const pending = (guests || []).filter(g => !g.status || g.status === 'pending').length;
  const pendingOwners = (guests || []).filter(g => !g.parent_guest_id && (!g.status || g.status === 'pending')).length;
  const pendingDeps = (guests || []).filter(g => g.parent_guest_id && (!g.status || g.status === 'pending')).length;

  const sentCount = (guests || []).filter(g => !g.parent_guest_id && g.sent).length;
  const unsentCount = (guests || []).filter(g => !g.parent_guest_id && !g.sent).length;

  // Phase 6 Requirement: Response Rate (Percentage who replied out of actual people)
  const responded = accepted + declined;
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;
  const acceptanceRate = total > 0 ? Math.round((accepted / total) * 100) : 0;
  const declineRate = total > 0 ? Math.round((declined / total) * 100) : 0;
  const pendingRate = total > 0 ? Math.round((pending / total) * 100) : 0;

  // Aliases for backward compatibility
  const totalSeats = total;
  const acceptedSeats = accepted;
  const pendingSeats = pending;

  const getFilterLabel = () => {
    switch (statusFilter) {
      case 'accepted':
        return `حضور مؤكد (${accepted})`;
      case 'declined':
        return `معتذرون (${declined})`;
      case 'pending':
        return `بانتظار الرد (${pending})`;
      case 'unsent':
        return `لم يُرسل بعد (${unsentCount})`;
      case 'all':
      default:
        return `الكل (${guests.length})`;
    }
  };

  // Handle adding companion directly from owner's row (Phase 2 Req 3)
  const handleSaveCompanion = async (e) => {
    e.preventDefault();
    if (!addCompanionModal || !addCompanionModal.companionName?.trim()) {
      alert('يرجى كتابة اسم المرافق.');
      return;
    }

    const cleanName = addCompanionModal.companionName.trim();
    const newGuest = {
      id: "g_" + Date.now() + "_" + Math.floor(Math.random() * 100000),
      name: cleanName,
      phone: null,
      parent_guest_id: addCompanionModal.ownerId,
      status: "pending",
      ticketCode: "EV-" + Math.floor(100000 + Math.random() * 900000),
      checkedIn: false,
      checkInTime: null
    };

    try {
      const res = await fetch('/api/guests/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests: [newGuest], eventId: activeEventId })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'فشلت إضافة المرافق');
      }
      setAddCompanionModal(null);
      if (refreshData) refreshData();
      if (showConfirmation) {
        showConfirmation('تمت إضافة المرافق!', `تمت إضافة "${cleanName}" كمرافق للمدعو "${addCompanionModal.ownerName}" بنجاح.`);
      } else {
        alert(`تمت إضافة "${cleanName}" كمرافق للمدعو "${addCompanionModal.ownerName}" بنجاح.`);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Open edit modal for guest (Phase 2 Req 4)
  const handleOpenEdit = (guest) => {
    const isDep = Boolean(guest.parent_guest_id);
    const deps = (guests || []).filter(g => g.parent_guest_id === guest.id);
    setEditingGuestModal({
      id: guest.id,
      name: guest.name || '',
      phone: guest.phone || '',
      parent_guest_id: guest.parent_guest_id || '',
      isDependent: isDep,
      hasDependents: deps.length > 0,
      dependentsCount: deps.length
    });
  };

  // Save guest edits (Phase 2 Req 4)
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingGuestModal) return;

    const cleanName = editingGuestModal.name.trim();
    if (!cleanName) {
      alert('يرجى إدخال اسم الضيف.');
      return;
    }

    let cleanPhone = null;
    let parentId = null;

    if (editingGuestModal.isDependent) {
      if (!editingGuestModal.parent_guest_id) {
        alert('يرجى اختيار صاحب الدعوة الذي يتبعه هذا المرافق.');
        return;
      }
      parentId = editingGuestModal.parent_guest_id;
      cleanPhone = null;
    } else {
      if (!editingGuestModal.phone || !editingGuestModal.phone.trim()) {
        alert('يرجى إدخال رقم جوال صحيح للضيف.');
        return;
      }
      cleanPhone = formatPhone(editingGuestModal.phone.trim());
      if (!cleanPhone || cleanPhone.length !== 12 || !cleanPhone.startsWith('9665')) {
        alert('يرجى إدخال رقم جوال صحيح يبدأ بـ 05 ويتكون من 10 أرقام (مثال: 0501234567).');
        return;
      }
      parentId = null;
    }

    try {
      const res = await fetch(`/api/guests/${editingGuestModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          phone: cleanPhone,
          parent_guest_id: parentId,
          eventId: activeEventId
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'فشل حفظ التعديلات');
      }
      setEditingGuestModal(null);
      if (refreshData) refreshData();
      if (showConfirmation) {
        showConfirmation('تم حفظ التعديلات!', `تم تحديث بيانات الضيف "${cleanName}" بنجاح.`);
      } else {
        alert(`تم تحديث بيانات الضيف "${cleanName}" بنجاح.`);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Export filtered guests to Excel (Phase 2 Req 6)
  const handleExportToExcel = () => {
    if (!filteredUnits || filteredUnits.length === 0) {
      alert('لا توجد بيانات لتصديرها.');
      return;
    }

    const rows = [
      ['م', 'اسم الضيف', 'رقم الجوال', 'التبعية / المرافقون', 'الحالة']
    ];

    let counter = 1;
    filteredUnits.forEach(unit => {
      const ownerStatusText = unit.status === 'accepted' ? 'حضور مؤكد'
        : unit.status === 'declined' ? 'معتذر'
        : unit.sent ? 'تم الإرسال (بانتظار الرد)'
        : 'لم يُرسل بعد';

      const depBadge = unit.dependents.length > 0
        ? `صاحب دعوة (${unit.dependents.length} مرافقين)`
        : 'ضيف مستقل';

      rows.push([
        counter++,
        unit.name,
        unit.phone ? `'${unit.phone}` : '-',
        depBadge,
        ownerStatusText
      ]);

      unit.dependents.forEach(dep => {
        const depStatusText = dep.status === 'accepted' ? 'حضور مؤكد'
          : dep.status === 'declined' ? 'معتذر'
          : `عبر دعوة ${unit.name}`;

        rows.push([
          '↳',
          `↳ ${dep.name}`,
          '-',
          `مرافق لـ ${unit.name}`,
          depStatusText
        ]);
      });
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!views'] = [{ rightToLeft: true }];
    ws['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 18 }, { wch: 25 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'قائمة المدعوين');
    const safeTitle = (eventData?.title || 'المناسبة').replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(wb, `قائمة_المدعوين_${safeTitle}.xlsx`);
  };

  const baseUrl = window.location.origin;

  return (
    <div className="apple-dashboard">

      {/* EXCEL VALIDATION MODAL OVERLAY */}
      {pendingExcelRows && (
        <ExcelValidationModal
          rawRows={pendingExcelRows}
          existingGuests={guests}
          activeEventId={activeEventId}
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
          <div className="apple-card" style={{ padding: '16px 22px', background: 'var(--pink-light)', border: '1.5px solid var(--pink-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <Layers size={26} style={{ color: 'var(--pink-primary)' }} />
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--pink-dark)', fontWeight: 700 }}>المناسبة النشطة حالياً لإدارة المدعوين:</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{eventData?.title || 'مناسبة بدون عنوان'}</h2>
              </div>
            </div>

            {/* WhatsApp Gateway Settings Modal Trigger (Icon Only) */}
            <button
              type="button"
              className="apple-btn apple-btn-secondary"
              onClick={() => setIsGatewayModalOpen(true)}
              style={{
                width: '38px',
                height: '38px',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#ffffff',
                borderColor: 'rgba(64, 123, 161, 0.25)',
                color: 'var(--pink-primary)',
                borderRadius: '50%',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                cursor: 'pointer'
              }}
              title="إعدادات بوابة الواتساب"
              aria-label="إعدادات بوابة الواتساب"
            >
              <Settings size={18} />
            </button>
          </div>

          {/* STATISTICAL METRICS WIDGETS */}
          <div className="apple-card" style={{ background: '#ffffff', border: '1.5px solid rgba(64, 123, 161, 0.25)', marginBottom: 0 }}>
            <div className="card-title-row" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <BarChart3 size={20} style={{ color: 'var(--pink-primary)' }} /> إحصائيات المناسبة
              </h2>
            </div>

            {/* 4 Widgets Grid (2x2) */}
            <div className="widgets-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
              {/* Widget 1: Total invitees */}
              <div className="apple-widget">
                <div className="widget-icon pink"><Users size={24} /></div>
                <div>
                  <div className="widget-val">
                    {total} <small style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>شخص</small>
                  </div>
                  <div className="widget-lbl">إجمالي المدعوين</div>
                </div>
              </div>

              {/* Widget 2: Confirmed attendance */}
              <div className="apple-widget">
                <div className="widget-icon green"><CheckCircle2 size={24} /></div>
                <div>
                  <div className="widget-val">
                    {accepted}
                  </div>
                  <div className="widget-lbl">حضور مؤكد</div>
                </div>
              </div>

              {/* Widget 3: Declined */}
              <div className="apple-widget">
                <div className="widget-icon red"><XCircle size={24} /></div>
                <div>
                  <div className="widget-val">
                    {declined}
                  </div>
                  <div className="widget-lbl">معتذرون</div>
                </div>
              </div>

              {/* Widget 4: Awaiting response */}
              <div className="apple-widget">
                <div className="widget-icon amber"><Clock size={24} /></div>
                <div>
                  <div className="widget-val">
                    {pending}
                  </div>
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
                {/* Row 1: Title & Location side-by-side */}
                <div className="grid-2col" style={{ gap: '14px', marginBottom: '14px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>عنوان المناسبة / الحفل</label>
                    <input
                      type="text"
                      className="apple-input"
                      value={eventData?.title || ''}
                      onChange={(e) => setEventData({ ...eventData, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>مكان المناسبة (اسم القاعة / الفندق / المدينة)</label>
                    <input
                      type="text"
                      className="apple-input"
                      value={eventData?.location || ''}
                      onChange={(e) => setEventData({ ...eventData, location: e.target.value })}
                    />
                  </div>
                </div>

                {/* Row 2: Date & Time side-by-side */}
                <div className="grid-2col" style={{ gap: '14px', marginBottom: '14px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>تاريخ المناسبة</label>
                    <input
                      type="date"
                      className="apple-input"
                      value={eventData?.date || ''}
                      onChange={(e) => setEventData({ ...eventData, date: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>وقت المناسبة</label>
                    <input
                      type="time"
                      className="apple-input"
                      value={eventData?.time || '20:00'}
                      onChange={(e) => setEventData({ ...eventData, time: e.target.value })}
                    />
                  </div>
                </div>

                {/* Row 3: Google Maps Link full-width */}
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label>رابط اللوكيشن في خرائط جوجل (Google Maps)</label>
                  <input
                    type="text"
                    className="apple-input"
                    style={{ direction: 'ltr', textAlign: 'right' }}
                    placeholder="مثال: https://maps.app.goo.gl/... أو اتركه فارغاً"
                    value={eventData?.mapLink || ''}
                    onChange={(e) => setEventData({ ...(eventData || {}), mapLink: e.target.value })}
                  />
                </div>

                {/* Row 4: Card Image Upload & Preview Flow (Phase 8) */}
                <div className="form-group" style={{ borderTop: '1px solid rgba(64, 123, 161, 0.2)', paddingTop: '16px', marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <label className="apple-btn apple-btn-secondary" style={{ cursor: 'pointer', fontSize: '0.84rem' }}>
                      <Upload size={15} />
                      {eventData?.cardImage ? 'تغيير صورة كرت الدعوة' : 'اختر صورة الكرت'}
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={handleCardFileSelect}
                        style={{ display: 'none' }}
                      />
                    </label>

                    {eventData?.cardImage && (
                      /* View Image Button: Eye icon only in place of thumbnail */
                      <button
                        type="button"
                        className="apple-btn apple-btn-secondary"
                        style={{
                          width: '36px',
                          height: '36px',
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '10px'
                        }}
                        onClick={() => setFullViewImage(eventData.cardImage)}
                        title="عرض كرت الدعوة بالحجم الكامل"
                        aria-label="عرض كرت الدعوة"
                      >
                        <Eye size={17} />
                      </button>
                    )}
                  </div>

                  {/* Validation Error Message */}
                  {cardUploadError && (
                    <div style={{ color: '#dc2626', fontSize: '0.82rem', marginTop: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={14} /> {cardUploadError}
                    </div>
                  )}

                  {/* Save Details Button: only shown when user types/changes something in the fields */}
                  {hasEventChanges && (
                    <div style={{ marginTop: '16px' }}>
                      <button type="button" onClick={handleEventSubmit} className="apple-btn apple-btn-pink btn-block" style={{ padding: '10px 24px', fontSize: '0.92rem', cursor: 'pointer' }}>
                        حفظ تفاصيل المناسبة
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Form 2: WhatsApp Customization */}
            <div className="apple-card" style={{ marginBottom: 0 }}>
              <div style={{ marginBottom: '16px' }}>
                <h2 style={{ margin: 0, marginBottom: '10px' }}>
                  <MessageCircle className="system-gold" size={20} /> 2. تخصيص مقدمة رسالة الواتساب
                </h2>
                
                {/* Intro Preset Switchers placed under the box title */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="apple-btn apple-btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '5px 12px' }}
                    onClick={() => {
                      const msg = 'يسرنا ويسعدنا دعوتكم لحضور حفلنا وتكتمل فرحتنا بمشاركتكم.';
                      setCustomMessage(msg);
                      localStorage.setItem('wa_custom_message', msg);
                    }}
                    title="مقدمة ترحيبية أساسية"
                  >
                    مقدمة ترحيبية
                  </button>
                  <button
                    type="button"
                    className="apple-btn apple-btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '5px 12px' }}
                    onClick={() => {
                      const msg = 'يسرنا ويسعدنا دعوتكم لحضور حفلنا، ويسعدنا حضوركم مع مرافقينكم الكرام وتكتمل فرحتنا بكم.';
                      setCustomMessage(msg);
                      localStorage.setItem('wa_custom_message', msg);
                    }}
                    title="مقدمة دعوة عائلية ومع المرافقين"
                  >
                    مقدمة عائلية
                  </button>
                  <button
                    type="button"
                    className="apple-btn apple-btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '5px 12px' }}
                    onClick={() => {
                      const msg = 'نود تذكيركم بموعد حفلنا القريب، ويسعدنا ويشرفنا تأكيد حضوركم لمشاركتنا هذه الفرحة.';
                      setCustomMessage(msg);
                      localStorage.setItem('wa_custom_message', msg);
                    }}
                    title="مقدمة تذكير بموعد الحفل"
                  >
                    مقدمة تذكير
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', display: 'block' }}>
                  مقدمة رسالة الدعوة (تظهر في بداية الرسالة قبل تفاصيل المناسبة ورابط الدعوة):
                </label>
                <textarea
                  className="apple-input"
                  rows="3"
                  value={customMessage}
                  onChange={(e) => {
                    setCustomMessage(e.target.value);
                    localStorage.setItem('wa_custom_message', e.target.value);
                  }}
                  placeholder="اكتب نص المقدمة الترحيبية هنا (مثال: يسرنا ويسعدنا دعوتكم لحضور حفلنا وتكتمل فرحتنا بمشاركتكم)..."
                  style={{ lineHeight: '1.6', fontFamily: 'inherit' }}
                ></textarea>
              </div>

              {/* Action row: Toggle Message Preview */}
              <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                {!isMessagePreviewOpen ? (
                  <button
                    type="button"
                    className="apple-btn apple-btn-secondary"
                    onClick={() => setIsMessagePreviewOpen(true)}
                    style={{ fontSize: '0.84rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Eye size={15} /> معاينة الرسالة
                  </button>
                ) : (
                  <button
                    type="button"
                    className="apple-btn apple-btn-secondary"
                    onClick={() => setIsMessagePreviewOpen(false)}
                    style={{ fontSize: '0.84rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <EyeOff size={15} /> إخفاء
                  </button>
                )}
              </div>

              {/* Live Message Preview Box with Real Guest Selector */}
              {isMessagePreviewOpen && (
                <div style={{ background: '#f0f5f9', border: '1px solid rgba(64, 123, 161, 0.25)', borderRadius: '14px', padding: '14px 18px', marginBottom: '14px', fontSize: '0.86rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ fontWeight: 800, color: 'var(--pink-dark)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={16} /> معاينة حية لشكل رسالة الواتساب الجاهزة بكافة التفاصيل:
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Real Guest Selector */}
                      {ownerGuests.length > 0 && (
                        <select
                          className="apple-input"
                          style={{ padding: '4px 10px', fontSize: '0.78rem', height: '32px', minWidth: '160px' }}
                          value={previewGuestId || (selectedPreviewGuest?.id || '')}
                          onChange={(e) => setPreviewGuestId(e.target.value)}
                          title="اختر ضيفاً لمعاينة شكل الرسالة الموجهة إليه"
                        >
                          {ownerGuests.map(o => {
                            const depCount = (guests || []).filter(d => d.parent_guest_id === o.id).length;
                            return (
                              <option key={o.id} value={o.id}>
                                معاينة لـ: {o.name} {depCount > 0 ? `(${depCount} مرافقين)` : ''}
                              </option>
                            );
                          })}
                        </select>
                      )}

                      {/* Test Send Button (Phase 5 Req 3) */}
                      <button
                        type="button"
                        className="apple-btn apple-btn-secondary"
                        style={{ padding: '4px 12px', fontSize: '0.78rem', height: '32px', color: 'var(--pink-dark)', borderColor: 'var(--pink-primary)' }}
                        onClick={() => {
                          setTestFeedback(null);
                          setIsTestModalOpen(true);
                        }}
                        title="إرسال تجريبي لرقم هاتفك الخاص للتحقق من المظهر في تطبيق واتساب"
                      >
                        <Smartphone size={14} /> إرسال تجريبي لرقمي أولاً
                      </button>

                      {/* Hide Preview Button */}
                      <button
                        type="button"
                        className="apple-btn apple-btn-secondary"
                        style={{ padding: '4px 12px', fontSize: '0.78rem', height: '32px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => setIsMessagePreviewOpen(false)}
                        title="إخفاء معاينة الرسالة"
                      >
                        <EyeOff size={14} /> إخفاء
                      </button>
                    </div>
                  </div>

                  {/* Companion info badge if guest has dependents */}
                  {selectedPreviewGuest && previewDependents.length > 0 && (
                    <div style={{ marginBottom: '8px' }}>
                      <span className="ios-badge" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', fontSize: '0.75rem', padding: '3px 10px' }}>
                        👥 مرافقو {selectedPreviewGuest.name}: {previewDependents.map(d => d.name).join(' و ')}
                      </span>
                    </div>
                  )}

                  {/* Rendered Text Box */}
                  <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line', background: '#ffffff', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.08)', lineHeight: '1.65', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                    {renderedLivePreview}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* STREAMLINED GUESTS TABLE CARD */}
      <div className="apple-card" style={{ marginBottom: '28px' }}>
        <div className="card-title-row" style={{ marginBottom: '14px' }}>
          <div>
            <h2 style={{ margin: 0 }}><Users className="system-gold" size={20} /> 3. قائمة المدعوين</h2>
          </div>
        </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
            {/* Right side: Search Box & Filter Icon Group + Add Guest button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '230px', maxWidth: '100%' }}>
                <Search size={15} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  className="apple-input"
                  placeholder="بحث بالاسم أو رقم الجوال..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingRight: '34px', paddingLeft: '28px', height: '36px', fontSize: '0.84rem' }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0 }}
                    title="مسح البحث"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Inline Filter Dropdown Button (Icon Only) directly next to search */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={`apple-btn ${statusFilter !== 'all' ? 'apple-btn-pink' : 'apple-btn-secondary'}`}
                  onClick={() => setIsFilterMenuOpen(prev => !prev)}
                  style={{
                    padding: '7px 11px',
                    height: '36px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                  title={`تصفية حسب الحالة (${getFilterLabel()})`}
                  aria-label="تصفية حسب الحالة"
                >
                  <Filter size={16} />
                  {statusFilter !== 'all' && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        boxShadow: '0 0 4px rgba(0,0,0,0.3)'
                      }}
                    />
                  )}
                </button>

                {isFilterMenuOpen && (
                  <>
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                      onClick={() => setIsFilterMenuOpen(false)}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        background: 'rgba(255, 255, 255, 0.98)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        boxShadow: '0 14px 40px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)',
                        borderRadius: '16px',
                        border: '1px solid rgba(0, 0, 0, 0.08)',
                        padding: '6px',
                        zIndex: 50,
                        minWidth: '210px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                    >
                      <div
                        style={{
                          padding: '6px 12px 6px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#64748b',
                          letterSpacing: '0.3px',
                          borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                          marginBottom: '3px'
                        }}
                      >
                        تصفية حسب الحالة
                      </div>

                      {[
                        { id: 'all', label: 'الكل', count: guests.length, dot: null, badgeBg: '#f1f5f9', badgeColor: '#334155' },
                        { id: 'accepted', label: 'حضور مؤكد', count: accepted, dot: '#22c55e', badgeBg: '#dcfce7', badgeColor: '#15803d' },
                        { id: 'declined', label: 'معتذرون', count: declined, dot: '#ef4444', badgeBg: '#fee2e2', badgeColor: '#b91c1c' },
                        { id: 'pending', label: 'بانتظار الرد', count: pending, dot: '#f59e0b', badgeBg: '#fef3c7', badgeColor: '#b45309' },
                        { id: 'unsent', label: 'لم يُرسل بعد', count: unsentCount, dot: '#64748b', badgeBg: '#f1f5f9', badgeColor: '#475569' }
                      ].map(opt => {
                        const isSelected = statusFilter === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setStatusFilter(opt.id);
                              setIsFilterMenuOpen(false);
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              fontSize: '0.82rem',
                              fontWeight: isSelected ? 700 : 500,
                              borderRadius: '10px',
                              border: 'none',
                              background: isSelected ? 'rgba(64, 123, 161, 0.1)' : 'transparent',
                              color: isSelected ? 'var(--pink-primary)' : 'var(--text-primary)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              textAlign: 'right'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {opt.dot ? (
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: opt.dot, flexShrink: 0 }} />
                              ) : (
                                <span style={{ width: '8px', height: '8px' }} />
                              )}
                              <span>{opt.label}</span>
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  background: opt.badgeBg,
                                  color: opt.badgeColor,
                                  fontWeight: 700
                                }}
                              >
                                {opt.count}
                              </span>
                              {isSelected && <Check size={14} style={{ color: 'var(--pink-primary)' }} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                className="apple-btn apple-btn-pink"
                onClick={() => setIsAddGuestModalOpen(true)}
                style={{
                  height: '36px',
                  padding: '7px 14px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                <UserPlus size={16} /> إضافة جديد
              </button>
            </div>

            {/* Left side: Selection Badge, Reminder, Unsent & Send Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {selectedGuestIds.length > 0 && (
                <span className="ios-badge ios-badge-pink" style={{ fontSize: '0.82rem', padding: '6px 12px', fontWeight: 800 }}>
                  تم تحديد {selectedGuestIds.length} ضيف
                </span>
              )}

              <button
                type="button"
                className="apple-btn apple-btn-secondary"
                onClick={handleSelectPendingReminderOnly}
                style={{ fontSize: '0.78rem', padding: '6px 12px', height: '36px' }}
                title="تحديد من وصلتهم الدعوة ولم يؤكدوا الحضور بعد لإرسال تذكير قبل المناسبة بيوم"
              >
                تذكير قبل المناسبة بيوم
              </button>

              <button
                type="button"
                className="apple-btn apple-btn-secondary"
                onClick={handleSelectUnsentOnly}
                style={{ fontSize: '0.82rem', padding: '6px 14px', height: '36px' }}
                title="تحديد من لم تُرسل لهم الدعوة بعد"
              >
                غير المرسل لهم
              </button>

              <button
                type="button"
                className="apple-btn apple-btn-pink"
                style={{ padding: '8px 18px', height: '36px', fontSize: '0.88rem', fontWeight: 800, boxShadow: '0 4px 14px rgba(64, 123, 161, 0.3)' }}
                onClick={handleStartAutoDispatch}
                disabled={isSendingAuto || selectedGuestIds.length === 0}
              >
                {isSendingAuto ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Send size={15} /> إرسال
                  </>
                )}
              </button>
            </div>
          </div>

        {/* Live Auto Sending Progress Bar */}
        {isSendingAuto && autoProgress && (
          <div style={{ background: 'rgba(240, 245, 249, 0.9)', padding: '14px 18px', borderRadius: '14px', border: '1px solid rgba(64, 123, 161, 0.3)', marginTop: '14px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', fontWeight: 700, marginBottom: '6px', color: 'var(--pink-dark)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--pink-primary)' }} />
                جاري الإرسال الآلي لـ: {autoProgress.currentName}...
              </span>
              <span>{autoProgress.sent} / {autoProgress.total} رسالة</span>
            </div>
            <div style={{ width: '100%', height: '10px', background: 'rgba(64, 123, 161, 0.15)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ width: `${(autoProgress.sent / autoProgress.total) * 100}%`, height: '100%', background: 'var(--pink-gradient)', transition: 'width 0.4s ease' }}></div>
            </div>
          </div>
        )}

        {/* Failed Sends Log & Retry Table (Phase 5 Req 5) */}
        {failedSends.length > 0 && (
          <div style={{ background: '#fff1f2', border: '1.5px solid #fca5a5', borderRadius: '14px', padding: '16px 20px', marginTop: '14px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontWeight: 800, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.92rem' }}>
                <AlertTriangle size={18} /> سجل الإرسال المتعثر ({failedSends.length} مدعو لم يتم وصول الرسالة إليهم):
              </div>
              <button
                type="button"
                className="apple-btn apple-btn-secondary"
                style={{ fontSize: '0.76rem', padding: '4px 10px', color: '#b91c1c', borderColor: '#fca5a5' }}
                onClick={() => setFailedSends([])}
              >
                إغلاق التنبيه
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="apple-table" style={{ fontSize: '0.82rem', background: '#ffffff', borderRadius: '10px' }}>
                <thead>
                  <tr>
                    <th>اسم الضيف</th>
                    <th>رقم الجوال</th>
                    <th>سبب التعثر</th>
                    <th style={{ width: '130px' }}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {failedSends.map(item => (
                    <tr key={item.guestId}>
                      <td style={{ fontWeight: 700 }}>{item.name}</td>
                      <td dir="ltr" style={{ textAlign: 'right' }}>{item.phone}</td>
                      <td style={{ color: '#dc2626' }}>{item.errorReason || 'تعذر الإرسال'}</td>
                      <td>
                        <button
                          type="button"
                          className="apple-btn apple-btn-pink"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', gap: '4px' }}
                          onClick={() => handleRetryFailedSingle(item)}
                        >
                          <RefreshCw size={12} /> إعادة المحاولة
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Paginated Calculations */}
        {(() => {
          const totalPages = Math.max(1, Math.ceil(allTableRows.length / pageSize));
          const safePage = Math.min(currentPage, totalPages);
          const startIndex = (safePage - 1) * pageSize;
          const paginatedRows = allTableRows.slice(startIndex, startIndex + pageSize);

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
                          title="تحديد / إلغاء تحديد الكل (أصحاب الدعوات)"
                        />
                      </th>
                      <th style={{ width: '45px' }}>#</th>
                      <th>اسم الضيف</th>
                      <th>رقم الجوال</th>
                      <th>التابع / المرافقون</th>
                      <th>الحالة</th>
                      <th>معاينة الكرت</th>
                      <th style={{ minWidth: '95px' }}>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allTableRows.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-secondary)' }}>
                          {guests.length === 0 ? (
                            'لا يوجد مدعوين محفوظين لهذه المناسبة حالياً. قم برفع تمبلت الدعوات.xlsx للتحقق والحفظ.'
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                              <span>لا توجد سجلات تطابق البحث أو حالة التصفية المحددة.</span>
                              <button
                                type="button"
                                className="apple-btn apple-btn-secondary"
                                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                                onClick={() => { setStatusFilter('all'); setSearchQuery(''); }}
                              >
                                عرض الكل ({guests.length})
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((rowItem, idx) => {
                        const displayIndex = startIndex + idx + 1;

                        if (rowItem.type === 'owner') {
                          const owner = rowItem.guest;
                          const isChecked = selectedGuestIds.includes(owner.id);

                          return (
                            <tr key={owner.id} style={{ background: isChecked ? 'rgba(253, 242, 245, 0.4)' : 'transparent' }}>
                              <td style={{ textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleSelectGuest(owner.id)}
                                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--pink-primary)' }}
                                  title="تحديد لإرسال الواتساب"
                                />
                              </td>
                              <td style={{ fontWeight: 600 }}>{displayIndex}</td>
                              <td>
                                <strong>{owner.name}</strong>
                              </td>
                              <td dir="ltr">{owner.phone || '-'}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  {owner.dependents && owner.dependents.length > 0 && (
                                    <span style={{ fontSize: '0.8rem', padding: '3px 10px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', borderRadius: '12px', fontWeight: 600 }}>
                                      صاحب دعوة ({owner.dependents.length} مرافقين)
                                    </span>
                                  )}

                                  {/* Add Companion Button (Phase 2 Req 3) */}
                                  <button
                                    type="button"
                                    className="apple-btn apple-btn-secondary"
                                    style={{ padding: '3px 8px', fontSize: '0.74rem', color: '#059669', borderColor: 'rgba(5, 150, 105, 0.3)', gap: '4px' }}
                                    onClick={() => setAddCompanionModal({ ownerId: owner.id, ownerName: owner.name, companionName: '' })}
                                    title="إضافة مرافق لهذا الضيف"
                                  >
                                    <UserPlus size={12} /> إضافة مرافق
                                  </button>
                                </div>
                              </td>
                              <td>
                                {renderSingleStatus(owner)}
                              </td>
                              <td>
                                <button
                                  className="apple-btn apple-btn-secondary"
                                  style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                                  onClick={() => {
                                    setActiveGuestId(owner.id);
                                    setActiveTab('guest');
                                  }}
                                >
                                  <Eye size={13} /> معاينة الكرت
                                </button>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {/* Edit Button (Phase 2 Req 4) */}
                                  <button
                                    className="apple-btn apple-btn-secondary"
                                    style={{ padding: '5px 8px' }}
                                    title="تعديل بيانات الضيف"
                                    onClick={() => handleOpenEdit(owner)}
                                  >
                                    <Edit size={13} />
                                  </button>
                                  {/* Delete Button */}
                                  <button
                                    className="apple-btn apple-btn-danger"
                                    style={{ padding: '5px 8px' }}
                                    title="حذف هذا المدعو"
                                    onClick={() => handleDeleteGuest(owner.id)}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        } else {
                          const dep = rowItem.guest;
                          const owner = rowItem.owner;

                          return (
                            <tr
                              key={dep.id}
                              style={{
                                background: 'rgba(240, 245, 249, 0.55)',
                                borderTop: '1px dashed rgba(64, 123, 161, 0.15)'
                              }}
                            >
                              <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }} title="تصل الدعوة عبر صاحبها">
                                <span style={{ fontSize: '0.82rem' }}>-</span>
                              </td>
                              <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{displayIndex}</td>
                              <td>
                                <div style={{ paddingRight: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ color: 'var(--pink-primary)', fontWeight: 800 }}>↳</span>
                                  <strong>{dep.name}</strong>
                                  <span style={{ fontSize: '0.7rem', padding: '1px 6px', background: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', borderRadius: '10px' }}>مرافق</span>
                                </div>
                              </td>
                              <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>بدون جوال</td>
                              <td>
                                <span style={{ fontSize: '0.8rem', color: '#4f46e5', fontWeight: 600 }}>
                                  ↳ مرافق لـ {owner.name}
                                </span>
                              </td>
                              <td>
                                {renderSingleStatus(dep)}
                              </td>
                              <td>
                                <button
                                  className="apple-btn apple-btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                                  onClick={() => {
                                    setActiveGuestId(dep.id);
                                    setActiveTab('guest');
                                  }}
                                >
                                  <Eye size={12} /> كرت المرافق
                                </button>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <button
                                    className="apple-btn apple-btn-secondary"
                                    style={{ padding: '5px 8px' }}
                                    title="تعديل بيانات المرافق"
                                    onClick={() => handleOpenEdit(dep)}
                                  >
                                    <Edit size={13} />
                                  </button>
                                  <button
                                    className="apple-btn apple-btn-danger"
                                    style={{ padding: '5px 8px' }}
                                    title="حذف هذا المرافق"
                                    onClick={() => handleDeleteGuest(dep.id)}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {allTableRows.length > 0 && totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(64, 123, 161, 0.2)' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {/* Previous Page Arrow (Frameless, No Circle) */}
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '6px',
                        cursor: safePage === 1 ? 'default' : 'pointer',
                        color: safePage === 1 ? 'rgba(0,0,0,0.2)' : 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'opacity 0.2s'
                      }}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      title="الصفحة السابقة"
                      aria-label="الصفحة السابقة"
                    >
                      <ChevronRight size={20} />
                    </button>

                    {/* Page Numbers: 1 2 3 ... 6 */}
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {(() => {
                        const pages = [];
                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                          if (safePage <= 3) {
                            pages.push(1, 2, 3, 4, '...', totalPages);
                          } else if (safePage >= totalPages - 2) {
                            pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                          } else {
                            pages.push(1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages);
                          }
                        }

                        return pages.map((item, idx) => {
                          if (item === '...') {
                            return (
                              <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                                ...
                              </span>
                            );
                          }
                          const isActive = item === safePage;
                          return (
                            <button
                              key={`page-${item}`}
                              type="button"
                              onClick={() => setCurrentPage(item)}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                border: 'none',
                                background: isActive ? 'var(--pink-primary)' : 'transparent',
                                color: isActive ? '#ffffff' : 'var(--text-primary)',
                                fontWeight: isActive ? 800 : 600,
                                fontSize: '0.86rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {item}
                            </button>
                          );
                        });
                      })()}
                    </div>

                    {/* Next Page Arrow (Frameless, No Circle) */}
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '6px',
                        cursor: safePage === totalPages ? 'default' : 'pointer',
                        color: safePage === totalPages ? 'rgba(0,0,0,0.2)' : 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'opacity 0.2s'
                      }}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      title="الصفحة التالية"
                      aria-label="الصفحة التالية"
                    >
                      <ChevronLeft size={20} />
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Delete Confirmation Modal for Guests with Dependents */}
      {deleteConfirmModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setDeleteConfirmModal(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              padding: '30px 24px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              textAlign: 'center',
              direction: 'rtl'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={28} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
              حذف صاحب الدعوة "{deleteConfirmModal.guest.name}"
            </h3>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.6, fontWeight: 600 }}>
              عنده مرافقون، حذفهم معه أم تحويلهم لضيوف مستقلين؟
            </p>
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '14px', marginBottom: '22px', fontSize: '0.86rem', color: '#475569', textAlign: 'right', border: '1px solid #e2e8f0' }}>
              <span style={{ fontWeight: 700, color: '#1e293b' }}>المرافقون ({deleteConfirmModal.dependents.length}): </span>
              {deleteConfirmModal.dependents.map(d => d.name).join('، ')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="apple-btn apple-btn-danger"
                style={{ width: '100%', justifyContent: 'center', padding: '12px', fontWeight: 700, fontSize: '0.95rem' }}
                onClick={() => executeDeleteGuest(deleteConfirmModal.guest.id, true)}
              >
                حذفهم معه
              </button>
              <button
                type="button"
                className="apple-btn apple-btn-secondary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px', fontWeight: 700, fontSize: '0.95rem', borderColor: 'var(--pink-primary)', color: 'var(--pink-dark)' }}
                onClick={() => executeDeleteGuest(deleteConfirmModal.guest.id, false)}
              >
                تحويلهم لضيوف مستقلين
              </button>
              <button
                type="button"
                className="apple-btn"
                style={{ width: '100%', justifyContent: 'center', padding: '10px', background: '#f1f5f9', color: '#64748b', border: 'none', fontWeight: 600 }}
                onClick={() => setDeleteConfirmModal(null)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Companion Modal (Phase 2 Req 3) */}
      {addCompanionModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setAddCompanionModal(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              padding: '28px 24px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              direction: 'rtl'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    إضافة مرافق
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    تابع للمدعو: {addCompanionModal.ownerName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddCompanionModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCompanion}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontWeight: 700, fontSize: '0.88rem' }}>اسم المرافق (إلزامي - فقط الاسم):</label>
                <input
                  type="text"
                  className="apple-input"
                  placeholder="مثال: لين، سارة، فيصل..."
                  value={addCompanionModal.companionName || ''}
                  autoFocus
                  required
                  onChange={(e) => setAddCompanionModal(prev => ({ ...prev, companionName: e.target.value }))}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '12px', marginBottom: '20px', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, border: '1px solid #e2e8f0' }}>
                💡 <strong>ملاحظة:</strong> المرافق لا يحتاج رقم جوال؛ وسيتم إدراج بطاقته التفاعلية وتذكرته تلقائياً داخل رابط دعوة صاحب الدعوة ({addCompanionModal.ownerName}).
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  className="apple-btn apple-btn-pink"
                  style={{ flex: 1, justifyContent: 'center', padding: '11px', fontWeight: 700 }}
                >
                  <Plus size={16} /> حفظ المرافق
                </button>
                <button
                  type="button"
                  className="apple-btn apple-btn-secondary"
                  style={{ padding: '11px 18px' }}
                  onClick={() => setAddCompanionModal(null)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Guest Modal (Phase 2 Req 4) */}
      {editingGuestModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setEditingGuestModal(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              padding: '28px 24px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              direction: 'rtl'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    تعديل بيانات الضيف
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {editingGuestModal.isDependent ? 'مرافق تابع' : 'صاحب دعوة مستقل'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingGuestModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontWeight: 700, fontSize: '0.88rem' }}>اسم الضيف (إلزامي):</label>
                <input
                  type="text"
                  className="apple-input"
                  value={editingGuestModal.name}
                  required
                  onChange={(e) => setEditingGuestModal(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              {/* Type Switcher / Ownership Rules */}
              <div style={{ marginBottom: '14px', background: '#f8fafc', padding: '12px 14px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <label style={{ fontWeight: 700, fontSize: '0.84rem', color: '#1e293b', marginBottom: '8px', display: 'block' }}>
                  نوع وصفة الضيف:
                </label>

                {editingGuestModal.hasDependents ? (
                  <div style={{ fontSize: '0.82rem', color: '#059669', background: 'rgba(16, 185, 129, 0.1)', padding: '8px 12px', borderRadius: '10px', fontWeight: 600 }}>
                    صاحب دعوة لديه ({editingGuestModal.dependentsCount}) مرافقين - لا يمكن تحويله لمرافق.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', cursor: 'pointer', fontWeight: 600 }}>
                      <input
                        type="radio"
                        name="guest_type"
                        checked={!editingGuestModal.isDependent}
                        onChange={() => setEditingGuestModal(prev => ({ ...prev, isDependent: false, parent_guest_id: '' }))}
                      />
                      صاحب دعوة
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', cursor: 'pointer', fontWeight: 600 }}>
                      <input
                        type="radio"
                        name="guest_type"
                        checked={editingGuestModal.isDependent}
                        onChange={() => {
                          const firstOtherOwner = (ownerGuests || []).find(o => o.id !== editingGuestModal.id);
                          setEditingGuestModal(prev => ({
                            ...prev,
                            isDependent: true,
                            phone: '',
                            parent_guest_id: firstOtherOwner ? firstOtherOwner.id : ''
                          }));
                        }}
                      />
                      مرافق لشخص آخر
                    </label>
                  </div>
                )}
              </div>

              {/* Dynamic Field: Phone (for owner) OR Parent selector (for dependent) */}
              {!editingGuestModal.isDependent ? (
                <div className="form-group" style={{ marginBottom: '18px' }}>
                  <label style={{ fontWeight: 700, fontSize: '0.88rem' }}>رقم الجوال (0501234567):</label>
                  <input
                    type="tel"
                    className="apple-input"
                    placeholder="0501234567"
                    value={editingGuestModal.phone || ''}
                    required
                    onChange={(e) => setEditingGuestModal(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom: '18px' }}>
                  <label style={{ fontWeight: 700, fontSize: '0.88rem' }}>مرافق لـ (صاحب الدعوة):</label>
                  <select
                    className="apple-input"
                    value={editingGuestModal.parent_guest_id}
                    required
                    onChange={(e) => setEditingGuestModal(prev => ({ ...prev, parent_guest_id: e.target.value }))}
                  >
                    <option value="">-- اختر صاحب الدعوة --</option>
                    {(ownerGuests || [])
                      .filter(o => o.id !== editingGuestModal.id)
                      .map(owner => (
                        <option key={owner.id} value={owner.id}>
                          {owner.name} ({owner.phone})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  className="apple-btn apple-btn-pink"
                  style={{ flex: 1, justifyContent: 'center', padding: '11px', fontWeight: 700 }}
                >
                  <Check size={16} /> حفظ التعديلات
                </button>
                <button
                  type="button"
                  className="apple-btn apple-btn-secondary"
                  style={{ padding: '11px 18px' }}
                  onClick={() => setEditingGuestModal(null)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Send Modal (Phase 5 Req 3) */}
      {isTestModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setIsTestModalOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              padding: '28px 24px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              direction: 'rtl'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(64, 123, 161, 0.1)', color: 'var(--pink-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    إرسال تجريبي لرقمي أولاً
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    اختبار ظهور الرسالة والكرت والتذكرة على رقمك الشخصي
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontWeight: 700, fontSize: '0.88rem' }}>رقم الجوال التجريبي:</label>
                <input
                  type="tel"
                  className="apple-input"
                  placeholder="مثال: 0501234567 أو 966501234567"
                  value={testPhone}
                  autoFocus
                  required
                  onChange={(e) => setTestPhone(e.target.value)}
                />
              </div>

              {ownerGuests.length > 0 && (
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label style={{ fontWeight: 700, fontSize: '0.88rem' }}>محاكاة بيانات دعوة الضيف:</label>
                  <select
                    className="apple-input"
                    value={previewGuestId || (selectedPreviewGuest?.id || '')}
                    onChange={(e) => setPreviewGuestId(e.target.value)}
                  >
                    {ownerGuests.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Message preview snippet */}
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', marginBottom: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)', maxHeight: '140px', overflowY: 'auto', border: '1px solid #e2e8f0', whiteSpace: 'pre-line' }}>
                {renderedLivePreview}
              </div>

              {testFeedback && (
                <div style={{ padding: '10px 14px', borderRadius: '12px', marginBottom: '16px', fontSize: '0.82rem', background: testFeedback.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: testFeedback.success ? '#15803d' : '#b91c1c', border: `1px solid ${testFeedback.success ? '#86efac' : '#fca5a5'}` }}>
                  {testFeedback.message}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="apple-btn apple-btn-pink"
                  style={{ flex: 1, justifyContent: 'center', padding: '11px', fontWeight: 700 }}
                  onClick={handleSendTestMessage}
                  disabled={isSendingTest || !testPhone.trim()}
                >
                  {isSendingTest ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> جاري الإرسال...
                    </>
                  ) : (
                    <>
                      <Send size={16} /> إرسال الرسالة التجريبية الآن
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="apple-btn apple-btn-secondary"
                  style={{ padding: '11px 18px' }}
                  onClick={() => setIsTestModalOpen(false)}
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Size Image Lightbox Modal */}
      {fullViewImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setFullViewImage(null)}
        >
          <div
            style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setFullViewImage(null)}
              style={{
                position: 'absolute',
                top: '-15px',
                right: '-15px',
                background: '#ffffff',
                color: '#000000',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                cursor: 'pointer',
                fontWeight: 800,
                boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
            <img
              src={fullViewImage}
              alt="كرت الدعوة بالحجم الكامل"
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '16px', objectFit: 'contain', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}
            />
          </div>
        </div>
      )}

      {/* Pending Card Preview & Save Modal */}
      {pendingCardPreview && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={handleCancelPendingCard}
        >
          <div
            className="apple-card"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              borderRadius: '20px',
              background: '#ffffff',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(64, 123, 161, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--pink-primary)'
                }}>
                  <ImageIcon size={20} />
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  معاينة كرت الدعوة الجديد
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCancelPendingCard}
                style={{
                  background: 'rgba(0,0,0,0.05)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Image Preview */}
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.06)', marginBottom: '18px' }}>
              <img
                src={pendingCardPreview}
                alt="معاينة كرت الدعوة الجديد"
                style={{
                  maxWidth: '100%',
                  maxHeight: '55vh',
                  objectFit: 'contain',
                  borderRadius: '10px',
                  display: 'block',
                  margin: '0 auto'
                }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="apple-btn apple-btn-secondary"
                onClick={handleCancelPendingCard}
                disabled={isSavingCard}
                style={{ padding: '8px 18px', fontSize: '0.85rem' }}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="apple-btn apple-btn-pink"
                onClick={handleConfirmSaveCard}
                disabled={isSavingCard}
                style={{ padding: '8px 24px', fontSize: '0.85rem', fontWeight: 700 }}
              >
                {isSavingCard ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Check size={15} /> حفظ
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Gateway Settings Modal */}
      {isGatewayModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setIsGatewayModalOpen(false)}
        >
          <div
            className="apple-card"
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '28px',
              borderRadius: '20px',
              background: '#ffffff',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.2), 0 4px 16px rgba(0, 0, 0, 0.08)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'rgba(64, 123, 161, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--pink-primary)'
                }}>
                  <Settings size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    إعدادات المناسبة
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>بوابة الواتساب السحابية وإدارة المناسبة</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGatewayModalOpen(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)'
                }}
                title="إغلاق"
              >
                <X size={16} />
              </button>
            </div>

            {/* Server status alert */}
            {hasServerWhatsAppConfig && (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '10px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.8rem',
                color: '#15803d',
                fontWeight: 600
              }}>
                <CheckCircle2 size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
                <span>بيانات البوابة مؤمنة بالخادم ومحفوظة مسبقاً.</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '22px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-primary)', marginBottom: '6px', display: 'block' }}>
                  Instance ID (معرف بوابة الواتساب):
                </label>
                <input
                  type="text"
                  className="apple-input"
                  placeholder="مثال: 7103847291 أو ••••••••1234"
                  value={instanceId}
                  onChange={(e) => setInstanceId(e.target.value)}
                  style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-primary)', marginBottom: '6px', display: 'block' }}>
                  API Token (الرمز السري للبوابة):
                </label>
                <input
                  type="password"
                  className="apple-input"
                  placeholder="أدخل رمز الـ API Token أو ••••••••1234"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                />
              </div>

              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                يتم حفظ هذه البيانات بأمان واستخدامها لإرسال كروت الدعوة والرسائل التلقائية عبر الواتساب للمدعوين.
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="apple-btn apple-btn-secondary"
                onClick={() => setIsGatewayModalOpen(false)}
                style={{ padding: '8px 16px', fontSize: '0.84rem' }}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="apple-btn apple-btn-pink"
                style={{ padding: '8px 20px', fontSize: '0.84rem', fontWeight: 700 }}
                onClick={async () => {
                  const ok = await handleSaveWhatsAppConfig(instanceId, apiToken);
                  if (ok) {
                    if (showConfirmation) {
                      showConfirmation('تم الحفظ', 'تم حفظ وتأمين بيانات بوابة الواتساب في الخادم بنجاح!', 'success');
                    } else {
                      alert('تم حفظ وتأمين بيانات بوابة الواتساب في الخادم بنجاح!');
                    }
                    setIsGatewayModalOpen(false);
                  } else {
                    if (showConfirmation) {
                      showConfirmation('خطأ', 'تعذر حفظ إعدادات البوابة. يرجى التحقق من المدخلات.', 'danger');
                    } else {
                      alert('تعذر حفظ إعدادات البوابة.');
                    }
                  }
                }}
              >
                حفظ الإعدادات
              </button>
            </div>

            {/* Danger Zone: Delete Active Event */}
            {onDeleteEvent && activeEventId && (
              <div style={{ marginTop: '22px', paddingTop: '16px', borderTop: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Trash2 size={15} /> حذف المناسبة
                    </div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      حذف المناسبة الحالية ({eventData?.title || 'الحالية'}) وكافة بياناتها نهائياً.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="apple-btn"
                    style={{
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: '1.5px solid #fecaca',
                      fontSize: '0.82rem',
                      padding: '7px 16px',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setIsGatewayModalOpen(false);
                      onDeleteEvent(activeEventId, eventData?.title || 'المناسبة');
                    }}
                  >
                    <Trash2 size={14} /> حذف المناسبة
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add New Guest & Excel Import Modal */}
      {isAddGuestModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setIsAddGuestModalOpen(false)}
        >
          <div
            className="apple-card"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '26px',
              borderRadius: '20px',
              background: '#ffffff',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.2), 0 4px 16px rgba(0, 0, 0, 0.08)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'rgba(64, 123, 161, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--pink-primary)'
                }}>
                  <UserPlus size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    إضافة مدعوين للمناسبة
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    إدخال مباشر لضيف أو استيراد قائمة كاملة عبر ملف إكسل
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddGuestModalOpen(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)'
                }}
                title="إغلاق"
              >
                <X size={16} />
              </button>
            </div>

            {/* Section 1: Single Direct Guest Entry */}
            <form onSubmit={handleSingleGuestSubmit} style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} style={{ color: 'var(--pink-primary)' }} />
                إضافة يدوية:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    اسم الضيف <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="apple-input"
                    placeholder="اسم الضيف كاملاً"
                    value={singleName}
                    required
                    onChange={(e) => setSingleName(e.target.value)}
                    style={{ width: '100%', height: '40px', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    نوع الضيف
                  </label>
                  <select
                    className="apple-input"
                    value={singleParentId}
                    onChange={(e) => {
                      setSingleParentId(e.target.value);
                      if (e.target.value) setSinglePhone('');
                    }}
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '8px 18px',
                      fontSize: '0.9rem',
                      lineHeight: '1.4',
                      color: 'var(--text-primary)',
                      background: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">ضيف مستقل (صاحب دعوة)</option>
                    {(guests || [])
                      .filter(g => !g.parent_guest_id)
                      .map(owner => (
                        <option key={owner.id} value={owner.id}>
                          مرافق لـ: {owner.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    رقم الجوال {!singleParentId && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <input
                    type="tel"
                    className="apple-input"
                    placeholder={singleParentId ? "المرافق لا يحتاج جوال (يصل عبر صاحب الدعوة)" : "رقم الجوال (0501234567)"}
                    value={singlePhone}
                    disabled={Boolean(singleParentId)}
                    required={!singleParentId}
                    onChange={(e) => setSinglePhone(e.target.value)}
                    style={{ width: '100%', height: '40px', fontSize: '0.88rem', direction: 'ltr', textAlign: 'right' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="submit"
                    className="apple-btn apple-btn-pink"
                    style={{ padding: '9px 24px', fontSize: '0.86rem', fontWeight: 700 }}
                  >
                    <Plus size={16} /> إضافة
                  </button>
                </div>
              </div>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '18px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }}></div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700 }}>أو استيراد جماعي عبر إكسل</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }}></div>
            </div>

            {/* Section 2: Excel Import & Template */}
            <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileSpreadsheet size={16} style={{ color: 'var(--pink-primary)' }} />
                إرفاق قائمة الضيوف (ملف إكسل):
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
                عند اختيار الملف ستظهر لك شاشة تدقيق ذكية لمراجعة صحة الأسماء وأرقام الجوال وتعديل أي أخطاء قبل الحفظ النهائي.
              </p>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="apple-btn apple-btn-secondary"
                  style={{ flex: 1, fontSize: '0.82rem', padding: '9px 12px' }}
                  onClick={downloadExcelTemplate}
                >
                  <Download size={15} /> تحميل تمبلت الدعوات.xlsx
                </button>

                <label
                  className="apple-btn apple-btn-pink"
                  style={{ flex: 1, cursor: 'pointer', fontSize: '0.82rem', padding: '9px 12px', justifyContent: 'center' }}
                >
                  <FileSpreadsheet size={15} /> رفع ومراجعة الإكسل
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => {
                      setIsAddGuestModalOpen(false);
                      handleFileUpload(e);
                    }}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
