import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, Trash2, Check, X, FileCheck, Sparkles } from 'lucide-react';

export default function ExcelValidationModal({ rawRows, existingGuests = [], onConfirmSave, onClose }) {
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

  // Validate items list including duplicate detection against existing DB and self-duplicates
  const runValidation = (rawList) => {
    const seenPhones = new Set();

    // Collect existing DB phones
    (existingGuests || []).forEach(g => {
      if (g.phone) seenPhones.add(g.phone.trim());
    });

    return rawList.map((item) => {
      const formattedPhone = formatPhone(item.phone);
      const cleanName = (item.name || '').trim();
      const rawCount = item.count;
      const parsedCount = parseInt(rawCount);
      const hasValidCount = rawCount !== '' && rawCount !== null && rawCount !== undefined && !isNaN(parsedCount) && parsedCount >= 1;

      const isValidPhone = formattedPhone && formattedPhone.length >= 11 && formattedPhone.length <= 13 && formattedPhone.startsWith('9665');
      const isValidName = cleanName.length >= 2 && cleanName !== 'ضيف عزيز';

      // Duplicate Check (by phone number only)
      const isDuplicate = isValidPhone && seenPhones.has(formattedPhone);

      // Mark phone seen for self-duplication inside the same file
      if (isValidPhone) seenPhones.add(formattedPhone);

      let errorMsg = null;
      if (!isValidName) errorMsg = 'اسم الضيف إلزامي (يرجى إدخال اسم صحيح)';
      else if (!isValidPhone) errorMsg = 'رقم الجوال إلزامي (يجب أن يبدأ بـ 05 ويتكون من 10 أرقام)';
      else if (!hasValidCount) errorMsg = 'عدد المدعوين إلزامي (يجب إدخال 1 على الأقل)';
      else if (isDuplicate) errorMsg = 'مكرر: رقم الجوال موجود مسبقاً في البيانات';

      return {
        ...item,
        name: cleanName,
        phone: formattedPhone || item.phone || '',
        count: hasValidCount ? parsedCount : (rawCount !== undefined && rawCount !== null ? rawCount : ''),
        isValid: isValidPhone && isValidName && hasValidCount && !isDuplicate,
        isDuplicate,
        errorMsg
      };
    });
  };

  const [items, setItems] = useState(() => runValidation(rawRows));

  // Re-run validation on change
  const handleItemChange = (index, field, value) => {
    const rawCopy = items.map(i => ({ ...i }));
    rawCopy[index][field] = value;
    setItems(runValidation(rawCopy));
  };

  // Delete item row
  const handleDeleteRow = (index) => {
    const filtered = items.filter((_, i) => i !== index);
    setItems(runValidation(filtered));
  };

  // Auto remove duplicates & invalid rows
  const handleRemoveDuplicates = () => {
    const cleanList = items.filter(i => i.isValid);
    setItems(runValidation(cleanList));
  };

  // Stats
  const totalCount = items.length;
  const validCount = items.filter(i => i.isValid).length;
  const duplicateCount = items.filter(i => i.isDuplicate).length;
  const invalidCount = totalCount - validCount;

  // Confirm save valid ones
  const handleConfirm = () => {
    const validItems = items.filter(i => i.isValid).map(i => ({
      id: i.id || ("g_" + Date.now() + "_" + Math.floor(Math.random() * 100000)),
      name: i.name.trim(),
      phone: i.phone,
      count: parseInt(i.count) || 1,
      companions: parseInt(i.count) || 1,
      status: "pending",
      ticketCode: "EV-" + Math.floor(100000 + Math.random() * 900000),
      checkedIn: false,
      checkInTime: null
    }));

    if (validItems.length === 0) {
      alert('لا توجد سجلات مكتملة وسليمة للحفظ. يرجى التأكد من إدخال اسم الضيف، رقم الجوال، وعدد المدعوين لجميع السجلات.');
      return;
    }

    onConfirmSave(validItems);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.45)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        border: '2px solid var(--pink-primary)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '960px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(244, 165, 186, 0.25)',
        overflow: 'hidden'
      }}>

        {/* Modal Header */}
        <div style={{
          background: 'var(--pink-gradient)',
          color: '#ffffff',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileCheck size={26} />
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>مراجعة والتحقق من صحة وعدم تكرار بيانات الإكسل</h2>
              <p style={{ fontSize: '0.82rem', opacity: 0.9 }}>فحص الأسماء والأرقام والتحقق من عدم تكرارها قبل الاعتماد النهائي</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {/* Summary Bar */}
        <div style={{
          background: 'rgba(253, 242, 245, 0.8)',
          padding: '14px 24px',
          borderBottom: '1px solid rgba(244, 165, 186, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '15px',
          fontSize: '0.88rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div><strong>إجمالي السجلات:</strong> <span className="ios-badge ios-badge-gold">{totalCount}</span></div>
            <div><strong>سليمة وغير مكررة:</strong> <span className="ios-badge ios-badge-green"><CheckCircle2 size={14} /> {validCount}</span></div>
            {duplicateCount > 0 && (
              <div><strong>بيانات مكررة:</strong> <span className="ios-badge ios-badge-gold"><AlertTriangle size={14} /> {duplicateCount}</span></div>
            )}
            {invalidCount > duplicateCount && (
              <div><strong>صيغة خطأ:</strong> <span className="ios-badge ios-badge-red"><AlertTriangle size={14} /> {invalidCount - duplicateCount}</span></div>
            )}
          </div>

          {(duplicateCount > 0 || invalidCount > 0) && (
            <button className="apple-btn apple-btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem' }} onClick={handleRemoveDuplicates}>
              <Sparkles size={14} /> حذف المكرر والأخطاء تلقائياً
            </button>
          )}
        </div>

        {/* Table Content */}
        <div style={{ overflowY: 'auto', padding: '20px', flex: 1 }}>
          <table className="apple-table">
            <thead>
              <tr>
                <th>#</th>
                <th>اسم الضيف (إلزامي)</th>
                <th>رقم الجوال (إلزامي)</th>
                <th style={{ width: '90px', textAlign: 'center' }}>المدعوين (إلزامي)</th>
                <th>نتيجة التحقق وتوافق البيانات</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} style={{ background: item.isValid ? 'transparent' : 'rgba(224, 72, 72, 0.04)' }}>
                  <td>{idx + 1}</td>
                  <td>
                    <input
                      type="text"
                      className="apple-input"
                      placeholder="اسم الضيف (إلزامي)"
                      style={{ padding: '6px 10px', fontSize: '0.88rem', borderColor: !item.name ? 'rgba(231, 76, 60, 0.4)' : undefined }}
                      value={item.name || ''}
                      onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="apple-input"
                      placeholder="0501234567 (إلزامي)"
                      style={{ padding: '6px 10px', fontSize: '0.88rem', direction: 'ltr', textAlign: 'right', borderColor: !item.phone ? 'rgba(231, 76, 60, 0.4)' : undefined }}
                      value={item.phone || ''}
                      onChange={(e) => handleItemChange(idx, 'phone', e.target.value)}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      className="apple-input"
                      style={{ padding: '6px 8px', fontSize: '0.88rem', width: '65px', textAlign: 'center', borderColor: !item.count || item.count < 1 ? 'rgba(231, 76, 60, 0.4)' : undefined }}
                      placeholder="1"
                      value={item.count !== undefined && item.count !== null ? item.count : ''}
                      onChange={(e) => handleItemChange(idx, 'count', e.target.value)}
                    />
                  </td>
                  <td>
                    {item.isValid ? (
                      <span className="ios-badge ios-badge-green"><Check size={14} /> سليم وغير مكرر</span>
                    ) : item.isDuplicate ? (
                      <span className="ios-badge ios-badge-gold" title={item.errorMsg}><AlertTriangle size={14} /> {item.errorMsg}</span>
                    ) : (
                      <span className="ios-badge ios-badge-red" title={item.errorMsg}><AlertTriangle size={14} /> {item.errorMsg || 'خطأ في الصيغة'}</span>
                    )}
                  </td>
                  <td>
                    <button className="apple-btn apple-btn-danger" style={{ padding: '4px 10px' }} onClick={() => handleDeleteRow(idx)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal Footer Actions */}
        <div style={{
          padding: '18px 24px',
          background: '#faf7f8',
          borderTop: '1px solid rgba(244, 165, 186, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <button className="apple-btn apple-btn-secondary" onClick={onClose}>
            إلغاء
          </button>
          <button className="apple-btn apple-btn-pink" onClick={handleConfirm} style={{ padding: '12px 28px' }}>
            <Check size={18} /> اعتماد وحفظ الأرقام السليمة ({validCount}) في قاعدة البيانات
          </button>
        </div>

      </div>
    </div>
  );
}
