import React, { useState } from 'react';
import { Calendar, Plus, X, Upload, Image as ImageIcon, MapPin, Clock, Sparkles } from 'lucide-react';

export default function NewEventModal({ onCreateEvent, onClose }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('wedding');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('20:00');
  const [location, setLocation] = useState('');
  const [mapLink, setMapLink] = useState('https://maps.google.com');
  const [cardImage, setCardImage] = useState(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCardImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('يرجى كتابة عنوان المناسبة (مثل: حفل تخرج د. نورة)');
      return;
    }

    onCreateEvent({
      title: title.trim(),
      type,
      date: date || new Date().toISOString().split('T')[0],
      time,
      location: location.trim() || 'القاعة الرئيسية',
      mapLink: mapLink.trim() || 'https://maps.google.com',
      cardImage
    });
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
      zIndex: 2500,
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        border: '2px solid var(--pink-primary)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '620px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(244, 165, 186, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'var(--pink-gradient)',
          color: '#ffffff',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Sparkles size={24} />
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>إنشاء مناسبة ودعوة جديدة</h2>
              <p style={{ fontSize: '0.82rem', opacity: 0.9 }}>أضف مناسبة جديدة (زفاف، تخرج، اجتماع) وخصص كرت الدعوة</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          <div class="form-group" style={{ marginBottom: '16px' }}>
            <label>نوع المناسبة:</label>
            <select class="apple-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="wedding">💍 حفل زفاف / خطوبة</option>
              <option value="graduation">🎓 حفل تخرج</option>
              <option value="birthday">🎂 عيد ميلاد / مولود</option>
              <option value="honor">🏆 حفل تكريم / تفوق</option>
              <option value="conference">📜 مؤتمر / ورشة عمل</option>
              <option value="other">🌟 مناسبة عامة أخرى</option>
            </select>
          </div>

          <div class="form-group" style={{ marginBottom: '16px' }}>
            <label>عنوان المناسبة (يظهر في الدعوة والواتساب):</label>
            <input
              type="text"
              class="apple-input"
              placeholder="مثال: حفل تخرج د. نورة الشمري"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div class="form-group">
              <label>تاريخ المناسبة:</label>
              <input
                type="date"
                class="apple-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div class="form-group">
              <label>وقت المناسبة:</label>
              <input
                type="time"
                class="apple-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div class="form-group" style={{ marginBottom: '16px' }}>
            <label>اسم القاعة / موقع المناسبة:</label>
            <input
              type="text"
              class="apple-input"
              placeholder="مثال: قاعة الفخامة والمؤتمرات - الرياض"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div class="form-group" style={{ marginBottom: '16px' }}>
            <label>رابط اللوكيشن في خرائط جوجل:</label>
            <input
              type="url"
              class="apple-input"
              style={{ direction: 'ltr', textAlign: 'right' }}
              placeholder="https://maps.google.com/..."
              value={mapLink}
              onChange={(e) => setMapLink(e.target.value)}
            />
          </div>

          <div class="form-group" style={{ marginBottom: '20px' }}>
            <label>رفع صورة كرت الدعوة الخاص بهذه المناسبة:</label>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <label class="apple-btn apple-btn-secondary" style={{ cursor: 'pointer', flex: 1 }}>
                <Upload size={16} /> اختر صورة الكرت
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
              </label>

              {cardImage && (
                <div style={{ width: '60px', height: '60px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--pink-primary)' }}>
                  <img src={cardImage} alt="معاينة" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
            </div>
          </div>

          <button type="submit" class="apple-btn apple-btn-pink btn-block" style={{ padding: '14px' }}>
            <Plus size={18} /> إنشاء المناسبة والبدء بإضافة المدعوين
          </button>
        </form>
      </div>
    </div>
  );
}
