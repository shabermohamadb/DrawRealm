-- ============================================================================
-- DrawRealm — Production Supabase PostgreSQL Schema
-- Database tables, foreign keys, constraints, indexes, and Row Level Security
-- ============================================================================

-- Ensure pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. PROFILES
-- Stores unique player identities, usernames, and display names
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(30) UNIQUE NOT NULL,
    display_name VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. PLAYER STATS
-- Lifetime gameplay statistics and match records
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS player_stats (
    player_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    rounds_played INTEGER DEFAULT 0,
    correct_guesses INTEGER DEFAULT 0,
    best_score INTEGER DEFAULT 0,
    fastest_guess INTEGER,
    current_streak INTEGER DEFAULT 0,
    highest_streak INTEGER DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- 3. EVOLUTION PROFILES
-- Progression-based Evolution XP, levels, specialization, and ultimate powers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evolution_profiles (
    player_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    branch VARCHAR(30) DEFAULT 'balanced',
    ultimate_power VARCHAR(50),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. PLAYER POWERS
-- Unlocked Evolution powers catalog per player
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS player_powers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    power_id VARCHAR(50) NOT NULL,
    rarity VARCHAR(20) DEFAULT 'common',
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_player_power UNIQUE (player_id, power_id)
);

-- ----------------------------------------------------------------------------
-- 5. EQUIPPED POWERS
-- Currently active loadout configuration in match slots (0 to 3)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipped_powers (
    player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    slot INTEGER NOT NULL CHECK (slot >= 0 AND slot <= 3),
    power_id VARCHAR(50) NOT NULL,
    PRIMARY KEY (player_id, slot)
);

-- ----------------------------------------------------------------------------
-- 6. ACHIEVEMENTS
-- Unlocked player achievements (idempotent, no duplicates)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    achievement_id VARCHAR(50) NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_player_achievement UNIQUE (player_id, achievement_id)
);

-- ----------------------------------------------------------------------------
-- 7. MATCHES
-- Completed multiplayer match records
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id VARCHAR(20) NOT NULL,
    game_mode VARCHAR(30) DEFAULT 'classic',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ DEFAULT NOW(),
    winner_id UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- 8. MATCH PLAYERS
-- Participant scores, positions, and XP rewards per match
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS match_players (
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    evolution_xp_earned INTEGER DEFAULT 0,
    final_position INTEGER DEFAULT 1,
    PRIMARY KEY (match_id, player_id)
);

-- ----------------------------------------------------------------------------
-- 9. MATCH ROUNDS
-- Round-level breakdown per match
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS match_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    drawer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR FREQUENTLY QUERIED COLUMNS
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON profiles(last_active_at);
CREATE INDEX IF NOT EXISTS idx_player_powers_player ON player_powers(player_id);
CREATE INDEX IF NOT EXISTS idx_equipped_powers_player ON equipped_powers(player_id);
CREATE INDEX IF NOT EXISTS idx_achievements_player ON achievements(player_id);
CREATE INDEX IF NOT EXISTS idx_matches_room ON matches(room_id);
CREATE INDEX IF NOT EXISTS idx_matches_started_at ON matches(started_at);
CREATE INDEX IF NOT EXISTS idx_match_players_player ON match_players(player_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict server-authoritative security model:
-- - Read: Public read permitted for leaderboards, podiums, and public stats.
-- - Mutation: ONLY privileged service_role can INSERT, UPDATE, or DELETE.
-- - Clients cannot mutate their own XP, levels, scores, or powers from the browser.
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_powers ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipped_powers ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_rounds ENABLE ROW LEVEL SECURITY;

-- Public Read Policies
DROP POLICY IF EXISTS "Public read profiles" ON profiles;
CREATE POLICY "Public read profiles" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read player_stats" ON player_stats;
CREATE POLICY "Public read player_stats" ON player_stats FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read evolution_profiles" ON evolution_profiles;
CREATE POLICY "Public read evolution_profiles" ON evolution_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read player_powers" ON player_powers;
CREATE POLICY "Public read player_powers" ON player_powers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read equipped_powers" ON equipped_powers;
CREATE POLICY "Public read equipped_powers" ON equipped_powers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read achievements" ON achievements;
CREATE POLICY "Public read achievements" ON achievements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read matches" ON matches;
CREATE POLICY "Public read matches" ON matches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read match_players" ON match_players;
CREATE POLICY "Public read match_players" ON match_players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read match_rounds" ON match_rounds;
CREATE POLICY "Public read match_rounds" ON match_rounds FOR SELECT USING (true);

-- Service Role Full Privileges
DROP POLICY IF EXISTS "Service role full access profiles" ON profiles;
CREATE POLICY "Service role full access profiles" ON profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access player_stats" ON player_stats;
CREATE POLICY "Service role full access player_stats" ON player_stats FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access evolution_profiles" ON evolution_profiles;
CREATE POLICY "Service role full access evolution_profiles" ON evolution_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access player_powers" ON player_powers;
CREATE POLICY "Service role full access player_powers" ON player_powers FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access equipped_powers" ON equipped_powers;
CREATE POLICY "Service role full access equipped_powers" ON equipped_powers FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access achievements" ON achievements;
CREATE POLICY "Service role full access achievements" ON achievements FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access matches" ON matches;
CREATE POLICY "Service role full access matches" ON matches FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access match_players" ON match_players;
CREATE POLICY "Service role full access match_players" ON match_players FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access match_rounds" ON match_rounds;
CREATE POLICY "Service role full access match_rounds" ON match_rounds FOR ALL TO service_role USING (true) WITH CHECK (true);
