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
  DEFAULT_REMINDER_TEMPLATE
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

app.get('/api/guests/:id', async (req, res) => {
  try {
    const result = await db.getGuestByTokenOrId(req.params.id);
    if (!result) return res.status(404).json({ error: 'Guest not found' });
    res.json(result); // returns { guest, dependents, event }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/guests/:id/rsvp', async (req, res) => {
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
async function sendSingleWhatsAppMessageHelper({ instanceId, apiToken, phone, messageText, cardImageUrl, dryRun = false }) {
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

  const cleanPhone = phone.toString().replace(/\D/g, '');
  let errorMsg = null;

  // 1. Send card image with text caption if card image exists
  if (cardImageUrl) {
    try {
      const fileApiUrl = `https://api.green-api.com/waInstance${instanceId}/sendFileByUrl/${apiToken}`;
      const fileRes = await fetch(fileApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: `${cleanPhone}@c.us`,
          urlFile: cardImageUrl,
          fileName: 'invitation_card.png',
          caption: messageText
        })
      });

      if (fileRes.ok) {
        const fileData = await fileRes.json();
        if (fileData && (fileData.idMessage || fileData.id)) {
          return { success: true };
        }
      }
    } catch (e) {
      console.warn('Card image dispatch error, falling back to text:', e.message);
    }
  }

  // 2. Standard text message dispatch
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
        return { success: true };
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

// 1. Send Test Message To Admin Number (Phase 5 Req 5)
app.post('/api/whatsapp/send-test', async (req, res) => {
  try {
    const { testPhone, instanceId, apiToken, hostUrl, eventId, customMessage, previewGuestId, dryRun } = req.body;
    if (!testPhone) {
      return res.status(400).json({ error: 'يرجى إدخال رقم الجوال التجريبي' });
    }

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

    let cardImageUrl = null;
    if (event.cardImage) {
      if (event.cardImage.startsWith('http://') || event.cardImage.startsWith('https://')) {
        cardImageUrl = event.cardImage;
      } else if (!event.cardImage.startsWith('data:image')) {
        cardImageUrl = `${baseUrl}${event.cardImage.startsWith('/') ? '' : '/'}${event.cardImage}`;
      }
    }

    const sendRes = await sendSingleWhatsAppMessageHelper({
      instanceId,
      apiToken,
      phone: testPhone,
      messageText,
      cardImageUrl,
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
app.post('/api/whatsapp/send-single', async (req, res) => {
  try {
    const { guestId, instanceId, apiToken, hostUrl, eventId, customMessage, dryRun } = req.body;
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

    let cardImageUrl = null;
    if (event.cardImage) {
      if (event.cardImage.startsWith('http://') || event.cardImage.startsWith('https://')) {
        cardImageUrl = event.cardImage;
      } else if (!event.cardImage.startsWith('data:image')) {
        cardImageUrl = `${baseUrl}${event.cardImage.startsWith('/') ? '' : '/'}${event.cardImage}`;
      }
    }

    const sendRes = await sendSingleWhatsAppMessageHelper({
      instanceId,
      apiToken,
      phone: guest.phone,
      messageText,
      cardImageUrl,
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
app.post('/api/send-whatsapp-batch', async (req, res) => {
  try {
    const { instanceId, apiToken, hostUrl, eventId, guestIds, customMessage, allowResend = false, dryRun = false } = req.body;
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

    // Image URL resolution
    let cardImageUrl = null;
    if (event.cardImage) {
      if (event.cardImage.startsWith('http://') || event.cardImage.startsWith('https://')) {
        cardImageUrl = event.cardImage;
      } else if (!event.cardImage.startsWith('data:image')) {
        cardImageUrl = `${baseUrl}${event.cardImage.startsWith('/') ? '' : '/'}${event.cardImage}`;
      }
    }

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
        cardImageUrl,
        dryRun
      });

      if (sendRes.success) {
        sentCount++;
        successfullySentIds.push(guest.id);
        results.push({ guestId: guest.id, name: guest.name, phone: guest.phone, success: true });
      } else {
        const errorReason = sendRes.error || 'تعذر الإرسال للرقم';
        failedList.push({ guestId: guest.id, name: guest.name, phone: guest.phone, errorReason });
        results.push({ guestId: guest.id, name: guest.name, phone: guest.phone, success: false, errorMsg: errorReason });
      }

      // Random delay between 3 to 8 seconds to prevent WhatsApp ban (Phase 5 Req 5)
      if (i < targetGuests.length - 1) {
        const delayMs = dryRun ? 20 : (Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000);
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
