import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, Trash2, Check, X, FileCheck, Info } from 'lucide-react';

export default function ExcelValidationModal({ rawRows, onConfirmSave, onClose }) {
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

  // Validate single row item
  const validateItem = (item) => {
    const formattedPhone = formatPhone(item.phone);
    const isValidPhone = formattedPhone.length >= 11 && formattedPhone.length <= 13 && formattedPhone.startsWith('9665');
    const isValidName = item.name && item.name.trim().length > 1;

    let errorMsg = null;
    if (!isValidPhone) errorMsg = 'صيغة الرقم غير اكتمالة (يجب أن يبدأ بـ 05 ويتكون من 10 أرقام)';
    if (!isValidName) errorMsg = 'اسم الضيف غير مدخل أو قصير جداً';

    return {
      ...item,
      phone: formattedPhone || item.phone,
      isValid: isValidPhone && isValidName,
      errorMsg
    };
  };

  const [items, setItems] = useState(() => rawRows.map(validateItem));

  // Edit item inside modal
  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    updated[index] = validateItem(updated[index]);
    setItems(updated);
  };

  // Delete item row
  const handleDeleteRow = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Stats
  const totalCount = items.length;
  const validCount = items.filter(i => i.isValid).length;
  const invalidCount = totalCount - validCount;

  // Confirm save valid ones
  const handleConfirm = () => {
    const validItems = items.filter(i => i.isValid).map(i => ({
      id: i.id || ("g_" + Date.now() + "_" + Math.floor(Math.random() * 100000)),
      name: i.name || "ضيف عزيز",
      phone: i.phone,
      status: "pending",
      ticketCode: "EV-" + Math.floor(100000 + Math.random() * 900000),
      checkedIn: false,
      checkInTime: null
    }));

    if (validItems.length === 0) {
      alert('لا يوجد أرقام سليمة للحفظ. يرجى تصحيح البيانات في الجدول.');
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
        border: '2px solid var(--rose-primary)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '900px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(200, 138, 155, 0.25)',
        overflow: 'hidden'
      }}>

        {/* Modal Header */}
        <div style={{
          background: 'var(--rose-gradient)',
          color: '#ffffff',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileCheck size={26} />
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>مراجعة والتحقق من صحة بيانات ملف الإكسل</h2>
              <p style={{ fontSize: '0.82rem', opacity: 0.9 }}>قم بفحص الأسماء والأرقام وتعديل الأخطاء قبل الاعتماد في قاعدة البيانات</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {/* Summary Bar */}
        <div style={{
          background: 'rgba(245, 232, 236, 0.5)',
          padding: '14px 24px',
          borderBottom: '1px solid rgba(200, 138, 155, 0.15)',
          display: 'flex',
          gap: '20px',
          fontSize: '0.88rem',
          flexWrap: 'wrap'
        }}>
          <div><strong>إجمالي البيانات المستخرجة:</strong> <span class="ios-badge ios-badge-gold">{totalCount}</span></div>
          <div><strong>أرقام سليمة ومكتملة:</strong> <span class="ios-badge ios-badge-green"><CheckCircle2 size={14} /> {validCount}</span></div>
          {invalidCount > 0 && (
            <div><strong>تحتاج تصحيح:</strong> <span class="ios-badge ios-badge-red"><AlertTriangle size={14} /> {invalidCount}</span></div>
          )}
        </div>

        {/* Table Content */}
        <div style={{ overflowY: 'auto', padding: '20px', flex: 1 }}>
          <table class="apple-table">
            <thead>
              <tr>
                <th>#</th>
                <th>اسم الضيف (من الملف)</th>
                <th>رقم الجوال المفحوص</th>
                <th>حالة الصحة</th>
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
                      class="apple-input"
                      style={{ padding: '6px 10px', fontSize: '0.88rem' }}
                      value={item.name}
                      onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      class="apple-input"
                      style={{ padding: '6px 10px', fontSize: '0.88rem', direction: 'ltr', textAlign: 'right' }}
                      value={item.phone}
                      onChange={(e) => handleItemChange(idx, 'phone', e.target.value)}
                    />
                  </td>
                  <td>
                    {item.isValid ? (
                      <span class="ios-badge ios-badge-green"><Check size={14} /> صيغة سليمة</span>
                    ) : (
                      <span class="ios-badge ios-badge-red" title={item.errorMsg}><AlertTriangle size={14} /> {item.errorMsg || 'خطأ في الصيغة'}</span>
                    )}
                  </td>
                  <td>
                    <button class="apple-btn apple-btn-danger" style={{ padding: '4px 10px' }} onClick={() => handleDeleteRow(idx)}>
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
          borderTop: '1px solid rgba(200, 138, 155, 0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <button class="apple-btn apple-btn-secondary" onClick={onClose}>
            إلغاء
          </button>
          <button class="apple-btn apple-btn-pink" onClick={handleConfirm} style={{ padding: '12px 28px' }}>
            <Check size={18} /> اعتماد وحفظ الأرقام السليمة ({validCount}) في قاعدة البيانات
          </button>
        </div>

      </div>
    </div>
  );
}
