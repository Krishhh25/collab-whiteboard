# Collab Whiteboard

A real time collaborative board where multiple users can draw, create shapes, and edit the same canvas simultaneously with conflict-free sync, live cursors, and multi-user undo/redo.

**Live demo:** https://collab-whiteboard-iota.vercel.app/

*(Note: the backend runs on Render's free tier, so it might take 20-30 seconds to connect to the server)*

## Features

- **Shape tools**: add, select, recolor, resize, drag, and delete rectangles
- **Freehand pen tool**: draw strokes that sync live to collaborators point by point as you draw, not just after you finish
- **Real-time multiplayer sync**: powered by CRDTs (Yjs), so simultaneous edits from multiple users merge automatically without conflicts or data loss
- **Multi-user undo/redo**: each user's undo only reverts their own actions, never a collaborator's
- **Live cursor presence**: see other connected users' cursors moving on the canvas in real time
- **Room isolation**: each board is identified by a `?room=` URL parameter, so different groups can collaborate on separate boards without collision
- **Server-side persistence**: board state is saved (LevelDB) so it survives server restarts
- **Fit-to-screen scaling**: the canvas renders at a fixed logical size and scales proportionally to fit any screen, including mobile

## Tech Stack

**Frontend**
- React (Vite)
- Konva.js / react-konva - canvas rendering, shape manipulation, drag/resize
- Yjs CRDT-based shared state
- y-websocket - WebSocket sync client

**Backend**
- Node.js
- `ws` - WebSocket server
- y-websocket (server utilities) - Yjs document sync over WebSocket
- y-leveldb - persists Yjs documents to disk

**Deployment**
- Frontend: Vercel
- Backend: Render

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
              ┌─────────────┐
              │  LevelDB    │
              │  (disk)     │
              │  persistence│
              └─────────────┘
```

Each browser holds a local `Y.Doc` — a CRDT-backed shared document. Every shape/stroke edit is applied to a `Y.Map` inside that doc. The `y-websocket` client automatically syncs changes to the server, which merges updates from all connected clients and re-broadcasts them. Because Yjs's CRDT guarantees convergence, two users can edit the same or different shapes at the same time without a central "who wins" conflict resolution step — the library handles merging automatically.

Cursor positions use Yjs's separate **Awareness API**, which is designed for ephemeral, non-persisted state (unlike the shapes themselves, cursor positions aren't saved to disk and disappear when a user disconnects).

## Known Limitations
- **No pan/zoom**: the canvas is a fixed logical size (1200×800) that scales to fit the screen — there's no infinite canvas or zoom-in/zoom-out yet. On small screens, shapes render smaller and can be harder to tap precisely.
- **cold starts**: the backend (Render free tier) causes delay soemtimes.

## What I'd Add With More Time

- Pan and zoom for a true infinite canvas
- Authentication and per-board access control
