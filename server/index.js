import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

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
    const created = await db.createEvent(req.body);
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
    const updated = await db.updateEvent(eventId, req.body);
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
    const { instanceId, apiToken, hostUrl, eventId } = req.body;
    const event = await db.getEvent(eventId);
    const guests = await db.getGuests(eventId);

    if (!guests || guests.length === 0) {
      return res.status(400).json({ error: 'لا يوجد مدعوين للإرسال في هذا الملف' });
    }

    const baseUrl = hostUrl || 'http://localhost:3000';
    let sentCount = 0;
    const results = [];

    for (const guest of guests) {
      const guestLink = `${baseUrl}/?guest=${guest.id}`;
      const messageText = `مرحباً ${guest.name} ✨\nيسرنا ويسعدنا دعوتكم لحضور ${event.title}.\nيرجى تأكيد حضورك واستلام تذكرتك الإلكترونية عبر الرابط التالي:\n${guestLink}`;
      
      let success = true;
      let errorMsg = null;

      if (instanceId && apiToken) {
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
          if (!apiRes.ok) {
            success = false;
            errorMsg = 'Gateway response error';
          }
        } catch (e) {
          success = false;
          errorMsg = e.message;
        }
      }

      if (success) sentCount++;
      results.push({ guestId: guest.id, name: guest.name, phone: guest.phone, success, errorMsg });
      
      await new Promise(r => setTimeout(r, 1000));
    }

    res.json({
      success: true,
      total: guests.length,
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
  console.log(`🚀 Multi-Event Invitation Server & WhatsApp API running on port ${PORT}`);
});
