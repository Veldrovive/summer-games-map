require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const { initDb, createShareKey, getShareEvents, addShareEvent } = require('./db');

const app = express();

const allowedOriginsStr = process.env.ALLOWED_ORIGINS;
const allowedOrigins = allowedOriginsStr ? allowedOriginsStr.split(',').map(s => s.trim()) : ['*'];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

app.use(cors(corsOptions));
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({
  server,
  verifyClient: (info, cb) => {
    if (allowedOrigins.includes('*')) {
      cb(true);
    } else {
      const origin = info.origin;
      // Allow if no origin (e.g. server-to-server) or origin matches
      if (!origin || allowedOrigins.includes(origin)) {
        cb(true);
      } else {
        cb(false, 401, 'Unauthorized');
      }
    }
  }
});

// Map of shareKey -> Set of WebSocket clients
const channels = new Map();

wss.on('connection', (ws) => {
  let currentChannel = null;

  const broadcastUsers = (shareKey) => {
    const channelClients = channels.get(shareKey);
    if (!channelClients) return;
    const users = Array.from(channelClients).map(client => client.nickname).filter(Boolean);
    const msg = JSON.stringify({ type: 'users', users });
    for (const client of channelClients) {
      if (client.readyState === 1) {
        client.send(msg);
      }
    }
  };

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'join') {
        const { shareKey, nickname } = data;
        if (!shareKey) return;
        
        currentChannel = shareKey;
        ws.nickname = nickname || 'Anonymous';

        if (!channels.has(shareKey)) {
          channels.set(shareKey, new Set());
        }
        channels.get(shareKey).add(ws);
        
        // Ensure share key exists in DB
        await createShareKey(shareKey);
        
        // Send all past events to the new client
        const events = await getShareEvents(shareKey);
        ws.send(JSON.stringify({ type: 'sync', events }));

        // Broadcast updated user list
        broadcastUsers(shareKey);
      } else if (data.type === 'update_nickname') {
        if (!currentChannel) return;
        ws.nickname = data.nickname || 'Anonymous';
        broadcastUsers(currentChannel);
      } else if (data.type === 'update') {
        if (!currentChannel) return;
        const { event } = data; // event should have { type: 'status'|'metadata', id, status?, metadata?, updated_at }
        
        // Save to DB
        await addShareEvent(currentChannel, event, ws.nickname);
        
        // Broadcast to others in the channel
        const channelClients = channels.get(currentChannel);
        if (channelClients) {
          const msg = JSON.stringify({ type: 'update', nickname: ws.nickname, event });
          for (const client of channelClients) {
            if (client !== ws && client.readyState === 1 /* OPEN */) {
              client.send(msg);
            }
          }
        }
      }
    } catch (e) {
      console.error('WS message error:', e);
    }
  });

  ws.on('close', () => {
    if (currentChannel && channels.has(currentChannel)) {
      channels.get(currentChannel).delete(ws);
      if (channels.get(currentChannel).size === 0) {
        channels.delete(currentChannel);
      } else {
        broadcastUsers(currentChannel);
      }
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Optional: REST endpoint to create a share key (clients can just generate one and join via WS, but this is explicit)
app.post('/api/shares', async (req, res) => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  await createShareKey(code);
  res.json({ code });
});

const PORT = process.env.PORT || 3001;

initDb().then(() => {
  server.listen(PORT, () => {
    console.log(`Sync Server running on port ${PORT}`);
  });
}).catch(e => {
  console.error('Failed to initialize database', e);
  process.exit(1);
});
