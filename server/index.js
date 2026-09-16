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

// API ROUTES
app.get('/api/event', async (req, res) => {
  try {
    const data = await db.getEvent();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/event', async (req, res) => {
  try {
    const updated = await db.updateEvent(req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/guests', async (req, res) => {
  try {
    const guests = await db.getGuests();
    res.json(guests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/guests/batch', async (req, res) => {
  try {
    const { guests } = req.body;
    const result = await db.addGuests(guests || []);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/guests', async (req, res) => {
  try {
    const result = await db.clearGuests();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/guests/:id', async (req, res) => {
  try {
    await db.deleteGuest(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/guests/:id', async (req, res) => {
  try {
    const guest = await db.getGuestById(req.params.id);
    if (!guest) return res.status(404).json({ error: 'Guest not found' });
    res.json(guest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/guests/:id/rsvp', async (req, res) => {
  try {
    const { status, companions } = req.body;
    const updated = await db.updateGuestRSVP(req.params.id, status, companions);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AUTOMATED WHATSAPP BATCH DISPATCHER ENDPOINT
app.post('/api/send-whatsapp-batch', async (req, res) => {
  try {
    const { instanceId, apiToken, hostUrl } = req.body;
    const guests = await db.getGuests();
    const event = await db.getEvent();

    if (!guests || guests.length === 0) {
      return res.status(400).json({ error: 'لا يوجد مدعوين للإرسال في قاعدة البيانات' });
    }

    const baseUrl = hostUrl || 'http://localhost:3000';
    let sentCount = 0;
    const results = [];

    for (const guest of guests) {
      const guestLink = `${baseUrl}/?guest=${guest.id}`;
      const messageText = `مرحباً ${guest.name} ✨\nيسرنا ويسعدنا دعوتكم لحضور ${event.title}.\nيرجى تأكيد حضورك واستلام تذكرتك الإلكترونية عبر الرابط التالي:\n${guestLink}`;
      
      let success = true;
      let errorMsg = null;

      // If GreenAPI/UltraMsg API credentials are provided, send HTTP POST to gateway API
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
      
      // Delay 1 second per message for safety against spam filters
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
  console.log(`🚀 Apple Event Server & Automated WhatsApp API running on port ${PORT}`);
});
