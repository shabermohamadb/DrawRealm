# Audit Report: Missing Features & Requirements for Local skribbl.io

This audit provides a comprehensive breakdown of missing files, assets, JavaScript functionality, API dependencies, WebSocket protocols, browser console errors, broken links, and multiplayer backend requirements.

---

## 1. Missing Files

The local repository was downloaded as a static frontend dump and lacks the following critical files:

- **Root project configuration**:
  - `package.json` / `package-lock.json`: No Node.js configuration or dependency manifests exist.
- **Backend architecture** (`server/` directory is completely absent):
  - `server/server.js`: HTTP + Express server entry point.
  - `server/rooms/`: Room management, room lifecycle, and state storage.
  - `server/game/`: Round timers, word picking, hint generators, guess scoring, and turn loops.
  - `server/players/`: Player session management, permissions, and avatars.
  - `server/utils/`: Word banks for multiple languages, string similarity / close guess detection, and sanitizers.
- **Audio files** (`audio/` directory is completely absent):
  - `audio/roundStart.ogg`
  - `audio/roundEndSuccess.ogg`
  - `audio/roundEndFailure.ogg`
  - `audio/join.ogg`
  - `audio/leave.ogg`
  - `audio/playerGuessed.ogg`
  - `audio/tick.ogg`
- **Missing image assets** (in `img/`):
  - `img/clear.gif`: Clear canvas toolbar button icon.
  - `img/fill.gif`: Flood fill bucket toolbar button icon.
  - `img/undo.gif`: Undo stroke toolbar button icon.
  - `img/fill_cur.png`: Custom cursor when using the flood fill bucket.
  - `img/thumbnail.png`: OpenGraph and Twitter card preview image referenced in `index.html` and `credits.html`.

---

## 2. Missing Assets

### Audio Assets
The client's audio system (`Dn.prototype.loadSounds`) uses the Web Audio API to fetch and decode seven `.ogg` sound effects on startup. Without them, 404/file-not-found errors occur on startup:
1. `roundStart.ogg`: Played at the start of a drawing turn (`Sn = 0`).
2. `roundEndSuccess.ogg`: Played when at least one player guessed the word (`kn = 1`).
3. `roundEndFailure.ogg`: Played when nobody guessed the word (`wn = 2`).
4. `join.ogg`: Played when a player connects to the room (`Cn = 3`).
5. `leave.ogg`: Played when a player disconnects, gets kicked, or banned (`qn = 4`).
6. `playerGuessed.ogg`: Played when someone guesses the word or when adjusting volume (`xn = 5`).
7. `tick.ogg`: Played every second during countdown when time is running out (`Mn = 6`).

### Drawing Toolbar Graphics
The game toolbar (`it(...)` in `js/game.js`) expects 4 tools/actions with specific graphics:
1. `Brush`: Uses `img/pen.gif` (present).
2. `Fill`: Uses `img/fill.gif` (missing) and custom cursor `url(/img/fill_cur.png) 7 38, default` (missing).
3. `Undo`: Uses `img/undo.gif` (missing).
4. `Clear`: Uses `img/clear.gif` (missing).

### External CDN Dependencies & Offline Assets
- `https://skribbl.io/img/snow.gif`: Referenced in `css/style.css` for the winter holiday theme.
- Google Web Fonts: `Inconsolata`, `Nunito`, `Material Icons` loaded from Google Fonts CDN (`fonts.googleapis.com`). While cached by browsers online, local offline operation should gracefully handle or bundle font fallbacks.

---

## 3. Missing JavaScript Functionality

1. **Ad & Tracking Wrappers**:
   - `index.html` includes scripts for `adinplay.com`, `adsbygoogle`, and `googletagmanager`.
   - `game.js` includes a preroll hook `ta(t)` that queries `aiptag.cmd.player`. If ads fail or block, unhandled rejections or connection warnings fire in the console.
   - `addPrivacySettingsButton()` attempts `aipAPItag.showCMPScreen()` which fails on local environments.
2. **Hardcoded Invite URL**:
   - In `game.js` lines 1041 and 1492, invite links are constructed as `https://skribbl.io/?` + room ID. On local setups, this copies a remote URL rather than `http://localhost:3000/?<id>`.
3. **Root-relative Asset Paths**:
   - References like `url(/img/...)` and `/audio/...` assume the application is served at root `/`. Serving via static file loaders or subpaths breaks these references unless handled by an Express static root server.

---

## 4. Missing API / Backend Dependencies

The frontend expects an HTTP backend offering:

1. **Endpoint `POST /api/play`**:
   - Headers: `Content-Type: application/x-www-form-urlencoded`
   - Payloads:
     - Join existing room: `id=<roomId>`
     - Create private room: `lang=<langId>`
     - Quick play / Public match: `lang=<langId>`
   - Expected Response:
     - Status: `200 OK`
     - Body: Plain text string indicating the Socket.IO connection URL (e.g. `http://localhost:3000` or empty string to connect to current host origin).

---

## 5. WebSocket / Multiplayer Dependencies

The frontend bundles Socket.IO Client v4.8.3 (`js/socket.io.js`) and connects over WebSockets/polling. The backend must speak the exact packet specification expected by `js/game.js`:

### Connection & Login Handshake
1. Client connects via Socket.IO.
2. Client emits:
   ```json
   {
     "join": "<roomId>" | 0,
     "create": 1 | 0,
     "name": "Username",
     "lang": 0,
     "code": "optionalPassword",
     "avatar": [color, eyes, mouth, special]
   }
   ```
3. If error occurs, server emits `joinerr` with error code:
   - `1`: Room not found
   - `2`: Room is full
   - `3`: Kick cooldown
   - `4`: Banned
   - `5`: Joining too quickly
   - `100`: Already connected

### Server-to-Client Packets (`S.on("data", { id, data })`)
- **ID 10 (`Ca`) - Room Init**:
  - `me`: local player ID (integer)
  - `type`: room type (`0` = public, `1` = custom)
  - `id`: room ID string
  - `settings`: array of settings `[LANG, SLOTS, DRAWTIME, ROUNDS, WORDCOUNT, HINTCOUNT, WORDMODE, CUSTOMWORDSONLY]`
  - `users`: array of player objects `[{ id, flags, name, avatar, score, guessed }]`
  - `round`: current round index (0-based)
  - `owner`: room owner player ID
  - `state`: current game state object `{ id, time, data }`
- **ID 11 (`qa`) - Game State Transition**:
  - `id`: state code:
    - `0` (`G`): Waiting for players
    - `1` (`K`): Game starting
    - `2` (`F`): Round start (`data`: round index)
    - `3` (`V`): Choosing word (`data.words` for drawer, `data.id` for others)
    - `4` (`j`): Drawing phase (`data.id`, `data.word`, `data.hints`, `data.drawCommands`)
    - `5` (`Z`): Word reveal / Turn end (`data.word`, `data.reason` [0: guessed, 1: timeout, 2: drawer left, 5: skipped], `data.scores`: `[playerId, totalScore, turnDeltaScore, ...]`)
    - `6` (`X`): Game over podium (`data`: `[[playerId, rank, title], ...]`)
    - `7` (`J`): Custom room lobby
  - `time`: seconds remaining on the timer
  - `data`: state payload
- **ID 1 (`ya`) - Player Joined**: `{ id, flags, name, avatar, score, guessed }`
- **ID 2 (`va`) - Player Left**: `{ id, reason }` (`1` = kicked, `2` = banned)
- **ID 12 (`xa`) - Setting Changed**: `{ id: settingKey, val: settingValue }`
- **ID 13 (`Ma`) - Hint Revealed**: `[[characterIndex, character], ...]`
- **ID 14 (`La`) - Clock Tick**: seconds remaining (number)
- **ID 15 (`Da`) - Correct Guess**: `{ id: playerId, word: secretWord }`
- **ID 16 (`$a`) - Close Guess**: `"almostWord"`
- **ID 17 (`Ea`) - Owner Changed**: `newOwnerId`
- **ID 19 (`Ia`) - Stroke Commands Batch**: `[ [0, color, size, x1, y1, x2, y2], ... ]`
- **ID 20 (`Ra`) - Canvas Cleared**: (no data)
- **ID 21 (`Ta`) - Undo Stroke**: `strokeIndex`
- **ID 30 (`Na`) - Chat Message**: `{ id: playerId, msg: message }`
- **ID 31 (`Wa`) - System Notice**: `{ id: 0 (need 2 players) | 100 (server restart), data: ... }`

### Client-to-Server Packets (`S.emit("data", { id, data })`)
- **ID 22**: Start game (data = custom words comma-separated)
- **ID 18 (`Aa`)**: Word selected by drawer (data = word index)
- **ID 19 (`Ia`)**: Drawing strokes batch (emitted every 50ms while drawing)
- **ID 20 (`Ra`)**: Clear canvas
- **ID 21 (`Ta`)**: Undo action
- **ID 30 (`Na`)**: Chat message / guess submission
- **ID 8 (`Sa`)**: Like (`1`) or Dislike (`0`) drawing
- **ID 12 (`xa`)**: Room setting update `{ id, val }`
- **ID 3**: Kick player (owner only)
- **ID 4**: Ban player (owner only)
- **ID 5 (`ba`)**: Votekick player
- **ID 6**: Report player `{ id, reasons }`
- **ID 7**: Mute player

---

## 6. Browser Console Errors

When loading `index.html` statically or without backend:
1. `GET file:///audio/roundStart.ogg net::ERR_FAILED`
2. `GET file:///audio/roundEndSuccess.ogg net::ERR_FAILED`
3. `GET file:///audio/roundEndFailure.ogg net::ERR_FAILED`
4. `GET file:///audio/join.ogg net::ERR_FAILED`
5. `GET file:///audio/leave.ogg net::ERR_FAILED`
6. `GET file:///audio/playerGuessed.ogg net::ERR_FAILED`
7. `GET file:///audio/tick.ogg net::ERR_FAILED`
8. `POST /api/play net::ERR_FAILED / net::ERR_CONNECTION_REFUSED`
9. External ad scripts attempting network calls to `pagead2.googlesyndication.com` and `adinplay.com`.
10. Uncaught promise rejection from ad player preroll when blocked.

---

## 7. Broken Links

- In `index.html`: `mailto:contact@skribbl.io` (opens default mail client).
- In `index.html`: Google ads iframes and ad slots fail to render.
- In `credits.html`: Outbound link to freesound audio.
- Invite link copying copies remote `https://skribbl.io/?...` instead of the local server origin.

---

## 8. Features That Cannot Work From Static Files Alone

A drawing and guessing multiplayer game fundamentally relies on an authoritative server:
1. **Hidden Secret Word**: Guessers must not receive the secret word in plain text before guessing; the server must validate guesses and only emit hints and word lengths.
2. **Real-time Canvas Stroke Synchronization**: Strokes must be broadcast in real-time across socket rooms and buffered so late joiners or reconnecting players receive existing canvas state.
3. **Room Lifecycle & Host Authority**: Dynamic creation of private rooms, room codes, setting adjustments, and host migration if the owner disconnects.
4. **Game Loop Timers & Turn Rotation**: Authoritative server timer for word selection, drawing turns, reveal pauses, round advancements, and score calculations.
5. **Score Allocation**: Authoritative formula awarding points based on guess speed and rewarding the drawer when others guess correctly.
6. **Chat Filter & Guess Masking**: Messages that contain the secret word must be hidden from non-guessing players and converted into "Player guessed the word!" events.
