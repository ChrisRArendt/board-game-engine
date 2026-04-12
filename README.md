# Board Game Engine (SvelteKit)

Virtual tabletop for **Battlestar Galactica** board data (`static/data/bsg_1/`): pan/zoom, draggable pieces from JSON, **Supabase Auth** (Google / GitHub / Discord + email magic link), **friends & lobbies** in Postgres, and **multiplayer sync over Supabase Realtime** (broadcast + presence). Deployed with **`@sveltejs/adapter-vercel`**.

## Setup

1. Create a [Supabase](https://supabase.com) project.
2. In **SQL Editor**, run migrations under [`supabase/migrations/`](supabase/migrations/) in order (at least `001_initial_schema.sql` through `011_friend_voice_settings.sql`), or use the Supabase CLI (`supabase db push`).
3. **Authentication → Providers**: enable Google, GitHub, Discord, and/or Email as needed.
4. **Authentication → URL configuration**: add your site URL and redirect `https://<your-domain>/auth/callback` (for local dev: `http://localhost:27482/auth/callback`).
5. Copy [`.env.example`](.env.example) to `.env` and set `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` from **Project Settings → API**.
6. **Voice (optional):** for WebRTC through strict NATs / worldwide, set `PUBLIC_TURN_URL`, `PUBLIC_TURN_USERNAME`, and `PUBLIC_TURN_CREDENTIAL` (e.g. [Metered.ca](https://www.metered.ca/tools/openrelay/) free tier). Leave empty to use STUN only.

## Scripts

```bash
npm install
npm run dev      # http://localhost:27482
npm run build
npm run preview
npm run check
```

## Flow

- `/` redirects to `/login` or `/lobby`.
- **Lobby** (`/lobby`): friends (search, requests), create/join lobbies, invite codes.
- **Waiting room** (`/lobby/[id]`): host starts the game → clients go to `/play/[lobbyId]`.
- **Play** (`/play/[lobbyId]`): tabletop; Realtime channel `game:{lobbyId}` syncs moves, dice, etc.
- **Voice chat:** WebRTC mesh on Realtime channel `voice:{lobbyId}` (separate from lobby/game). Join from the waiting room or in-game; persists across lobby → play navigation. Per-player volume/mute is stored in `friend_voice_settings` for signed-in users.

## Legacy

The original jQuery clients (`bge/`, `bge_beta/`) and standalone Node relay (`bge_server/`) were removed in favor of this app; they remain in git history.
