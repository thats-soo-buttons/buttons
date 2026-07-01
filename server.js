const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');

const rootDir = __dirname;
const envPath = path.join(rootDir, '.env');
loadEnv(envPath);

const PORT = Number(process.env.PORT || 3000);
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';
const TWITCH_CHANNEL = process.env.TWITCH_CHANNEL || 'thats_soo_buttons';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mov': 'video/quicktime',
  '.svg': 'image/svg+xml'
};

let cachedToken = null;
let cachedTokenExpiresAt = 0;

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (requestUrl.pathname === '/api/twitch-status') {
      const payload = await getTwitchStatus();
      sendJson(res, 200, payload);
      return;
    }

    serveStatic(requestUrl.pathname, res);
  } catch (error) {
    sendJson(res, 500, { error: 'Server error', detail: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Buttons stream hub running at http://localhost:${PORT}`);
});

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function serveStatic(requestPath, res) {
  const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
  const filePath = path.normalize(path.join(rootDir, normalizedPath));
  if (!filePath.startsWith(rootDir)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = contentTypes[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

async function getTwitchStatus() {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    return {
      ok: false,
      live: false,
      channel: TWITCH_CHANNEL,
      reason: 'Missing Twitch credentials in .env',
      fallback: true
    };
  }

  const accessToken = await getAppAccessToken();
  const endpoint = `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(TWITCH_CHANNEL)}`;
  const response = await fetch(endpoint, {
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const detail = await safeReadText(response);
    return {
      ok: false,
      live: false,
      channel: TWITCH_CHANNEL,
      reason: 'Twitch stream status request failed',
      detail,
      fallback: true
    };
  }

  const data = await response.json();
  const stream = Array.isArray(data.data) ? data.data[0] : null;

  if (!stream) {
    return {
      ok: true,
      live: false,
      channel: TWITCH_CHANNEL,
      fallback: true,
      message: 'Channel is currently offline.'
    };
  }

  return {
    ok: true,
    live: true,
    fallback: false,
    channel: TWITCH_CHANNEL,
    title: stream.title,
    game: stream.game_name,
    viewerCount: stream.viewer_count,
    startedAt: stream.started_at,
    thumbnailUrl: stream.thumbnail_url
  };
}

async function getAppAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedTokenExpiresAt > now + 60_000) {
    return cachedToken;
  }

  const body = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials'
  });

  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Twitch app access token');
  }

  const data = await response.json();
  cachedToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + ((data.expires_in || 0) * 1000);
  return cachedToken;
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
