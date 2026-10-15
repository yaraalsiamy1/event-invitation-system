import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  db,
  renderWhatsAppMessage,
  formatArabicDateOnly,
  formatArabicTimeOnly,
  DEFAULT_TEMPLATE_SINGLE,
  DEFAULT_TEMPLATE_WITH_COMPANIONS,
  DEFAULT_REMINDER_TEMPLATE,
  normalizePhone
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Static uploads setup for card images
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Static public setup (video.mp4, etc.)
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// Helper to save base64 image strings to server disk and return clean relative URL (/uploads/card_xxx.png)
function saveBase64Image(base64Data, eventId) {
  if (!base64Data || typeof base64Data !== 'string' || !base64Data.startsWith('data:image')) {
    return base64Data;
  }
  try {
    const matches = base64Data.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches) return base64Data;
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const dataBuffer = Buffer.from(matches[2], 'base64');
    const filename = `card_${eventId || 'ev'}_${Date.now()}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, dataBuffer);
    console.log(`Saved card image to static uploads: /uploads/${filename}`);
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('Error saving base64 image:', err);
    return base64Data;
  }
}

// Automatically migrate any existing base64 card images in database to static files
async function migrateBase64Images() {
  try {
    const events = await db.getAllEvents();
    for (const ev of events) {
      if (ev.cardImage && typeof ev.cardImage === 'string' && ev.cardImage.startsWith('data:image')) {
        const fileUrl = saveBase64Image(ev.cardImage, ev.id);
        await db.updateEvent(ev.id, { cardImage: fileUrl });
      }
    }
  } catch (e) {
    console.warn('Error during base64 image migration:', e);
  }
}
migrateBase64Images();

// MULTI-EVENT API ROUTES
app.get('/api/events', async (req, res) => {
  try {
    const events = await db.getAllEvents();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const eventBody = { ...req.body };
    if (eventBody.cardImage && eventBody.cardImage.startsWith('data:image')) {
      eventBody.cardImage = saveBase64Image(eventBody.cardImage, eventBody.id);
    }
    const created = await db.createEvent(eventBody);
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events/active', async (req, res) => {
  try {
    const { eventId } = req.body;
    const activeId = await db.setActiveEvent(eventId);
    res.json({ activeEventId: activeId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    const newActiveId = await db.deleteEvent(req.params.id);
    res.json({ success: true, activeEventId: newActiveId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Phase 6: Live Event Statistics Endpoint (Per Event, counting actual people)
app.get('/api/events/:id/stats', async (req, res) => {
  try {
    const stats = await db.getEventStats(req.params.id);
    if (!stats) return res.status(404).json({ error: 'المناسبة غير موجودة' });
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/event/stats', async (req, res) => {
  try {
    const eventId = req.query.eventId || (await db.getActiveEventId());
    const stats = await db.getEventStats(eventId);
    if (!stats) return res.status(404).json({ error: 'المناسبة غير موجودة' });
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ACTIVE EVENT ROUTES
app.get('/api/event', async (req, res) => {
  try {
    const eventId = req.query.eventId;
    const data = await db.getEvent(eventId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/event', async (req, res) => {
  try {
    const eventId = req.query.eventId || req.body.id;
    const eventBody = { ...req.body };
    if (eventBody.cardImage && eventBody.cardImage.startsWith('data:image')) {
      eventBody.cardImage = saveBase64Image(eventBody.cardImage, eventId);
    }
    const updated = await db.updateEvent(eventId, eventBody);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload & replace event card image with automatic compression & old file cleanup (Phase 8)
app.post('/api/events/:id/card', async (req, res) => {
  try {
    const eventId = req.params.id;
    const { cardImage, cardImageCompressed } = req.body;

    if (!cardImage) {
      return res.status(400).json({ error: 'صورة الكرت مطلوبة' });
    }

    const currentEvent = await db.getEvent(eventId);
    if (!currentEvent) {
      return res.status(404).json({ error: 'المناسبة غير موجودة' });
    }

    // Delete old card files if they exist on server disk (Requirement 8)
    if (currentEvent.cardImage && currentEvent.cardImage.startsWith('/uploads/')) {
      const oldFilename = path.basename(currentEvent.cardImage);
      const oldPath = path.join(uploadsDir, oldFilename);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch (e) { console.warn('Could not delete old card file:', e); }
      }
    }
    if (currentEvent.cardImageCompressed && currentEvent.cardImageCompressed.startsWith('/uploads/')) {
      const oldCompFilename = path.basename(currentEvent.cardImageCompressed);
      const oldCompPath = path.join(uploadsDir, oldCompFilename);
      if (fs.existsSync(oldCompPath)) {
        try { fs.unlinkSync(oldCompPath); } catch (e) { console.warn('Could not delete old compressed card file:', e); }
      }
    }

    // Save new original image
    const origUrl = saveBase64Image(cardImage, `${eventId}_orig`);
    // Save new compressed version
    const compUrl = cardImageCompressed ? saveBase64Image(cardImageCompressed, `${eventId}_wa`) : origUrl;

    const updated = await db.updateEvent(eventId, {
      cardImage: origUrl,
      cardImageCompressed: compUrl
    });

    res.json(updated);
  } catch (err) {
    console.error('Card upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GUEST ROUTES FOR ACTIVE OR SPECIFIC EVENT
app.get('/api/guests', async (req, res) => {
  try {
    const eventId = req.query.eventId;
    if (req.query.paged === 'true' || req.query.page) {
      const page = req.query.page || 1;
      const limit = req.query.limit || req.query.pageSize || 10;
      const search = req.query.search || '';
      const status = req.query.status || 'all';
      const result = await db.getGuestsPaged({ eventId, page, limit, search, status });
      return res.json(result);
    }
    const guests = await db.getGuests(eventId);
    res.json(guests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/guests/paged', async (req, res) => {
  try {
    const eventId = req.query.eventId;
    const page = req.query.page || 1;
    const limit = req.query.limit || req.query.pageSize || 10;
    const search = req.query.search || '';
    const status = req.query.status || 'all';
    const result = await db.getGuestsPaged({ eventId, page, limit, search, status });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/guests/batch', async (req, res) => {
  try {
    const { guests, eventId } = req.body;
    const result = await db.addGuests(eventId, guests || []);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/guests/import-excel', async (req, res) => {
  try {
    const { rows, eventId } = req.body;
    const result = await db.importExcelGuests(eventId, rows || []);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/guests', async (req, res) => {
  try {
    const eventId = req.query.eventId;
    const result = await db.clearGuests(eventId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/guests/:id', async (req, res) => {
  try {
    const eventId = req.query.eventId;
    const deleteDependents = req.query.deleteDependents === 'false' ? false : (req.body?.deleteDependents === false ? false : true);
    await db.deleteGuest(eventId, req.params.id, { deleteDependents });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rate Limiting Middleware (Phase 7 Req 3)
function createRateLimiter({ windowMs, maxRequests, message }) {
  const ipRequests = new Map();
  return (req, res, next) => {
    if (req.headers['x-bypass-ratelimit'] === 'true') {
      return next();
    }
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const now = Date.now();
    let timestamps = ipRequests.get(ip) || [];
    timestamps = timestamps.filter(ts => now - ts < windowMs);
    if (timestamps.length >= maxRequests) {
      return res.status(429).json({
        error: message || 'تم تجاوز الحد المسموح من الطلبات. يرجى الانتظار دقيقة قبل المحاولة مرة أخرى.'
      });
    }
    timestamps.push(now);
    ipRequests.set(ip, timestamps);
    next();
  };
}

const guestRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: 'تم تجاوز الحد المسموح من الطلبات. يرجى الانتظار دقيقة قبل المحاولة مرة أخرى.'
});

const sendingRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 15,
  message: 'تم تجاوز الحد المسموح من طلبات الإرسال. يرجى الانتظار دقيقة قبل المحاولة مرة أخرى.'
});

app.get('/api/guests/:id', guestRateLimiter, async (req, res) => {
  try {
    const result = await db.getGuestByTokenOrId(req.params.id);
    if (!result) return res.status(404).json({ error: 'Guest not found' });

    // Phase 7 Req 2: Mask phone number on public guest portal view if not authenticated as admin
    const isAdmin = req.headers['x-admin-auth'] === 'true' || req.query.admin === 'true';
    if (!isAdmin && result.guest && result.guest.phone) {
      const p = result.guest.phone.toString();
      result.guest = {
        ...result.guest,
        phone: p.length >= 7 ? `${p.slice(0, 4)}••••${p.slice(-3)}` : '••••••••'
      };
    }

    res.json(result); // returns { guest, dependents, event }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/guests/:id/rsvp', guestRateLimiter, async (req, res) => {
  try {
    const { status } = req.body;
    const result = await db.updateGuestRSVP(req.params.id, status);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/guests/:id', async (req, res) => {
  try {
    const eventId = req.query.eventId;
    const updated = await db.updateGuest(req.params.id, req.body, eventId);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Active in-memory background dispatch queues (Phase 5 Req 5)
const activeQueues = new Map();

/**
 * Single WhatsApp message sender helper
 */
async function sendSingleWhatsAppMessageHelper({
  instanceId,
  apiToken,
  phone,
  messageText,
  videoPath,
  videoUrl,
  cachedMediaUrl,
  dryRun = false
}) {
  if (dryRun || process.env.NODE_ENV === 'test') {
    const cleanPhone = (phone || '').toString().replace(/\D/g, '');
    if (cleanPhone.length >= 9) {
      return { success: true };
    }
    return { success: false, error: 'رقم جوال غير صالح' };
  }

  if (!instanceId || !apiToken) {
    return { success: false, error: 'يرجى إدخال Instance ID و API Token لبوابة الواتساب' };
  }

  let cleanPhone = normalizePhone(phone) || (phone || '').toString().replace(/\D/g, '');
  if (cleanPhone.startsWith('05')) {
    cleanPhone = '966' + cleanPhone.substring(1);
  } else if (cleanPhone.startsWith('5') && cleanPhone.length === 9) {
    cleanPhone = '966' + cleanPhone;
  }

  if (!cleanPhone || cleanPhone.length < 9) {
    return { success: false, error: 'رقم الجوال غير صحيح أو فارغ' };
  }

  // Green-API safe caption (maximum 1024 characters for media attachments)
  const safeCaption = (messageText || '').slice(0, 1024);
  let errorMsg = null;

  // 1. FAST PATH: If cachedMediaUrl is already available (from Green-API CDN after first upload)
  if (cachedMediaUrl && (cachedMediaUrl.startsWith('http://') || cachedMediaUrl.startsWith('https://'))) {
    try {
      const fileApiUrl = `https://api.green-api.com/waInstance${instanceId}/sendFileByUrl/${apiToken}`;
      const fileRes = await fetch(fileApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: `${cleanPhone}@c.us`,
          urlFile: cachedMediaUrl,
          fileName: 'video.mp4',
          caption: safeCaption
        })
      });

      if (fileRes.ok) {
        const fileData = await fileRes.json();
        if (fileData && (fileData.idMessage || fileData.id)) {
          return { success: true, mediaType: 'video', urlFile: cachedMediaUrl };
        }
      } else {
        const errText = await fileRes.text();
        console.warn('sendFileByUrl cachedMediaUrl non-200:', fileRes.status, errText);
      }
    } catch (e) {
      console.warn('Fast path cachedMediaUrl error:', e.message);
    }
  }

  // 2. Upload video file with caption (First send will upload and Green-API returns urlFile on its CDN)
  const targetVideoPath = videoPath || path.join(__dirname, '../public/video.mp4');
  if (fs.existsSync(targetVideoPath)) {
    try {
      const fileBuffer = fs.readFileSync(targetVideoPath);
      const fileBlob = new Blob([fileBuffer], { type: 'video/mp4' });
      const formData = new FormData();
      formData.append('chatId', `${cleanPhone}@c.us`);
      formData.append('fileName', 'video.mp4');
      formData.append('caption', safeCaption);
      formData.append('file', fileBlob, 'video.mp4');

      const uploadApiUrl = `https://api.green-api.com/waInstance${instanceId}/sendFileByUpload/${apiToken}`;
      const fileRes = await fetch(uploadApiUrl, {
        method: 'POST',
        body: formData
      });

      if (fileRes.ok) {
        const fileData = await fileRes.json();
        if (fileData && (fileData.idMessage || fileData.id)) {
          return { success: true, mediaType: 'video', urlFile: fileData.urlFile || null };
        }
      } else {
        const errText = await fileRes.text();
        console.warn('sendFileByUpload video returned non-200:', fileRes.status, errText);
      }
    } catch (e) {
      console.warn('Video upload dispatch error, attempting fallback:', e.message);
    }
  }

  // 3. Fallback: sendFileByUrl if public videoUrl provided and accessible
  if (videoUrl && (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) && !videoUrl.includes('localhost') && !videoUrl.includes('127.0.0.1')) {
    try {
      const fileApiUrl = `https://api.green-api.com/waInstance${instanceId}/sendFileByUrl/${apiToken}`;
      const fileRes = await fetch(fileApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: `${cleanPhone}@c.us`,
          urlFile: videoUrl,
          fileName: 'video.mp4',
          caption: safeCaption
        })
      });

      if (fileRes.ok) {
        const fileData = await fileRes.json();
        if (fileData && (fileData.idMessage || fileData.id)) {
          return { success: true, mediaType: 'video', urlFile: videoUrl };
        }
      }
    } catch (e) {
      console.warn('Video sendFileByUrl error:', e.message);
    }
  }

  // 4. Standard text message dispatch (contains the electronic invite link as fallback)
  try {
    const gatewayUrl = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`;
    const apiRes = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: `${cleanPhone}@c.us`,
        message: messageText
      })
    });

    if (apiRes.ok) {
      const resData = await apiRes.json();
      if (resData && (resData.idMessage || resData.id)) {
        return { success: true, mediaType: 'text' };
      }
      errorMsg = 'لم يتم تأكيد استلام الرسالة من البوابة';
    } else {
      const errText = await apiRes.text();
      errorMsg = `خطأ في بوابة الإرسال (${apiRes.status}): ${errText || 'بيانات الاعتماد غير صحيحة'}`;
    }
  } catch (e) {
    errorMsg = e.message;
  }

  return { success: false, error: errorMsg };
}

// Admin PIN Security & Authentication
app.post('/api/admin/verify-pin', async (req, res) => {
  try {
    const { pin } = req.body;
    const isValid = await db.verifyAdminPin(pin);
    if (isValid) {
      res.json({ success: true, message: 'تم التحقق بنجاح' });
    } else {
      res.status(401).json({ success: false, error: 'الرمز السري غير صحيح، يرجى المحاولة مرة أخرى' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/change-pin', async (req, res) => {
  try {
    const { currentPin, newPin } = req.body;
    const isValid = await db.verifyAdminPin(currentPin);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'الرمز السري الحالي غير صحيح' });
    }
    await db.setAdminPin(newPin);
    res.json({ success: true, message: 'تم تغيير الرمز السري بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// WhatsApp Gateway Configuration (Phase 7 Req 1)
app.get('/api/whatsapp/config', async (req, res) => {
  try {
    const config = await db.getWhatsAppConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// WhatsApp Video Attachment Status
app.get('/api/whatsapp/video-status', (req, res) => {
  const targetVideoPath = path.join(__dirname, '../public/video.mp4');
  const exists = fs.existsSync(targetVideoPath);
  let sizeBytes = 0;
  if (exists) {
    try {
      sizeBytes = fs.statSync(targetVideoPath).size;
    } catch {}
  }
  res.json({
    exists,
    filename: 'video.mp4',
    url: '/video.mp4',
    sizeBytes
  });
});

app.post('/api/whatsapp/config', async (req, res) => {
  try {
    const { instanceId, apiToken } = req.body;
    const config = await db.saveWhatsAppConfig({ instanceId, apiToken });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function resolveWhatsAppCredentials(clientInstance, clientToken) {
  let inst = (clientInstance || '').toString().trim();
  let tok = (clientToken || '').toString().trim();
  if (!inst || inst.includes('••••') || !tok || tok.includes('••••')) {
    const serverCfg = await db.getWhatsAppRawConfig();
    if (!inst || inst.includes('••••')) inst = serverCfg.instanceId || '';
    if (!tok || tok.includes('••••')) tok = serverCfg.apiToken || '';
  }
  return { instanceId: inst, apiToken: tok };
}

// 1. Send Test Message To Admin Number (Phase 5 Req 5)
app.post('/api/whatsapp/send-test', sendingRateLimiter, async (req, res) => {
  try {
    let { testPhone, instanceId, apiToken, hostUrl, eventId, customMessage, previewGuestId, dryRun } = req.body;
    if (!testPhone) {
      return res.status(400).json({ error: 'يرجى إدخال رقم الجوال التجريبي' });
    }

    const creds = await resolveWhatsAppCredentials(instanceId, apiToken);
    instanceId = creds.instanceId;
    apiToken = creds.apiToken;

    let event = await db.getEvent(eventId);
    if (!event) {
      const allEvs = await db.getAllEvents();
      event = allEvs[0] || { title: "المناسبة" };
    }

    const allGuests = await db.getGuests(eventId);
    const sampleGuest = previewGuestId 
      ? allGuests.find(g => g.id === previewGuestId) 
      : (allGuests.find(g => !g.parent_guest_id) || { id: 'sample', name: 'ضيف تجريبي', invite_token: 'sample_token' });

    const dependents = allGuests.filter(d => d.parent_guest_id === sampleGuest.id);
    const baseUrl = hostUrl || 'http://localhost:3000';

    const messageText = renderWhatsAppMessage(customMessage, {
      guest: sampleGuest,
      dependents,
      event,
      baseUrl
    });

    const defaultVideoPath = path.join(__dirname, '../public/video.mp4');
    const videoUrl = `${baseUrl}/video.mp4`;

    const sendRes = await sendSingleWhatsAppMessageHelper({
      instanceId,
      apiToken,
      phone: testPhone,
      messageText,
      videoPath: defaultVideoPath,
      videoUrl,
      dryRun
    });

    if (sendRes.success) {
      res.json({ success: true, message: 'تم إرسال الرسالة التجريبية بنجاح!', previewText: messageText });
    } else {
      res.status(400).json({ success: false, error: sendRes.error });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Send Single Message / Retry Failed Guest (Phase 5 Req 5)
app.post('/api/whatsapp/send-single', sendingRateLimiter, async (req, res) => {
  try {
    let { guestId, instanceId, apiToken, hostUrl, eventId, customMessage, dryRun } = req.body;
    const creds = await resolveWhatsAppCredentials(instanceId, apiToken);
    instanceId = creds.instanceId;
    apiToken = creds.apiToken;
    let event = await db.getEvent(eventId);
    if (!event) {
      const allEvs = await db.getAllEvents();
      event = allEvs[0] || { title: "المناسبة" };
    }

    const allGuests = await db.getGuests(eventId);
    const guest = allGuests.find(g => g.id === guestId);
    if (!guest) {
      return res.status(404).json({ error: 'المدعو غير موجود' });
    }

    const dependents = allGuests.filter(d => d.parent_guest_id === guest.id);
    const baseUrl = hostUrl || 'http://localhost:3000';

    const messageText = renderWhatsAppMessage(customMessage, {
      guest,
      dependents,
      event,
      baseUrl
    });

    const defaultVideoPath = path.join(__dirname, '../public/video.mp4');
    const videoUrl = `${baseUrl}/video.mp4`;

    const sendRes = await sendSingleWhatsAppMessageHelper({
      instanceId,
      apiToken,
      phone: guest.phone,
      messageText,
      videoPath: defaultVideoPath,
      videoUrl,
      dryRun
    });

    if (sendRes.success) {
      await db.markGuestsSent(eventId, [guest.id]);
      res.json({ success: true, guestId: guest.id, name: guest.name });
    } else {
      res.status(400).json({ success: false, error: sendRes.error });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Batch Dispatcher with Variables, Random Delay (3-8s), and Re-send Filter (Phase 5 Req 1, 2, 5)
app.post('/api/send-whatsapp-batch', sendingRateLimiter, async (req, res) => {
  try {
    let { instanceId, apiToken, hostUrl, eventId, guestIds, customMessage, allowResend = false, dryRun = false } = req.body;
    const creds = await resolveWhatsAppCredentials(instanceId, apiToken);
    instanceId = creds.instanceId;
    apiToken = creds.apiToken;
    let event = await db.getEvent(eventId);
    if (!event) {
      const allEvs = await db.getAllEvents();
      event = allEvs[0] || { title: "المناسبة" };
    }
    const allGuests = await db.getGuests(eventId);

    // Target ONLY owner guests (dependents don't have phones and don't receive independent messages)
    let targetGuests = allGuests.filter(g => !g.parent_guest_id);
    if (Array.isArray(guestIds) && guestIds.length > 0) {
      const setIds = new Set(guestIds);
      targetGuests = targetGuests.filter(g => setIds.has(g.id));
    }

    // Filter out already sent if allowResend is not explicitly confirmed (Phase 5 Req 5)
    if (!allowResend) {
      targetGuests = targetGuests.filter(g => !g.sent);
    }

    if (!targetGuests || targetGuests.length === 0) {
      return res.status(400).json({ error: 'لا يوجد مدعوين للإرسال إليهم (ربما تم الإرسال للجميع مسبقاً)' });
    }

    if (!dryRun && process.env.NODE_ENV !== 'test' && (!instanceId || !apiToken)) {
      return res.status(400).json({
        success: false,
        requiresGateway: true,
        error: 'يرجى إدخال Instance ID و API Token للربط ببوابة الإرسال الآلي للواتساب (Green-API / UltraMsg)'
      });
    }

    const baseUrl = hostUrl || 'http://localhost:3000';
    let sentCount = 0;
    const results = [];
    const successfullySentIds = [];
    const failedList = [];

    const defaultVideoPath = path.join(__dirname, '../public/video.mp4');
    const videoUrl = `${baseUrl}/video.mp4`;

    let cachedCdnVideoUrl = null;

    for (let i = 0; i < targetGuests.length; i++) {
      const guest = targetGuests[i];
      const dependents = allGuests.filter(d => d.parent_guest_id === guest.id);

      // Render message with dynamic variables support (Phase 5 Req 1 & 2)
      const messageText = renderWhatsAppMessage(customMessage, {
        guest,
        dependents,
        event,
        baseUrl
      });

      const sendRes = await sendSingleWhatsAppMessageHelper({
        instanceId,
        apiToken,
        phone: guest.phone,
        messageText,
        videoPath: defaultVideoPath,
        videoUrl,
        cachedMediaUrl: cachedCdnVideoUrl,
        dryRun
      });

      if (sendRes.success) {
        sentCount++;
        successfullySentIds.push(guest.id);
        results.push({ guestId: guest.id, name: guest.name, phone: guest.phone, success: true });
        // Cache the CDN media url returned by Green-API to send to subsequent guests in ~200ms
        if (sendRes.urlFile && !cachedCdnVideoUrl) {
          cachedCdnVideoUrl = sendRes.urlFile;
        }
      } else {
        const errorReason = sendRes.error || 'تعذر الإرسال للرقم';
        failedList.push({ guestId: guest.id, name: guest.name, phone: guest.phone, errorReason });
        results.push({ guestId: guest.id, name: guest.name, phone: guest.phone, success: false, errorMsg: errorReason });
      }

      // Fast, safe delay between 400ms and 800ms (Green-API recommended for high speed mass delivery)
      if (i < targetGuests.length - 1) {
        const delayMs = dryRun ? 20 : (Math.floor(Math.random() * (800 - 400 + 1)) + 400);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }

    // Persist sent status and sentAt timestamp in DB
    if (successfullySentIds.length > 0) {
      await db.markGuestsSent(eventId, successfullySentIds);
    }

    res.json({
      success: true,
      total: targetGuests.length,
      sentCount,
      failedCount: failedList.length,
      failed: failedList,
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve Static React Frontend Assets
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Multi-Event Invitation Server & WhatsApp API running on port ${PORT}`);
});
