import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Calendar, Users, CheckCircle2, XCircle, Clock, Upload, Download, Plus, MessageCircle, Eye, FileSpreadsheet, Send, Image as ImageIcon, Rocket, Loader2, Trash2, Layers, BarChart3, Check, X, Sparkles, HelpCircle, Filter, ChevronDown, Search, Edit, UserPlus } from 'lucide-react';
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
  
  // Validation & New Event Modals state
  const [pendingExcelRows, setPendingExcelRows] = useState(null);
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);

  // Sync preview card image whenever active eventData changes
  useEffect(() => {
    setPreviewCardImg(eventData?.cardImage || null);
  }, [eventData]);

  // WhatsApp Auto Gateway Credentials & Custom Text
  const [instanceId, setInstanceId] = useState(localStorage.getItem('wa_instance_id') || '');
  const [apiToken, setApiToken] = useState(localStorage.getItem('wa_api_token') || '');
  const [customMessage, setCustomMessage] = useState(
    localStorage.getItem('wa_custom_message') ||
    'يسرنا ويسعدنا دعوتكم لحضور حفلنا وتكتمل فرحتنا بمشاركتكم.'
  );
  const [isSendingAuto, setIsSendingAuto] = useState(false);
  const [autoProgress, setAutoProgress] = useState(null);
  // Checkbox selection state for batch sending
  const [selectedGuestIds, setSelectedGuestIds] = useState([]);

  // Search by Name or Phone (Phase 2 Requirement 6)
  const [searchQuery, setSearchQuery] = useState('');

  // Status Filter State ('all' | 'accepted' | 'declined' | 'pending' | 'sent' | 'unsent')
  const [statusFilter, setStatusFilter] = useState('all');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  // Pagination State (customizable records per page: 10, 20, 50, 100)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('guest_page_size');
    return saved ? parseInt(saved) : 10;
  });

  // Modal states for Quick-Add Companion & Edit Guest (Phase 2 Requirements 3 & 4)
  const [addCompanionModal, setAddCompanionModal] = useState(null); // { ownerId, ownerName, companionName }
  const [editingGuestModal, setEditingGuestModal] = useState(null); // { id, name, phone, parent_guest_id, isDependent, ... }

  useEffect(() => {
    setCurrentPage(1);
  }, [activeEventId, statusFilter, pageSize, searchQuery]);

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

  // Auto-sync selection state when owners change
  useEffect(() => {
    if (ownerGuests.length > 0) {
      const validOwnerIds = new Set(ownerGuests.map(g => g.id));
      setSelectedGuestIds(prev => {
        const filtered = prev.filter(id => validOwnerIds.has(id));
        return filtered.length > 0 ? filtered : ownerGuests.map(g => g.id);
      });
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
    const updatedEv = { ...(eventData || {}), cardImage: previewCardImg };
    if (!activeEventId || (events || []).length === 0) {
      await onCreateEvent(updatedEv);
    } else {
      await setEventData(updatedEv);
      if (showConfirmation) {
        showConfirmation('تم حفظ التعديلات بنجاح!', `تم حفظ تفاصيل المناسبة "${updatedEv.title || 'جديدة'}" وكرت الدعوة بنجاح.`);
      } else {
        alert(`تم حفظ تفاصيل المناسبة "${updatedEv.title || 'جديدة'}" وكرت الدعوة بنجاح!`);
      }
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

        // Method 1: Keyed Objects (matches 'اسم الضيف' and 'رقم الجوال' and 'عدد المدعوين')
        if (jsonObjects && jsonObjects.length > 0) {
          jsonObjects.forEach((obj) => {
            let name = "";
            let phoneRaw = "";
            let countRaw = 1;

            Object.keys(obj).forEach(key => {
              const val = (obj[key] || '').toString().trim();
              const keyClean = key.toString().trim();

              if (keyClean.includes('اسم') || keyClean.toLowerCase().includes('name')) {
                name = val;
              } else if (keyClean.includes('جوال') || keyClean.includes('رقم') || keyClean.toLowerCase().includes('phone')) {
                phoneRaw = val;
              } else if (keyClean.includes('عدد') || keyClean.includes('مدعوين') || keyClean.includes('مقاعد') || keyClean.includes('مرافق') || keyClean.toLowerCase().includes('count') || keyClean.toLowerCase().includes('seat')) {
                const parsedNum = parseInt(val);
                if (!isNaN(parsedNum) && parsedNum > 0) countRaw = parsedNum;
              } else {
                const cleanDigits = val.replace(/\D/g, '');
                if (cleanDigits.length >= 8) {
                  phoneRaw = val;
                } else if (val && val !== 'م' && isNaN(val) && !name) {
                  name = val;
                }
              }
            });

            if ((phoneRaw || name) && name !== 'اسم الضيف' && name !== 'الاسم') {
              extractedRows.push({
                name: name,
                phone: phoneRaw,
                count: countRaw
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
            let countRaw = "";

            row.forEach(cell => {
              if (!cell) return;
              const str = cell.toString().trim();
              const cleanDigits = str.replace(/\D/g, '');

              if (cleanDigits.length >= 8) {
                phoneRaw = str;
              } else if (str !== 'م' && str !== 'اسم الضيف' && str !== 'رقم الجوال' && isNaN(str)) {
                if (!name) name = str;
              } else if (!isNaN(parseInt(str)) && parseInt(str) > 0 && parseInt(str) <= 30 && cleanDigits.length < 4) {
                countRaw = parseInt(str);
              }
            });

            if (phoneRaw || name) {
              extractedRows.push({
                name: name,
                phone: phoneRaw,
                count: countRaw
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
    if (showConfirmation) {
      showConfirmation('تم استيراد قائمة الضيوف بنجاح!', `تم فحص وتأكيد واعتماد ${validGuests.length} مدعو بنجاح للمناسبة "${eventData?.title || ''}".`);
    } else {
      alert(`تم فحص وتأكيد واعتماد ${validGuests.length} مدعو بنجاح للمناسبة "${eventData?.title || ''}"!`);
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
    localStorage.setItem('wa_custom_message', customMessage);

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
            guestIds: selectedGuestIds,
            customMessage: customMessage
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
      `لم تقم بإدخال Instance ID و API Token لبوابة الواتساب الآلية.\n\nهل ترغب في البدء بالإرسال المباشر لـ (${selectedGuestsList.length}) مدعو عبر فتح الواتساب بالتتابع وتوجيه الرسالة والصورة؟`
    );

    if (!proceedDirect) return;

    setIsSendingAuto(true);
    let sentSuccess = 0;
    const userMsgText = customMessage.trim() || 'يسرنا ويسعدنا دعوتكم لحضور حفلنا وتكتمل فرحتنا بمشاركتكم.';

    let cardImgUrl = '';
    if (eventData?.cardImage) {
      if (eventData.cardImage.startsWith('http://') || eventData.cardImage.startsWith('https://')) {
        cardImgUrl = eventData.cardImage;
      } else if (eventData.cardImage.startsWith('/')) {
        cardImgUrl = `${window.location.origin}${eventData.cardImage}`;
      }
    }
    const cardImgNotice = cardImgUrl ? `\n\n📷 صورة كرت الدعوة المرفقة:\n${cardImgUrl}` : '';

    for (let i = 0; i < selectedGuestsList.length; i++) {
      const g = selectedGuestsList[i];
      setAutoProgress({ sent: i + 1, total: selectedGuestsList.length, currentName: g.name });

      const guestLink = `${window.location.origin}/?guest=${g.id}`;
      const guestSeats = g.count || g.companions || 1;
      const countNotice = guestSeats > 1 ? `\nعدد المقاعد المخصصة: ${guestSeats} أشخاص` : '';
      const fullText = `مرحباً ${g.name} 👋\n\n${userMsgText}\n\nالمناسبة: ${eventData?.title || ''}\nالتاريخ: ${eventData?.date || ''}\nالمكان: ${eventData?.location || ''}${countNotice}${cardImgNotice}\n\nيرجى تأكيد حضورك واستلام تذكرتك الإلكترونية عبر الرابط التالي:\n${guestLink}`;
      
      const waMsg = encodeURIComponent(fullText);
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

  // Overall Statistics
  const total = (guests || []).length;
  const ownersCount = (guests || []).filter(g => !g.parent_guest_id).length;
  const dependentsCount = (guests || []).filter(g => g.parent_guest_id).length;
  const accepted = (guests || []).filter(g => g.status === 'accepted').length;
  const declined = (guests || []).filter(g => g.status === 'declined').length;
  const pending = (guests || []).filter(g => g.status === 'pending').length;
  const sentCount = (guests || []).filter(g => !g.parent_guest_id && g.sent).length;
  const unsentCount = (guests || []).filter(g => !g.parent_guest_id && !g.sent).length;
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
        alert('يرجى إدخال رقم جوال للضيف المستقل.');
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
          <div className="apple-card" style={{ background: '#ffffff', border: '1.5px solid rgba(64, 123, 161, 0.25)', marginBottom: 0 }}>
            <div className="card-title-row" style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={20} style={{ color: 'var(--pink-primary)' }} /> المؤشرات الإحصائية الحية لمناسبة ({eventData?.title || 'المناسبة الحالية'})
              </h2>
            </div>
            <div className="widgets-grid">
              <div className="apple-widget">
                <div className="widget-icon pink"><Users size={24} /></div>
                <div>
                  <div className="widget-val">
                    {total} <small style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>({ownersCount} صاحب دعوة{dependentsCount > 0 ? ` + ${dependentsCount} مرافق` : ''})</small>
                  </div>
                  <div className="widget-lbl">إجمالي المدعوين</div>
                </div>
              </div>
              <div className="apple-widget">
                <div className="widget-icon green"><CheckCircle2 size={24} /></div>
                <div>
                  <div className="widget-val">
                    {accepted} {total > 0 && <small style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>({Math.round((accepted / total) * 100)}%)</small>}
                  </div>
                  <div className="widget-lbl">حضور مؤكد</div>
                </div>
              </div>
              <div className="apple-widget">
                <div className="widget-icon red"><XCircle size={24} /></div>
                <div>
                  <div className="widget-val">
                    {declined} {total > 0 && <small style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>({Math.round((declined / total) * 100)}%)</small>}
                  </div>
                  <div className="widget-lbl">معتذرون</div>
                </div>
              </div>
              <div className="apple-widget">
                <div className="widget-icon amber"><Clock size={24} /></div>
                <div>
                  <div className="widget-val">
                    {pending} {total > 0 && <small style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>({Math.round((pending / total) * 100)}%)</small>}
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
                    value={eventData?.mapLink || ''}
                    onChange={(e) => setEventData({ ...(eventData || {}), mapLink: e.target.value })}
                  />
                </div>

                {/* Row 4: Card Image Upload & Preview & Save Button */}
                <div className="form-group" style={{ borderTop: '1px solid rgba(64, 123, 161, 0.2)', paddingTop: '14px', marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <label className="apple-btn apple-btn-secondary" style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
                        <Upload size={16} /> تغيير صورة كرت الدعوة
                        <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                      </label>
                      {previewCardImg ? (
                        <span className="ios-badge ios-badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={14} /> تم رفع الكرت
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>لم يتم رفع كرت دعوة بعد</span>
                      )}
                    </div>

                    {previewCardImg && (
                      <button
                        type="button"
                        className="apple-btn apple-btn-secondary"
                        style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                        onClick={() => setFullViewImage(previewCardImg)}
                      >
                        <Eye size={14} /> عرض الصورة
                      </button>
                    )}
                  </div>

                  {/* Save Button placed UNDER the image preview/upload section */}
                  <div style={{ marginTop: '16px' }}>
                    <button type="button" onClick={handleEventSubmit} className="apple-btn apple-btn-pink btn-block" style={{ padding: '10px 24px', fontSize: '0.92rem', cursor: 'pointer' }}>
                      حفظ تفاصيل المناسبة والكرت
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Form 2: Guest List Attachment */}
            <div className="apple-card" style={{ marginBottom: 0 }}>
              <div className="card-title-row">
                <h2><FileSpreadsheet className="system-gold" size={20} /> 2. إرفاق قائمة الضيوف</h2>
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

              {/* Direct Single Guest Entry */}
              <form onSubmit={handleSingleGuestSubmit} style={{ borderTop: '1px solid rgba(64, 123, 161, 0.2)', paddingTop: '16px', marginBottom: '16px' }}>
                <label style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>
                  إضافة ضيف سريع (مباشر):
                </label>
                <div className="single-guest-grid" style={{ gridTemplateColumns: '1.2fr 1.2fr 1.2fr auto', gap: '8px' }}>
                  <input
                    type="text"
                    className="apple-input"
                    placeholder="اسم الضيف (إلزامي)"
                    value={singleName}
                    required
                    onChange={(e) => setSingleName(e.target.value)}
                  />
                  <input
                    type="tel"
                    className="apple-input"
                    placeholder={singleParentId ? "المرافق لا يحتاج جوال" : "رقم الجوال (0501234567)"}
                    value={singlePhone}
                    disabled={Boolean(singleParentId)}
                    required={!singleParentId}
                    onChange={(e) => setSinglePhone(e.target.value)}
                  />
                  <select
                    className="apple-input"
                    value={singleParentId}
                    onChange={(e) => {
                      setSingleParentId(e.target.value);
                      if (e.target.value) setSinglePhone('');
                    }}
                    title="تحديد صاحب الدعوة إذا كان هذا الضيف مرافقاً"
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
                  <button type="submit" className="apple-btn apple-btn-pink" style={{ whiteSpace: 'nowrap', padding: '12px 20px' }}>
                    <Plus size={16} /> إضافة الضيف
                  </button>
                </div>
              </form>
            </div>

            {/* Form 3: WhatsApp Customization & Gateway Credentials */}
            <div className="apple-card" style={{ marginBottom: 0 }}>
              <div className="card-title-row">
                <h2><MessageCircle className="system-gold" size={20} /> 3. تخصيص نص رسالة الواتساب وبوابة الإرسال وصورة الدعوة</h2>
              </div>

              <div className="form-group">
                <label>نص رسالة الدعوة المخصصة (يتم دمج اسم الضيف وتفاصيل المناسبة ورابط التذكرة وصورة الكرت تلقائياً):</label>
                <textarea
                  className="apple-input"
                  rows="3"
                  value={customMessage}
                  onChange={(e) => {
                    setCustomMessage(e.target.value);
                    localStorage.setItem('wa_custom_message', e.target.value);
                  }}
                  placeholder="أدخل نص الدعوة هنا... مثال: يسرنا ويسعدنا دعوتكم لحضور حفلنا وتكتمل فرحتنا بمشاركتكم."
                ></textarea>
              </div>

              {/* Live Message Preview Box */}
              <div style={{ background: '#f0f5f9', border: '1px solid rgba(64, 123, 161, 0.25)', borderRadius: '14px', padding: '14px 18px', marginBottom: '14px', fontSize: '0.86rem' }}>
                <div style={{ fontWeight: 800, color: 'var(--pink-dark)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} /> معاينة حية لشكل رسالة الواتساب المرسلة للضيف:
                </div>
                <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line', background: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', lineHeight: '1.6' }}>
                  {`مرحباً [اسم الضيف] 👋\n\n${customMessage || 'يسرنا ويسعدنا دعوتكم لحضور حفلنا وتكتمل فرحتنا بمشاركتكم.'}\n\nالمناسبة: ${eventData?.title || 'عنوان المناسبة'}\nالتاريخ: ${eventData?.date || ''}\nالمكان: ${eventData?.location || ''}\n\n[📷 يتم إرفاق صورة كرت الدعوة المرفوعة تلقائياً مع هذه الرسالة]\n\nيرجى تأكيد حضورك واستلام تذكرتك الإلكترونية عبر الرابط التالي:\nhttps://invitation.app/?guest=xxx`}
                </div>
              </div>

              {/* Gateway Credentials (Optional Green-API / UltraMsg) */}
              <div className="grid-2col" style={{ gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Instance ID (بوابة الواتساب الآلية - اختياري)</label>
                  <input
                    type="text"
                    className="apple-input"
                    placeholder="مثال: 7103847291"
                    value={instanceId}
                    onChange={(e) => {
                      setInstanceId(e.target.value);
                      localStorage.setItem('wa_instance_id', e.target.value);
                    }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>API Token (اختياري)</label>
                  <input
                    type="password"
                    className="apple-input"
                    placeholder="أدخل رمز الـ API Token"
                    value={apiToken}
                    onChange={(e) => {
                      setApiToken(e.target.value);
                      localStorage.setItem('wa_api_token', e.target.value);
                    }}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* STREAMLINED GUESTS TABLE CARD */}
      <div className="apple-card" style={{ marginBottom: '28px' }}>
        <div className="card-title-row" style={{ flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
          <div>
            <h2><Users className="system-gold" size={20} /> 4. قائمة المدعوين</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>تصفية المدعوين حسب الحالة والتحكم في إرسال الدعوات وحفظ التغييرات</p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', width: '100%', justifyContent: 'space-between', marginTop: '6px' }}>
            {/* Search Box (Phase 2 Req 6) */}
            <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 260px' }}>
              <Search size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                className="apple-input"
                placeholder="بحث بالاسم أو رقم الجوال..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingRight: '36px', paddingLeft: '32px', height: '38px', fontSize: '0.85rem' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0 }}
                  title="مسح البحث"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Quick Action Badges & Filter & Export */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
              <span className="ios-badge ios-badge-pink" style={{ fontSize: '0.82rem', padding: '6px 12px', fontWeight: 800 }}>
                تم تحديد ({selectedGuestIds.length}) من أصل ({ownerGuests.length}) صاحب دعوة
              </span>

              {/* Export to Excel (Phase 2 Req 6) */}
              <button
                type="button"
                className="apple-btn apple-btn-secondary"
                onClick={handleExportToExcel}
                style={{ fontSize: '0.82rem', padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                title="تصدير النتائج الحالية إلى ملف إكسل"
              >
                <Download size={15} /> تصدير إكسل
              </button>

              {/* Inline Filter Dropdown Button (Icon Only) */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={`apple-btn ${statusFilter !== 'all' ? 'apple-btn-pink' : 'apple-btn-secondary'}`}
                  onClick={() => setIsFilterMenuOpen(prev => !prev)}
                  style={{
                    padding: '7px 11px',
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
                        top: 'calc(100% + 6px)',
                        right: 0,
                        background: '#ffffff',
                        boxShadow: '0 12px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.06)',
                        borderRadius: '14px',
                        border: '1px solid rgba(64, 123, 161, 0.2)',
                        padding: '6px',
                        zIndex: 50,
                        minWidth: '190px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <button
                        type="button"
                        className={`apple-btn ${statusFilter === 'all' ? 'apple-btn-pink' : 'apple-btn-secondary'}`}
                        style={{ width: '100%', justifyContent: 'space-between', padding: '8px 12px', fontSize: '0.82rem', borderRadius: '10px' }}
                        onClick={() => { setStatusFilter('all'); setIsFilterMenuOpen(false); }}
                      >
                        <span>الكل</span>
                        <span className="ios-badge" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>{guests.length}</span>
                      </button>
                      <button
                        type="button"
                        className={`apple-btn ${statusFilter === 'accepted' ? 'apple-btn-pink' : 'apple-btn-secondary'}`}
                        style={{ width: '100%', justifyContent: 'space-between', padding: '8px 12px', fontSize: '0.82rem', borderRadius: '10px' }}
                        onClick={() => { setStatusFilter('accepted'); setIsFilterMenuOpen(false); }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }}></span>
                          حضور مؤكد
                        </span>
                        <span className="ios-badge ios-badge-green" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>{accepted}</span>
                      </button>
                      <button
                        type="button"
                        className={`apple-btn ${statusFilter === 'declined' ? 'apple-btn-pink' : 'apple-btn-secondary'}`}
                        style={{ width: '100%', justifyContent: 'space-between', padding: '8px 12px', fontSize: '0.82rem', borderRadius: '10px' }}
                        onClick={() => { setStatusFilter('declined'); setIsFilterMenuOpen(false); }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></span>
                          معتذرون
                        </span>
                        <span className="ios-badge ios-badge-red" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>{declined}</span>
                      </button>
                      <button
                        type="button"
                        className={`apple-btn ${statusFilter === 'pending' ? 'apple-btn-pink' : 'apple-btn-secondary'}`}
                        style={{ width: '100%', justifyContent: 'space-between', padding: '8px 12px', fontSize: '0.82rem', borderRadius: '10px' }}
                        onClick={() => { setStatusFilter('pending'); setIsFilterMenuOpen(false); }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></span>
                          بانتظار الرد
                        </span>
                        <span className="ios-badge ios-badge-gold" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>{pending}</span>
                      </button>
                      <button
                        type="button"
                        className={`apple-btn ${statusFilter === 'unsent' ? 'apple-btn-pink' : 'apple-btn-secondary'}`}
                        style={{ width: '100%', justifyContent: 'space-between', padding: '8px 12px', fontSize: '0.82rem', borderRadius: '10px' }}
                        onClick={() => { setStatusFilter('unsent'); setIsFilterMenuOpen(false); }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6b7280' }}></span>
                          لم يُرسل بعد
                        </span>
                        <span className="ios-badge ios-badge-gold" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>{unsentCount}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button className="apple-btn apple-btn-secondary" onClick={handleSelectUnsentOnly} style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                تحديد غير المرسل لهم فقط
              </button>
            </div>

            {/* Left side: Rocket Auto Dispatch Button */}
            <div>
              <button
                type="button"
                className="apple-btn apple-btn-pink"
                style={{ padding: '8px 18px', fontSize: '0.88rem', fontWeight: 800, boxShadow: '0 4px 14px rgba(64, 123, 161, 0.3)' }}
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

        {/* Paginated Calculations */}
        {(() => {
          const totalPages = Math.max(1, Math.ceil(filteredUnits.length / pageSize));
          const safePage = Math.min(currentPage, totalPages);
          const startIndex = (safePage - 1) * pageSize;
          const paginatedUnits = filteredUnits.slice(startIndex, startIndex + pageSize);

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
                    {filteredUnits.length === 0 ? (
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
                      paginatedUnits.map((owner, idx) => {
                        const isChecked = selectedGuestIds.includes(owner.id);
                        const displayIndex = startIndex + idx + 1;

                        return (
                          <React.Fragment key={owner.id}>
                            {/* Primary Owner Row */}
                            <tr style={{ background: isChecked ? 'rgba(253, 242, 245, 0.4)' : 'transparent' }}>
                              <td style={{ textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleSelectGuest(owner.id)}
                                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--pink-primary)' }}
                                  title="تحديد لإرسال الواتساب"
                                />
                              </td>
                              <td>{displayIndex}</td>
                              <td>
                                <strong>{owner.name}</strong>
                              </td>
                              <td dir="ltr">{owner.phone || '-'}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  {owner.dependents && owner.dependents.length > 0 ? (
                                    <span style={{ fontSize: '0.8rem', padding: '3px 10px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', borderRadius: '12px', fontWeight: 600 }}>
                                      صاحب دعوة ({owner.dependents.length} مرافقين)
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '0.8rem', padding: '3px 10px', background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)', borderRadius: '12px' }}>
                                      ضيف مستقل
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

                            {/* Indented Dependent Rows (Phase 2 Req 2) */}
                            {owner.dependents && owner.dependents.map((dep) => (
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
                                <td style={{ color: 'var(--pink-primary)', fontWeight: 800 }}>↳</td>
                                <td>
                                  <div style={{ paddingRight: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                            ))}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination & Display Controls */}
              {filteredUnits.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(64, 123, 161, 0.2)', flexWrap: 'wrap', gap: '12px' }}>
                  {/* Right side: Page size selector & record counts */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      عرض {startIndex + 1} - {Math.min(startIndex + pageSize, filteredUnits.length)} من أصل {filteredUnits.length} صاحب دعوة (إجمالي {filteredPeopleCount} مدعو ومرافق)
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      <span style={{ fontWeight: 600 }}>عدد السجلات بالصفحة:</span>
                      <select
                        className="apple-input"
                        style={{ padding: '4px 10px', fontSize: '0.82rem', borderRadius: '10px', width: 'auto', cursor: 'pointer', background: '#ffffff' }}
                        value={pageSize}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 10;
                          setPageSize(val);
                          localStorage.setItem('guest_page_size', val);
                          setCurrentPage(1);
                        }}
                      >
                        <option value={10}>10 سجلات</option>
                        <option value={20}>20 سجل</option>
                        <option value={50}>50 سجل</option>
                        <option value={100}>100 سجل</option>
                      </select>
                    </div>
                  </div>

                  {/* Left side: Page navigation buttons */}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        className="apple-btn apple-btn-secondary"
                        style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => setCurrentPage(1)}
                        disabled={safePage === 1}
                        title="الصفحة الأولى"
                      >
                        الأولى
                      </button>

                      <button
                        className="apple-btn apple-btn-secondary"
                        style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={safePage === 1}
                      >
                        السابقة
                      </button>

                      {/* Page Number Pills */}
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(page => page === 1 || page === totalPages || Math.abs(page - safePage) <= 1)
                          .reduce((acc, page, idx, arr) => {
                            if (idx > 0 && page - arr[idx - 1] > 1) {
                              acc.push(-1 * page);
                            }
                            acc.push(page);
                            return acc;
                          }, [])
                          .map((p, idx) => {
                            if (p < 0) {
                              return <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: 'var(--text-tertiary)' }}>...</span>;
                            }
                            return (
                              <button
                                key={p}
                                className={`apple-btn ${p === safePage ? 'apple-btn-pink' : 'apple-btn-secondary'}`}
                                style={{ minWidth: '32px', height: '32px', padding: 0, fontSize: '0.8rem', justifyContent: 'center' }}
                                onClick={() => setCurrentPage(p)}
                              >
                                {p}
                              </button>
                            );
                          })
                        }
                      </div>

                      <button
                        className="apple-btn apple-btn-secondary"
                        style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={safePage === totalPages}
                      >
                        التالية
                      </button>

                      <button
                        className="apple-btn apple-btn-secondary"
                        style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={safePage === totalPages}
                        title="الصفحة الأخيرة"
                      >
                        الأخيرة
                      </button>
                    </div>
                  )}
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
                      صاحب دعوة (مستقل)
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
    </div>
  );
}
