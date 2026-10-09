import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { CheckCircle2, AlertTriangle, Trash2, Check, X, FileCheck, Sparkles, Download, Filter, Loader2, ArrowUpDown } from 'lucide-react';

/**
 * Normalizes Arabic text for matching:
 * ى -> ي, ة -> ه, أ/إ/آ -> ا, removes tashkeel and extra spaces
 */
export function normalizeArabicName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

export function normalizePhone(phone) {
  if (!phone) return '';
  let clean = phone.toString().trim().replace(/\D/g, '');
  if (!clean) return '';
  if (clean.startsWith('00966')) clean = clean.substring(2);
  else if (clean.startsWith('05')) clean = '966' + clean.substring(1);
  else if (clean.startsWith('5') && clean.length === 9) clean = '966' + clean;
  return clean;
}

export function isValidSaudiPhone(phone) {
  const norm = normalizePhone(phone);
  return /^9665\d{8}$/.test(norm);
}

export default function ExcelValidationModal({
  rawRows = [],
  existingGuests = [],
  activeEventId,
  onConfirmSave,
  onClose
}) {
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null); // { savedCount, errorCount, errorRows }

  // Extract initial row objects
  const initialItems = useMemo(() => {
    return rawRows.map((r, idx) => ({
      id: r.id || `row_${idx + 1}_${Date.now()}`,
      originalIndex: idx + 1,
      name: (r.name || '').trim(),
      phone: (r.phone !== undefined && r.phone !== null) ? r.phone.toString().trim() : '',
      companionOf: (r.companionOf || r.parent_name || '').trim()
    }));
  }, [rawRows]);

  const [items, setItems] = useState(initialItems);

  // Existing DB sets (scoped strictly to current event)
  const existingDBNames = useMemo(() => {
    return new Set(existingGuests.map(g => normalizeArabicName(g.name)));
  }, [existingGuests]);

  const existingDBPhones = useMemo(() => {
    return new Set(existingGuests.filter(g => g.phone).map(g => normalizePhone(g.phone)));
  }, [existingGuests]);

  const existingDBOwners = useMemo(() => {
    return existingGuests.filter(g => !g.parent_guest_id);
  }, [existingGuests]);

  // Comprehensive multi-pass validation
  const validatedItems = useMemo(() => {
    // Pass 1: Count name and phone frequencies inside current list
    const fileNamesCount = new Map();
    const filePhonesCount = new Map();

    items.forEach(it => {
      const normN = normalizeArabicName(it.name);
      const normP = normalizePhone(it.phone);
      if (normN) fileNamesCount.set(normN, (fileNamesCount.get(normN) || 0) + 1);
      if (normP) filePhonesCount.set(normP, (filePhonesCount.get(normP) || 0) + 1);
    });

    // Pass 2: Base independent checks (Name, Phone exclusivity, Formats, Existing Duplicates)
    const preliminary = items.map((item) => {
      const cleanName = (item.name || '').trim();
      const normName = normalizeArabicName(cleanName);
      const rawPhone = (item.phone || '').trim();
      const normP = normalizePhone(rawPhone);
      const cleanCompanion = (item.companionOf || '').trim();
      const normCompanion = normalizeArabicName(cleanCompanion);

      const hasPhone = Boolean(rawPhone);
      const hasCompanion = Boolean(cleanCompanion);

      let reason = null;

      if (!cleanName || cleanName.length < 2) {
        reason = 'اسم الضيف مطلوب';
      } else if (fileNamesCount.get(normName) > 1) {
        reason = 'اسم الضيف مكرر في الملف';
      } else if (existingDBNames.has(normName)) {
        reason = 'موجود مسبقاً';
      } else if (!hasPhone && !hasCompanion) {
        reason = 'يجب إدخال رقم الجوال أو تحديد صاحب الدعوة (مرافق لـ)';
      } else if (hasPhone && hasCompanion) {
        reason = 'المرافق لا يمتلك جوال (إما رقم جوال أو مرافق لـ)';
      } else if (hasPhone && !hasCompanion) {
        if (!isValidSaudiPhone(rawPhone)) {
          reason = 'صيغة رقم الجوال غير صحيحة (9665xxxxxxxx)';
        } else if (filePhonesCount.get(normP) > 1) {
          reason = 'رقم الجوال مكرر في الملف';
        } else if (existingDBPhones.has(normP)) {
          reason = 'موجود مسبقاً';
        }
      }

      return {
        ...item,
        cleanName,
        normName,
        rawPhone,
        normPhone: normP,
        cleanCompanion,
        normCompanion,
        isOwner: !hasCompanion,
        errorReason: reason,
        isValid: reason === null
      };
    });

    // Pass 3: Companion & Hierarchy checks
    return preliminary.map((row) => {
      if (row.isOwner) {
        return row;
      }

      // If already failed base checks
      if (row.errorReason) {
        return row;
      }

      // Check: Guest cannot follow themselves
      if (row.normCompanion === row.normName) {
        return { ...row, isValid: false, errorReason: 'الضيف لا يمكن أن يرافق نفسه' };
      }

      // Owner lookup: Search BOTH rows in current file AND existing owners in DB (Req 9f)
      const matchingFileRows = preliminary.filter(r => r.normName === row.normCompanion);
      const matchingDBOwner = existingDBOwners.find(o => normalizeArabicName(o.name) === row.normCompanion);

      if (matchingFileRows.length === 0 && !matchingDBOwner) {
        return { ...row, isValid: false, errorReason: 'صاحب الدعوة غير موجود' };
      }

      if (matchingFileRows.length > 1) {
        return { ...row, isValid: false, errorReason: 'اسم صاحب الدعوة مكرر في الملف' };
      }

      if (matchingFileRows.length === 1) {
        const ownerRow = matchingFileRows[0];
        // Owner is itself a dependent (one level only)
        if (!ownerRow.isOwner || ownerRow.cleanCompanion) {
          return { ...row, isValid: false, errorReason: 'صاحب الدعوة لا يمكن أن يكون مرافقاً' };
        }
        // Owner row has an error
        if (!ownerRow.isValid) {
          return { ...row, isValid: false, errorReason: 'صاحب الدعوة به خطأ' };
        }
      }

      // Valid companion
      return { ...row, isValid: true, errorReason: null };
    });
  }, [items, existingDBNames, existingDBPhones, existingDBOwners]);

  // Re-run validation on change
  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      // If setting companion, clear phone automatically
      if (field === 'companionOf' && value) {
        copy[index].phone = '';
      }
      return copy;
    });
  };

  // Delete item row (Phase 2 Req 6: Live re-validation)
  const handleDeleteRow = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Summary statistics (Phase 2 Req 7)
  const totalCount = validatedItems.length;
  const validCount = validatedItems.filter(i => i.isValid).length;
  const errorCount = totalCount - validCount;
  const withPhoneCount = validatedItems.filter(i => Boolean(i.rawPhone) && !i.cleanCompanion).length;
  const companionsCount = validatedItems.filter(i => Boolean(i.cleanCompanion)).length;

  // Sorted items (Errors first, with toggle) (Phase 2 Req 8)
  const displayedItems = useMemo(() => {
    let list = [...validatedItems];
    if (showErrorsOnly) {
      list = list.filter(i => !i.isValid);
    }
    // Sort so error rows appear first
    return list.sort((a, b) => {
      if (!a.isValid && b.isValid) return -1;
      if (a.isValid && !b.isValid) return 1;
      return a.originalIndex - b.originalIndex;
    });
  }, [validatedItems, showErrorsOnly]);

  // Options for "مرافق لـ" dropdown
  const companionOptions = useMemo(() => {
    const names = [];
    const seen = new Set();

    // From current file (exclude duplicates/empties)
    items.forEach(it => {
      const n = (it.name || '').trim();
      if (n && n.length >= 2 && !seen.has(normalizeArabicName(n))) {
        seen.add(normalizeArabicName(n));
        names.push({ name: n, source: 'file' });
      }
    });

    // From DB owners
    existingDBOwners.forEach(o => {
      const n = o.name.trim();
      if (!seen.has(normalizeArabicName(n))) {
        seen.add(normalizeArabicName(n));
        names.push({ name: n, source: 'db' });
      }
    });

    return names;
  }, [items, existingDBOwners]);

  // Generate and download error file "سجلات_بها_مشاكل.xlsx" (Phase 3 Req 9c)
  const downloadErrorFile = (errorsList) => {
    const listToExport = errorsList || validatedItems.filter(i => !i.isValid);
    if (listToExport.length === 0) return;

    const exportRows = [
      ['م', 'اسم الضيف', 'رقم الجوال', 'مرافق لـ', 'سبب المشكلة']
    ];

    listToExport.forEach((item, idx) => {
      exportRows.push([
        idx + 1,
        item.cleanName || item.name || '',
        item.rawPhone ? String(item.rawPhone) : '',
        item.cleanCompanion || item.companionOf || '',
        item.errorReason || 'بيانات غير مكتملة'
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(exportRows);
    ws['!views'] = [{ rightToLeft: true }];
    ws['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 18 }, { wch: 25 }, { wch: 32 }];

    // Ensure phone column (C) is formatted as text strings
    for (let r = 2; r <= exportRows.length; r++) {
      const phoneCell = ws['C' + r];
      if (phoneCell) phoneCell.t = 's';
    }

    XLSX.utils.book_append_sheet(wb, ws, 'سجلات بها مشاكل');
    XLSX.writeFile(wb, 'سجلات_بها_مشاكل.xlsx');
  };

  // Confirm Save Valid Rows in ONE database transaction (Phase 3 Req 9a, 9c, 9d, 9e)
  const handleConfirmSave = async () => {
    if (validCount === 0) {
      alert('لا توجد سجلات سليمة للحفظ. يمكنك تنزيل ملف الأخطاء لمراجعتها.');
      return;
    }

    setIsSaving(true);
    try {
      const payloadRows = validatedItems.map(it => ({
        name: it.cleanName,
        phone: it.rawPhone,
        companionOf: it.cleanCompanion
      }));

      const res = await fetch('/api/guests/import-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: activeEventId,
          rows: payloadRows
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل استيراد وحفظ البيانات');
      }

      const returnedErrors = data.errorRows || [];

      // Automatically generate and download error file if error rows exist (Req 9c)
      if (returnedErrors.length > 0) {
        downloadErrorFile(returnedErrors);
      }

      setSaveResult({
        savedCount: data.savedCount || 0,
        errorCount: returnedErrors.length,
        errorRows: returnedErrors
      });

      if (onConfirmSave) {
        onConfirmSave(data);
      }
    } catch (err) {
      alert('حدث خطأ أثناء حفظ البيانات: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.55)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        border: '1.5px solid var(--pink-primary)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '1020px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        direction: 'rtl'
      }}>

        {/* Modal Header */}
        <div style={{
          background: 'var(--pink-gradient)',
          color: '#ffffff',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileCheck size={26} />
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>مراجعة والتحقق من صحة وعدم تكرار بيانات الإكسل</h2>
              <p style={{ fontSize: '0.82rem', opacity: 0.95, margin: '2px 0 0 0' }}>فحص وتدقيق الأسماء، أرقام الجوال، والمرافقين قبل الحفظ النهائي</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
            <X size={24} />
          </button>
        </div>

        {/* Post-Save Result Banner */}
        {saveResult && (
          <div style={{
            background: saveResult.errorCount > 0 ? '#fef3c7' : '#dcfce7',
            borderBottom: '1px solid rgba(0,0,0,0.1)',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.92rem', fontWeight: 700, color: saveResult.errorCount > 0 ? '#92400e' : '#166534' }}>
              <CheckCircle2 size={18} />
              <span>
                تم حفظ {saveResult.savedCount} ضيف بنجاح.
                {saveResult.errorCount > 0 && ` (${saveResult.errorCount}) سجلات بها مشاكل، تم تحميل ملف الأخطاء.`}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {saveResult.errorCount > 0 && (
                <button
                  type="button"
                  className="apple-btn apple-btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.82rem', borderColor: '#d97706', color: '#b45309' }}
                  onClick={() => downloadErrorFile(saveResult.errorRows)}
                >
                  <Download size={14} /> تحميل الملف مرة أخرى
                </button>
              )}
              <button
                type="button"
                className="apple-btn apple-btn-pink"
                style={{ padding: '6px 16px', fontSize: '0.82rem' }}
                onClick={onClose}
              >
                إغلاق
              </button>
            </div>
          </div>
        )}

        {/* Top Summary Chips (Phase 3 Req 7) */}
        <div style={{
          background: 'rgba(253, 242, 245, 0.85)',
          padding: '12px 24px',
          borderBottom: '1px solid rgba(244, 165, 186, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          fontSize: '0.86rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="ios-badge" style={{ background: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }}>
              <strong>{totalCount}</strong> سجل
            </span>
            <span className="ios-badge ios-badge-green">
              <CheckCircle2 size={13} /> <strong>{validCount}</strong> سليم
            </span>
            <span className="ios-badge" style={{ background: 'rgba(64, 123, 161, 0.12)', color: 'var(--pink-dark)' }}>
              <strong>{withPhoneCount}</strong> بجوال
            </span>
            <span className="ios-badge" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5' }}>
              <strong>{companionsCount}</strong> مرافقون
            </span>
            {errorCount > 0 && (
              <span className="ios-badge ios-badge-red">
                <AlertTriangle size={13} /> <strong>{errorCount}</strong> أخطاء
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Toggle Error Filter (Phase 3 Req 8) */}
            <button
              type="button"
              className={`apple-btn ${showErrorsOnly ? 'apple-btn-pink' : 'apple-btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setShowErrorsOnly(prev => !prev)}
            >
              <Filter size={14} /> {showErrorsOnly ? 'عرض الكل' : 'عرض الأخطاء فقط'}
            </button>

            {/* Download Error file on demand */}
            {errorCount > 0 && (
              <button
                type="button"
                className="apple-btn apple-btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#dc2626', borderColor: '#fca5a5' }}
                onClick={() => downloadErrorFile()}
                title="تنزيل ملف Excel بالسجلات التي بها أخطاء"
              >
                <Download size={14} /> تنزيل ملف الأخطاء
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div style={{ overflowY: 'auto', padding: '16px 24px', flex: 1 }}>
          <table className="apple-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th style={{ minWidth: '180px' }}>اسم الضيف (إلزامي)</th>
                <th style={{ minWidth: '160px' }}>رقم الجوال (إلزامي إذا لم يكن مرافقاً)</th>
                <th style={{ minWidth: '180px' }}>مرافق لـ</th>
                <th style={{ minWidth: '170px' }}>نتيجة التحقق وتوافق البيانات</th>
                <th style={{ width: '50px' }}>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                    {showErrorsOnly ? 'رائع! لا توجد سجلات بها أخطاء.' : 'لا توجد بيانات مدخلة.'}
                  </td>
                </tr>
              ) : (
                displayedItems.map((item) => {
                  const itemIndex = items.findIndex(i => i.id === item.id);

                  return (
                    <tr
                      key={item.id}
                      style={{
                        background: item.isValid ? 'transparent' : 'rgba(239, 68, 68, 0.05)',
                        borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        {item.originalIndex}
                      </td>
                      <td>
                        <input
                          type="text"
                          className="apple-input"
                          placeholder="اسم الضيف (إلزامي)"
                          style={{
                            padding: '6px 10px',
                            fontSize: '0.86rem',
                            borderColor: !item.cleanName ? 'rgba(239, 68, 68, 0.5)' : undefined
                          }}
                          value={item.name || ''}
                          onChange={(e) => handleItemChange(itemIndex, 'name', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="tel"
                          className="apple-input"
                          placeholder={item.companionOf ? 'المرافق لا يحتاج جوال' : '0501234567'}
                          disabled={Boolean(item.companionOf)}
                          style={{
                            padding: '6px 10px',
                            fontSize: '0.86rem',
                            direction: 'ltr',
                            textAlign: 'right',
                            background: item.companionOf ? '#f1f5f9' : '#ffffff',
                            borderColor: (!item.companionOf && !isValidSaudiPhone(item.phone)) ? 'rgba(239, 68, 68, 0.5)' : undefined
                          }}
                          value={item.phone || ''}
                          onChange={(e) => handleItemChange(itemIndex, 'phone', e.target.value)}
                        />
                      </td>
                      <td>
                        {/* Dropdown for "مرافق لـ" (Phase 3 Req 2) */}
                        <select
                          className="apple-input"
                          style={{
                            padding: '6px 10px',
                            fontSize: '0.85rem',
                            background: item.companionOf ? 'rgba(99, 102, 241, 0.05)' : '#ffffff'
                          }}
                          value={item.companionOf || ''}
                          onChange={(e) => handleItemChange(itemIndex, 'companionOf', e.target.value)}
                        >
                          <option value="">-- ضيف مستقل (صاحب دعوة) --</option>
                          {companionOptions
                            .filter(opt => normalizeArabicName(opt.name) !== item.normName)
                            .map((opt, oIdx) => (
                              <option key={oIdx} value={opt.name}>
                                مرافق لـ: {opt.name} {opt.source === 'db' ? '(محفوظ مسبقاً)' : ''}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>
                        {/* Result column (Phase 3 Req 4) */}
                        {item.isValid ? (
                          <span className="ios-badge ios-badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
                            <Check size={13} /> سليم
                          </span>
                        ) : (
                          <span className="ios-badge ios-badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }} title={item.errorReason}>
                            <AlertTriangle size={13} /> {item.errorReason || 'بيانات غير صالحة'}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="apple-btn apple-btn-danger"
                          style={{ padding: '5px 8px' }}
                          title="حذف هذا السطر"
                          onClick={() => handleDeleteRow(itemIndex)}
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

        {/* Modal Footer Actions (Phase 3 Req 9) */}
        <div style={{
          padding: '16px 24px',
          background: '#faf7f8',
          borderTop: '1px solid rgba(244, 165, 186, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <button
            type="button"
            className="apple-btn apple-btn-secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            إلغاء
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            {/* If all rows invalid, show download error file button only */}
            {validCount === 0 && errorCount > 0 && (
              <button
                type="button"
                className="apple-btn apple-btn-secondary"
                style={{ borderColor: '#dc2626', color: '#dc2626', padding: '10px 20px', fontWeight: 700 }}
                onClick={() => downloadErrorFile()}
              >
                <Download size={16} /> تنزيل ملف الأخطاء للإصلاح ({errorCount})
              </button>
            )}

            {/* Confirm button */}
            <button
              type="button"
              className="apple-btn apple-btn-pink"
              onClick={handleConfirmSave}
              disabled={validCount === 0 || isSaving}
              style={{
                padding: '11px 26px',
                fontWeight: 800,
                fontSize: '0.92rem',
                opacity: validCount === 0 ? 0.5 : 1
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> جاري الحفظ والمعالجة...
                </>
              ) : (
                <>
                  <Check size={18} /> اعتماد وحفظ الأرقام السليمة ({validCount})
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
