import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from './db.js';

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
    const guests = await db.getGuests(eventId);
    res.json(guests);
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
    await db.deleteGuest(eventId, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/guests/:id', async (req, res) => {
  try {
    const result = await db.getGuestById(req.params.id);
    if (!result) return res.status(404).json({ error: 'Guest not found' });
    res.json(result); // returns { guest, event }
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
    res.status(500).json({ error: err.message });
  }
});

// AUTOMATED WHATSAPP BATCH DISPATCHER ENDPOINT
app.post('/api/send-whatsapp-batch', async (req, res) => {
  try {
    const { instanceId, apiToken, hostUrl, eventId, guestIds, customMessage } = req.body;
    let event = await db.getEvent(eventId);
    if (!event) {
      const allEvs = await db.getAllEvents();
      event = allEvs[0] || { title: "المناسبة" };
    }
    let allGuests = await db.getGuests(eventId);

    let targetGuests = allGuests;
    if (Array.isArray(guestIds) && guestIds.length > 0) {
      const setIds = new Set(guestIds);
      targetGuests = allGuests.filter(g => setIds.has(g.id));
    }

    if (!targetGuests || targetGuests.length === 0) {
      return res.status(400).json({ error: 'لا يوجد مدعوين محددين للإرسال' });
    }

    if (!instanceId || !apiToken) {
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

    // Image URL resolution
    let cardImageUrl = null;
    if (event.cardImage) {
      if (event.cardImage.startsWith('http://') || event.cardImage.startsWith('https://')) {
        cardImageUrl = event.cardImage;
      } else if (!event.cardImage.startsWith('data:image')) {
        cardImageUrl = `${baseUrl}${event.cardImage.startsWith('/') ? '' : '/'}${event.cardImage}`;
      }
    }

    const userMessage = (customMessage && customMessage.trim()) ? customMessage.trim() : 'يسرنا ويسعدنا دعوتكم لحضور حفلنا وتكتمل فرحتنا بمشاركتكم.';

    for (const guest of targetGuests) {
      const guestLink = `${baseUrl}/?guest=${guest.id}`;
      const messageText = `مرحباً ${guest.name}\n\n${userMessage}\n\nالمناسبة: ${event.title}\nالتاريخ: ${event.date || ''}\nالمكان: ${event.location || ''}\n\nيرجى تأكيد حضورك واستلام تذكرتك الإلكترونية عبر الرابط التالي:\n${guestLink}`;
      
      let success = false;
      let errorMsg = null;

      // 1. Send card image with text caption if card image URL exists
      if (cardImageUrl) {
        try {
          const fileApiUrl = `https://api.green-api.com/waInstance${instanceId}/sendFileByUrl/${apiToken}`;
          const fileRes = await fetch(fileApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: `${guest.phone}@c.us`,
              urlFile: cardImageUrl,
              fileName: 'invitation_card.png',
              caption: messageText
            })
          });

          if (fileRes.ok) {
            const fileData = await fileRes.json();
            if (fileData && (fileData.idMessage || fileData.id)) {
              success = true;
            }
          }
        } catch (fileErr) {
          console.error('File send error, falling back to text:', fileErr.message);
        }
      }

      // 2. Fallback to standard text message if image send didn't succeed or cardImage wasn't remote URL
      if (!success) {
        try {
          const gatewayUrl = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`;
          const apiRes = await fetch(gatewayUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: `${guest.phone}@c.us`,
              message: messageText
            })
          });

          if (apiRes.ok) {
            const resData = await apiRes.json();
            if (resData && (resData.idMessage || resData.id)) {
              success = true;
            } else {
              errorMsg = 'لم يتم تأكيد استلام الرسالة من البوابة';
            }
          } else {
            const errText = await apiRes.text();
            errorMsg = `خطأ في بوابة الإرسال (${apiRes.status}): ${errText || 'بيانات الاعتماد غير صحيحة'}`;
          }
        } catch (e) {
          errorMsg = e.message;
        }
      }

      if (success) {
        sentCount++;
        successfullySentIds.push(guest.id);
      }
      results.push({ guestId: guest.id, name: guest.name, phone: guest.phone, success, errorMsg });
      
      await new Promise(r => setTimeout(r, 800));
    }

    // Mark sent status in DB
    await db.markGuestsSent(eventId, successfullySentIds);

    res.json({
      success: true,
      total: targetGuests.length,
      sentCount,
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
