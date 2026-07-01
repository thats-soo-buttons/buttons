const TWITCH_CHANNEL = 'thats_soo_buttons';

let cachedToken = null;
let cachedTokenExpiresAt = 0;

export async function onRequestGet(context) {
  try {
    const clientId = context.env.TWITCH_CLIENT_ID || '';
    const clientSecret = context.env.TWITCH_CLIENT_SECRET || '';
    const channel = context.env.TWITCH_CHANNEL || TWITCH_CHANNEL;

    if (!clientId || !clientSecret) {
      return json({
        ok: false,
        live: false,
        channel,
        reason: 'Missing Twitch credentials in Cloudflare environment variables.',
        fallback: true,
      });
    }

    const accessToken = await getAppAccessToken(clientId, clientSecret);
    const response = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`,
      {
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const detail = await safeReadText(response);
      return json({
        ok: false,
        live: false,
        channel,
        reason: 'Twitch stream status request failed.',
        detail,
        fallback: true,
      });
    }

    const data = await response.json();
    const stream = Array.isArray(data.data) ? data.data[0] : null;

    if (!stream) {
      return json({
        ok: true,
        live: false,
        channel,
        fallback: true,
        message: 'Channel is currently offline.',
      });
    }

    return json({
      ok: true,
      live: true,
      fallback: false,
      channel,
      title: stream.title,
      game: stream.game_name,
      viewerCount: stream.viewer_count,
      startedAt: stream.started_at,
      thumbnailUrl: stream.thumbnail_url,
    });
  } catch (error) {
    return json({
      ok: false,
      live: false,
      channel: TWITCH_CHANNEL,
      reason: 'Cloudflare function error.',
      detail: error instanceof Error ? error.message : String(error),
      fallback: true,
    }, 500);
  }
}

async function getAppAccessToken(clientId, clientSecret) {
  const now = Date.now();
  if (cachedToken && cachedTokenExpiresAt > now + 60_000) {
    return cachedToken;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });

  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Twitch app access token.');
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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
