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

// Serve Static React Frontend Production Build
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Apple Event Server & API running on port ${PORT}`);
});
