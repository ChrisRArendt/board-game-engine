# Board Game Engine (SvelteKit)

Virtual tabletop for the **Battlestar Galactica** board data (`static/data/bsg_1/`): pan/zoom, draggable pieces from JSON, multiplayer sync over **Socket.IO** (wired into the Vite dev server), dice roller, connection/settings windows, and user stash regions.

## Scripts

```bash
npm install
npm run dev      # http://localhost:5173 — Socket.IO on the same origin
npm run build
npm run preview
npm run check
```

## Multiplayer

Open **Connection**, choose a username, and **Connect**. The relay runs on the same host/port as the app in development, so no separate `:10000` server is required.

## Legacy code

The original jQuery clients (`bge/`, `bge_beta/`) and standalone Node relay (`bge_server/`) were removed in favor of this app; they remain in git history.
