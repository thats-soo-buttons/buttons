# Cloudflare Pages Setup

## What deploys where

- Static site: the files in this folder
- Live status API: `functions/api/twitch-status.js`
- Secrets: set in Cloudflare Pages project settings, not in git

## Create the Pages project

1. Push this repo to GitHub.
2. In Cloudflare, go to `Workers & Pages`.
3. Create a new `Pages` project.
4. Connect the GitHub repository that contains this `buttons` folder.

## Build settings

If Cloudflare asks for a framework preset, use `None`.

Use these values:

- Build command: leave blank
- Build output directory: `.`
- Root directory: `buttons` if the repo contains multiple folders, otherwise leave blank

## Environment variables / secrets

In the Pages project, add this production secret:

- `TWITCH_CLIENT_SECRET`

These regular variables already belong in `wrangler.toml` under `[vars]`:

- `TWITCH_CLIENT_ID`
- `TWITCH_CHANNEL`

Suggested value for `TWITCH_CHANNEL`:

- `thats_soo_buttons`

## Important

Do not put the Twitch client secret in frontend code.
Do not commit `.env`.
If the secret has already been pasted into chat or exposed elsewhere, rotate it in Twitch Developer Console before production.

## Twitch embed parent domain

The site uses the current hostname for the Twitch embed `parent` value.
That works on Cloudflare Pages as long as you open the final deployed domain.

If you later move to a custom domain, test the embed there too.

## What to test after deploy

1. Open the deployed homepage.
2. Confirm the Twitch player renders.
3. Open `/api/twitch-status` on the deployed domain.
4. Confirm it returns JSON.
5. Verify the page switches to live mode when the channel is live.

## Optional local workflow

The local Node server still works for testing outside Cloudflare:

```powershell
node server.js
```
