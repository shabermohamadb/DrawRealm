/**
 * DrawRealm Production Configuration
 * Reads configuration from environment variables with production defaults
 */

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const config = {
  // Server port
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,

  // Runtime environment ('production' | 'development' | 'test')
  NODE_ENV: process.env.NODE_ENV || "production",

  // Supabase PostgreSQL Configuration
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY || "",

  // Database path / connection string
  DATABASE_URL: process.env.DATABASE_URL || path.resolve(__dirname, "data/drawrealm.sqlite"),

  // CORS allowed origins (comma-separated or single domain, '*' for public)
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",

  // Reconnection grace periods
  RECONNECT_GRACE_PERIOD_MS: process.env.RECONNECT_GRACE_PERIOD_MS
    ? parseInt(process.env.RECONNECT_GRACE_PERIOD_MS, 10)
    : 30000, // 30 seconds for guessers

  DRAWER_RECONNECT_GRACE_PERIOD_MS: process.env.DRAWER_RECONNECT_GRACE_PERIOD_MS
    ? parseInt(process.env.DRAWER_RECONNECT_GRACE_PERIOD_MS, 10)
    : 15000, // 15 seconds for active drawer

  // Room limits
  MAX_ROOMS: process.env.MAX_ROOMS ? parseInt(process.env.MAX_ROOMS, 10) : 500,
  MAX_PLAYERS_PER_ROOM: process.env.MAX_PLAYERS_PER_ROOM ? parseInt(process.env.MAX_PLAYERS_PER_ROOM, 10) : 20,

  // Rate limits per socket
  RATE_LIMITS: {
    DRAW_PER_SEC: 40,
    CHAT_PER_SEC: 5,
    ACTIONS_PER_SEC: 3,
    MAX_PAYLOAD_BYTES: 16 * 1024 // 16 KB
  },

  // Secret for session verification
  SESSION_SECRET: process.env.SESSION_SECRET || "drawrealm_production_secret_key"
};

module.exports = config;
