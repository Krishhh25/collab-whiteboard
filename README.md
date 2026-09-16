# Collab Whiteboard

A real-time collaborative whiteboard where multiple users can draw, create shapes, and edit the same canvas simultaneously, with conflict-free sync, live cursors, multi-user undo/redo, pan/zoom, and authenticated editing.

**Live demo:** https://collab-whiteboard-iota.vercel.app/

*(Note: the backend runs on Render's free tier, so it might take 20–30 seconds to connect on first load if the server has been idle.)*

## Why I Built This

Real-time collaborative tools (Miro, Figma, Google Docs) solve a genuinely hard problem: how do you let multiple people edit the same thing at the same time, from different locations, without their changes overwriting or corrupting each other? I wanted to understand what actually happens inside tools I use every day for group work and remote collaboration.

I built this specifically to learn:

- **How real-time sync actually works**: not just calling an API, but understanding WebSockets, and how a server keeps multiple clients consistent with each other
- **Conflict resolution in distributed systems**: what happens when two people edit the same object at the same instant, and why "last write wins" isn't always good enough. This led me to CRDTs (Conflict-free Replicated Data Types) via Yjs, which solve this problem mathematically rather than through ad-hoc rules
- **The difference between persisted and ephemeral state**: shapes on the board need to be saved permanently, but a live cursor position shouldn't be. Learning Yjs's separate Awareness API for this was a genuinely useful distinction I hadn't thought about before
- **Authentication and access control**: adding Supabase auth meant thinking through a real product question: what should anonymous visitors be able to do versus logged-in users? I settled on "anyone can view, only logged-in users can edit," which is a common pattern in real collaborative tools
- **Real deployment and debugging**: I hit and fixed real issues along the way, including a React version mismatch with react-konva, a breaking change in a package's export paths between versions, port conflicts during local development, getting WebSockets working correctly in production, and a CORS/URL-formatting bug while integrating Supabase

## What Problem This Solves

The core problem: teams need to visually think together even when they're not in the same room, whether that's sprint planning, system design sketches, brainstorming, or tutoring. This project demonstrates the specific hard parts of solving that: conflict-free simultaneous editing, live presence (knowing who else is active), state consistency across disconnects/reconnects, isolated sessions so unrelated groups don't collide, and controlling who can actually make changes.

## Features

- **Shape tools**: add, select, recolor, resize, drag, and delete rectangles
- **Freehand pen tool**: draw strokes that sync live to collaborators point-by-point as you draw, not just after you finish
- **Real-time multiplayer sync**: powered by CRDTs (Yjs), so simultaneous edits from multiple users merge automatically without conflicts or data loss
- **Multi-user undo/redo**: each user's undo only reverts their own actions, never a collaborator's
- **Live cursor presence**: see other connected users' cursors moving on the canvas in real time
- **Pan & zoom**: mouse-wheel zoom (anchored to cursor position) and click-drag panning, with a reset-view control
- **Authentication (Supabase)**: email/password and Google sign-in. Anyone can view a board; only logged-in users can edit it
- **Room isolation**: each board is identified by a `?room=` URL parameter, so different groups can collaborate on separate boards without collision
- **Server-side persistence**: board state is saved (LevelDB) so it survives server restarts
- **Fit-to-screen scaling**: the canvas renders at a fixed logical size and scales proportionally to fit any screen, including mobile

## Tech Stack

**Frontend**
- React (Vite)
- Konva.js / react-konva: canvas rendering, shape manipulation, drag/resize, pan/zoom
- Yjs: CRDT-based shared state
- y-websocket: WebSocket sync client
- Supabase (`@supabase/supabase-js`): authentication (email/password + Google OAuth)

**Backend**
- Node.js
- `ws`: WebSocket server
- y-websocket (server utilities): Yjs document sync over WebSocket
- y-leveldb: persists Yjs documents to disk

**Deployment**
- Frontend: Vercel
- Backend: Render
- Auth/Database: Supabase (free tier)

## Architecture

```
┌─────────────┐         ┌─────────────┐
│  Browser A  │         │  Browser B  │
│  (React +   │         │  (React +   │
│   Konva)    │         │   Konva)    │
└──────┬──────┘         └──────┬──────┘
       │  Y.Doc (shapes)       │  Y.Doc (shapes)
       │  + Awareness (cursor) │  + Awareness (cursor)
       │                       │
       └──────────┬────────────┘
                   │  WebSocket (wss://)
                   ▼
         ┌─────────────────────┐
         │   Node.js server    │
         │   (y-websocket)     │
         │                     │
         │  Merges updates via │
         │  CRDT — no manual   │
         │  conflict logic     │
         └──────────┬──────────┘
                    │
                    ▼
              ┌──────────────┐
              │  LevelDB     │
              │  (disk)      │
              │  persistence │
              └──────────────┘

Auth (separate from the sync path):
┌─────────────┐        ┌──────────────┐
│  Browser    │◄──────►│   Supabase   │
│  (Auth.jsx) │        │  (Auth API)  │
└─────────────┘        └──────────────┘
Session state gates which canvas actions
(add/edit/draw) are enabled in the UI.
```

Each browser holds a local `Y.Doc` — a CRDT-backed shared document. Every shape/stroke edit is applied to a `Y.Map` inside that doc. The `y-websocket` client automatically syncs changes to the server, which merges updates from all connected clients and re-broadcasts them. Because Yjs's CRDT guarantees convergence, two users can edit the same or different shapes at the same time without a central "who wins" conflict resolution step; the library handles merging automatically.

Cursor positions use Yjs's separate **Awareness API**, which is designed for ephemeral, non-persisted state (unlike the shapes themselves, cursor positions aren't saved to disk and disappear when a user disconnects).

Authentication runs as a separate concern from the sync path: Supabase manages sessions independently, and the frontend simply checks "is there an active session?" to decide whether editing controls (Add Rectangle, Pen, color swatches, Undo/Redo, drag/resize) are enabled or disabled. Logged-out visitors can still view and pan/zoom around the board — only mutation actions are gated.

## Running Locally

**1. Clone the repo**
```bash
git clone https://github.com/Krishhh25/collab-whiteboard.git
cd collab-whiteboard
```

**2. Start the backend**
```bash
cd whiteboard-server
npm install
node server.js
```
Server runs on `ws://localhost:1234`.

**3. Set up environment variables for the frontend**

Create a `.env` file in the `collab-whiteboard` folder (same level as `package.json`):
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```
(Get these from your own Supabase project under Settings → API.)

**4. Start the frontend** (in a separate terminal)
```bash
cd collab-whiteboard
npm install
npm run dev
```
Open the printed `localhost` URL in your browser.

**5. Test multiplayer locally**
Open the same URL in two browser tabs (optionally with `?room=test` appended to both) to see live sync between them. Log in on one tab to test edit permissions; leave the other logged out to confirm it's view-only.

## Known Limitations

- **Canvas is a fixed logical size** (1200×800): pan and zoom let you navigate it, but it isn't a truly infinite canvas.
- **Free-tier cold starts**: the backend (Render) and auth/database (Supabase) both spin down after inactivity on their free tiers, causing a delay on the first request after idle time.
- **Session-scoped undo**: undo/redo history resets when you close and reopen the page. This matches the standard behavior of most collaborative editors (Google Docs, Figma behave the same way), but it's worth knowing it isn't a persistent revision history.
- **No per-board access control yet**: any logged-in user can edit any room they know the name of. There's no board ownership or invite-only permission model yet.
- **Basic shape set**: currently supports rectangles and freehand pen strokes; no circles, text, or arrows yet.

## What I'd Add With More Time

- Per-board ownership and access control (only invited users can edit a specific board)
- Additional shape types (circles, text, arrows)
- Persistent, versioned board history (like Google Docs' revision history)
- A true infinite canvas instead of a fixed-size scaled viewport
