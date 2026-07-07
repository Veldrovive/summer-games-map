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
    const users = Array.from(new Set(Array.from(channelClients).map(client => client.nickname).filter(Boolean)));
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
      } else if (data.type === 'auto_submit_validate') {
        try {
          const { cookieName, cookieValue } = data;
          const res = await fetch('https://aadl.org/summergame/player/0/gamecode', {
            headers: {
              'Cookie': `${cookieName}=${cookieValue}`
            }
          });
          const html = await res.text();
          
          if (html.includes('{"command":"message","message":"You must be logged in')) {
            ws.send(JSON.stringify({ type: 'auto_submit_validate_result', success: false, error: 'You must be logged in' }));
            return;
          }

          // Parse playerId
          const actionMatch = html.match(/action="\/summergame\/player\/(\d+)\/gamecode"/);
          if (!actionMatch) {
            ws.send(JSON.stringify({ type: 'auto_submit_validate_result', success: false, error: 'Could not find player ID on page.' }));
            return;
          }
          const playerId = actionMatch[1];
          ws.send(JSON.stringify({ type: 'auto_submit_validate_result', success: true, playerId }));
        } catch (e) {
          ws.send(JSON.stringify({ type: 'auto_submit_validate_result', success: false, error: e.message }));
        }
      } else if (data.type === 'auto_submit_start') {
        const { cookieName, cookieValue, codes, playerId } = data;
        ws.autoSubmitCancel = false;

        try {
          // Get the initial form tokens
          const initRes = await fetch(`https://aadl.org/summergame/player/${playerId}/gamecode`, {
            headers: { 'Cookie': `${cookieName}=${cookieValue}` }
          });
          let html = await initRes.text();

          let pointsGained = 0;
          let successful = 0;

          for (let i = 0; i < codes.length; i++) {
            if (ws.autoSubmitCancel) {
              ws.send(JSON.stringify({ type: 'auto_submit_complete', reason: 'cancelled' }));
              break;
            }

            const codeItem = codes[i];
            
            const formBuildIdMatch = html.match(/name="form_build_id" value="([^"]+)"/);
            const formTokenMatch = html.match(/name="form_token" value="([^"]+)"/);

            if (!formBuildIdMatch || !formTokenMatch) {
              ws.send(JSON.stringify({ 
                type: 'auto_submit_progress', 
                id: codeItem.id, 
                code: codeItem.code, 
                result: 'error', 
                message: 'Failed to extract form tokens from page.' 
              }));
              continue;
            }

            const formBuildId = formBuildIdMatch[1];
            const formToken = formTokenMatch[1];

            const formData = new FormData();
            formData.append('code_text', codeItem.code);
            formData.append('op', 'Submit');
            formData.append('form_id', 'summergame_player_redeem_form');
            formData.append('form_build_id', formBuildId);
            formData.append('form_token', formToken);

            const postRes = await fetch(`https://aadl.org/summergame/player/${playerId}/gamecode`, {
              method: 'POST',
              headers: {
                'Cookie': `${cookieName}=${cookieValue}`
              },
              body: formData
            });

            html = await postRes.text();

            // Check response message
            let result = 'error';
            let messageStr = '';
            let points = 0;

            const msgMatch = html.match(/{"command":"message","message":"(.*?)"/);
            if (msgMatch) {
              // Decode unicode escapes like \u0022 -> "
              messageStr = msgMatch[1].replace(/\\u([\dA-Fa-f]{4})/gi, (match, grp) => {
                return String.fromCharCode(parseInt(grp, 16));
              });

              if (messageStr.includes('Code is not recognized')) {
                result = 'not_found';
              } else if (messageStr.includes('already redeemed') || messageStr.includes('was already redeemed')) {
                result = 'already_redeemed';
                successful++;
              } else if (messageStr.includes('redeemed code')) {
                result = 'success';
                successful++;
                const ptsMatch = messageStr.match(/for (\d+) SummerGame/);
                if (ptsMatch) {
                  points = parseInt(ptsMatch[1], 10);
                  pointsGained += points;
                }
              }
            } else {
              messageStr = 'Unknown response from server';
            }

            ws.send(JSON.stringify({
              type: 'auto_submit_progress',
              id: codeItem.id,
              code: codeItem.code,
              result,
              message: messageStr,
              points
            }));

            // Delay for good form (750ms)
            if (i < codes.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 750));
            }
          }

          if (!ws.autoSubmitCancel) {
            ws.send(JSON.stringify({ type: 'auto_submit_complete', reason: 'finished', successful, pointsGained }));
          }

        } catch (e) {
          ws.send(JSON.stringify({ type: 'auto_submit_complete', reason: 'error', error: e.message }));
        }
      } else if (data.type === 'stop_auto_submit') {
        ws.autoSubmitCancel = true;
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
