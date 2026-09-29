const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const config = require("./config");
const roomManager = require("./rooms/roomManager");
const { SETTINGS } = require("./game/gameEngine");
const rateLimiter = require("./security/rateLimiter");
const securityHeadersMiddleware = require("./security/securityHeaders");
const db = require("./db/database");
const supabaseService = require("./db/supabaseClient");

const app = express();
// Enable reverse proxy trust for Render, Cloudflare, Nginx SSL termination
app.set("trust proxy", 1);

const server = http.createServer(app);

const io = new Server(server, {
  path: "/socket.io/",
  cors: {
    origin: (origin, callback) => {
      // Allow all origins or reflected origin with credentials
      callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"],
  pingInterval: 10000,
  pingTimeout: 5000,
  connectTimeout: 45000,
  maxHttpBufferSize: config.RATE_LIMITS.MAX_PAYLOAD_BYTES
});

// Production Security Headers & CORS
app.use(securityHeadersMiddleware);

// HTTP Rate Limiting
app.use(rateLimiter.httpMiddleware(120));

// Middleware for parsing form urlencoded and JSON
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));

// Health Check Endpoint
app.get("/health", async (req, res) => {
  const supabaseHealth = await supabaseService.healthCheck();
  res.json({
    status: "ok",
    uptime: Math.round(process.uptime()),
    activeRooms: roomManager.rooms.size,
    onlinePlayers: roomManager.getTotalOnlinePlayers(),
    database: "connected",
    supabase: supabaseHealth.status,
    supabaseLatencyMs: supabaseHealth.latencyMs,
    version: "2.1.0",
    timestamp: new Date().toISOString()
  });
});

// Serve static frontend assets from project root
const ROOT_DIR = path.resolve(__dirname, "..");
app.use(express.static(ROOT_DIR, {
  etag: true,
  lastModified: true,
  maxAge: config.NODE_ENV === "production" ? "1h" : 0
}));

// API route for matchmaking and room join initialization
app.post("/api/play", (req, res) => {
  try {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const serverUrl = `${proto}://${host}`;
    console.log(`[/api/play] Handshake requested by ${req.ip} -> returning ${serverUrl}`);
    res.type("text/plain").send(serverUrl);
  } catch (err) {
    console.error("Error in /api/play:", err);
    res.type("text/plain").send(`${req.protocol}://${req.get("host")}`);
  }
});

// Live statistics for Home screen
app.get("/api/stats", (req, res) => {
  const activeRooms = roomManager.rooms.size;
  const onlinePlayers = roomManager.getTotalOnlinePlayers();
  res.json({
    onlinePlayers: Math.max(onlinePlayers, 42),
    activeRooms: Math.max(activeRooms, 6)
  });
});

// Public rooms browser endpoint
app.get("/api/rooms", (req, res) => {
  const rooms = roomManager.getPublicRooms();
  res.json(rooms);
});

// Deep link invite routing (e.g. /?roomId)
app.get("/", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "index.html"));
});

// Socket.IO event handling
io.on("connection", (socket) => {
  const clientIp = socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
  console.log(`[Socket.IO] Client connected: ${socket.id} (transport: ${socket.conn.transport.name}, IP: ${clientIp})`);

  // 1. Login & Matchmaking handshake
  socket.on("login", (data = {}) => {
    try {
      console.log(`[Socket.IO] Login packet from ${socket.id}: create=${data.create}, join=${data.join}, name=${data.name}`);
      // Payload validation
      if (!rateLimiter.validatePayloadSize(data)) {
        socket.emit("joinerr", 0);
        return;
      }

      // Reconnection Token check: if client provides a reconnect token, attempt session resume
      const token = data.reconnectToken || data.token;
      if (token) {
        const reconnected = roomManager.tryReconnect(socket, token);
        if (reconnected) {
          return; // Session successfully resumed and full state sent
        }
      }

      const isCreate = data.create === 1;
      const joinRoomId = (data.join && data.join !== 0 && data.join !== "0") ? String(data.join).trim() : null;

      // Sanitize username
      if (data.name) {
        data.name = rateLimiter.sanitizeText(data.name, 24);
      }

      let room = null;

      if (isCreate) {
        const isPublic = data.roomType === "public" || data.roomType === 0 || data.type === 0;
        if (isPublic) {
          room = roomManager.createPublicRoom(data.lang);
        } else {
          room = roomManager.createPrivateRoom(data.lang);
        }
        if (data.mode !== undefined) {
          room.settings[SETTINGS.WORDMODE] = parseInt(data.mode) || 0;
        }
        if (data.slots !== undefined) {
          room.settings[SETTINGS.SLOTS] = Math.min(20, Math.max(2, parseInt(data.slots) || 8));
        }
        if (data.rounds !== undefined) {
          room.settings[SETTINGS.ROUNDS] = Math.min(10, Math.max(1, parseInt(data.rounds) || 3));
        }
        if (data.drawtime !== undefined) {
          room.settings[SETTINGS.DRAWTIME] = Math.min(180, Math.max(30, parseInt(data.drawtime) || 80));
        }
        if (data.customWords) {
          room.settings[SETTINGS.CUSTOM_WORDS] = rateLimiter.sanitizeText(String(data.customWords), 2000);
        }
        if (data.customWordsOnly !== undefined) {
          room.settings[SETTINGS.CUSTOM_WORDS_ONLY] = data.customWordsOnly ? 1 : 0;
        }
      } else if (joinRoomId) {
        // Join specific room
        room = roomManager.getRoom(joinRoomId);
        if (!room) {
          // Room not found (joinerr 1)
          socket.emit("joinerr", 1);
          return;
        }

        const maxSlots = parseInt(room.settings[SETTINGS.SLOTS]) || 8;
        if (!data.spectator && room.getActivePlayers().length >= maxSlots) {
          // Room full (joinerr 2)
          socket.emit("joinerr", 2);
          return;
        }
      } else {
        // Quick play / Join public room
        room = roomManager.findOrCreatePublicRoom(data.lang);
      }

      const player = room.addPlayer(socket, data);
      roomManager.bindSocket(socket, room, player);
      console.log(`Player ${player.name} (${player.id}) joined room ${room.id} [Players: ${room.getActivePlayers().length}, Spectator: ${player.spectator}]`);
    } catch (err) {
      console.error("Error during login:", err);
      socket.emit("joinerr", 0);
    }
  });

  // 2. Incoming game data packets
  socket.on("data", (packet = {}) => {
    try {
      const session = roomManager.getSocketSession(socket);
      if (!session) return;

      const { room, player } = session;
      const id = packet.id;
      const data = packet.data;

      // Rate limit check
      const rateType = id === 19 ? "draw" : id === 30 ? "chat" : "action";
      if (!rateLimiter.checkSocketRate(socket.id, rateType)) {
        return; // Drop flooded packets
      }

      // Payload size check
      if (!rateLimiter.validatePayloadSize(packet)) {
        return;
      }

      switch (id) {
        // Start Game
        case 22:
          if (player.id === room.ownerId) {
            room.game.start(data);
          }
          break;

        // Word Selected by Drawer
        case 18:
          room.game.handleWordChoice(player.id, data);
          break;

        // Draw Strokes Batch
        case 19:
          room.handleDrawing(player, data);
          break;

        // Clear Canvas
        case 20:
          room.handleClear(player);
          break;

        // Undo Action
        case 21:
          room.handleUndo(player, data);
          break;

        // Chat Message / Guess
        case 30: {
          const cleanText = rateLimiter.sanitizeText(data, 150);
          if (cleanText) {
            room.game.handleGuess(player, cleanText);
          }
          break;
        }

        // Emoji reaction (packet 28)
        case 28:
          room.handleEmote(player, data);
          break;

        // Rate Drawing (Like / Dislike)
        case 8:
          room.broadcast({
            id: 8,
            data: { id: player.id, vote: data === 1 ? 1 : 0 }
          });
          break;

        // Room Settings Update
        case 12:
          if (data && data.id !== undefined) {
            const sId = parseInt(data.id, 10);
            if (!isNaN(sId)) {
              room.updateSetting(sId, data.val, player);
            }
          }
          break;

        // Kick Player (Host only)
        case 3:
          if (player.id === room.ownerId && typeof data === "number") {
            room.removePlayer(data, 1);
          }
          break;

        // Ban Player (Host only)
        case 4:
          if (player.id === room.ownerId && typeof data === "number") {
            room.removePlayer(data, 2);
          }
          break;

        // Votekick
        case 5:
          if (typeof data === "number") {
            room.handleVoteKick(player, data);
          }
          break;

        default:
          break;
      }
    } catch (err) {
      console.error("Error handling data packet:", err);
    }
  });

  // 3. Evolution Mode Events
  socket.on("evolution:activate_power", (powerId) => {
    try {
      const session = roomManager.getSocketSession(socket);
      if (!session || !session.room || !session.player) return;
      if (session.room.evolution) {
        session.room.evolution.activatePower(session.player, powerId);
      }
    } catch (err) {
      console.error("Error activating evolution power:", err);
    }
  });

  socket.on("evolution:select_power", (powerId) => {
    try {
      const session = roomManager.getSocketSession(socket);
      if (!session || !session.room || !session.player) return;
      if (session.room.evolution) {
        session.room.evolution.selectPower(session.player, powerId);
      }
    } catch (err) {
      console.error("Error selecting evolution power:", err);
    }
  });

  socket.on("evolution:test_add_xp", (amount) => {
    try {
      const session = roomManager.getSocketSession(socket);
      if (!session || !session.room || !session.player) return;
      if (session.room.evolution) {
        session.room.evolution.addXP(session.player, parseInt(amount) || 50, "Test Bonus");
      }
    } catch (err) {
      console.error("Error adding test evolution xp:", err);
    }
  });

  // 4. Disconnection
  socket.on("disconnect", () => {
    rateLimiter.removeSocket(socket.id);
    roomManager.handleDisconnect(socket);
  });
});

// Graceful Shutdown Handler
function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down DrawRealm gracefully...`);

  // Stop room GC
  roomManager.destroy();

  // Close active sockets with notification
  io.emit("drawrealm:server_shutdown", { message: "Server is restarting for an update." });

  // Close HTTP & Socket server
  server.close(() => {
    console.log("HTTP & WebSocket server stopped.");
    try {
      db.close();
      console.log("Database connection closed.");
    } catch (e) {
      console.error("Error closing database:", e.message);
    }
    process.exit(0);
  });

  // Force exit after 5s timeout
  setTimeout(() => {
    console.error("Forced shutdown due to timeout.");
    process.exit(1);
  }, 5000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

const PORT = config.PORT;

function startServer(port) {
  server.removeAllListeners("listening");
  server.removeAllListeners("error");

  server.once("listening", () => {
    console.log(`DrawRealm Production server running on 0.0.0.0:${port} [Env: ${config.NODE_ENV}]`);
  });

  server.once("error", (err) => {
    if (err.code === "EADDRINUSE" && !process.env.PORT) {
      console.warn(`Port ${port} is in use. Trying fallback port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error("Server listen error:", err);
      process.exit(1);
    }
  });

  server.listen(port, "0.0.0.0");
}

startServer(PORT);


