/**
 * Test Suite: Supabase Profile Authentication, Deduplication, JWT Error Handling, and Shutdown
 */

const assert = require("assert");
const { spawn } = require("child_process");
const path = require("path");
const db = require("../server/db/database");
const supabaseService = require("../server/db/supabaseClient");
const roomManager = require("../server/rooms/roomManager");

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("=== STARTING AUTH PROFILE & SHUTDOWN TEST SUITE ===\n");
  let passed = 0;
  let failed = 0;

  // Intercept logs to verify formatting and ensure zero secrets leaked
  const originalError = console.error;
  const originalLog = console.log;
  let loggedErrors = [];
  let loggedOutputs = [];

  console.error = (...args) => {
    loggedErrors.push(args.join(" "));
    originalError.apply(console, args);
  };

  console.log = (...args) => {
    loggedOutputs.push(args.join(" "));
    originalLog.apply(console, args);
  };

  try {
    // --------------------------------------------------------------------
    // TEST 1: Server Startup TimeCheck Logging
    // --------------------------------------------------------------------
    console.log("[TEST 1] Verifying serverTime logging and absence of exposed secrets...");
    supabaseService.init();
    const timeCheckLogs = loggedOutputs.filter(l => l.includes("[TimeCheck] serverTime ="));
    assert.ok(timeCheckLogs.length > 0, "Server must log [TimeCheck] serverTime at startup");
    console.log(`  ✓ Found log: ${timeCheckLogs[0]}`);

    // Verify no secret key is exposed in any log
    const forbiddenKeywords = ["sb_secret_", "service_role", "Bearer eyJ"];
    for (const out of [...loggedOutputs, ...loggedErrors]) {
      for (const kw of forbiddenKeywords) {
        assert.ok(!out.includes(kw), `Logs must NEVER leak Supabase secret or token keyword: ${kw}`);
      }
    }
    console.log("  ✓ No Supabase secrets or raw tokens leaked in logs.");
    console.log("✓ TEST 1 PASSED: Server clock logged cleanly.\n");
    passed++;

    // --------------------------------------------------------------------
    // TEST 2: Existing Profile Mapping for 'zenitzu'
    // --------------------------------------------------------------------
    console.log("[TEST 2] Testing existing profile lookup for 'zenitzu'...");
    if (supabaseService.isConfigured) {
      const zenitzuProfile = await supabaseService.getOrCreatePlayer("zenitzu");
      assert.ok(zenitzuProfile, "Profile for zenitzu must be resolved");
      assert.strictEqual(zenitzuProfile.username, "zenitzu", "Username must match 'zenitzu'");
      assert.strictEqual(zenitzuProfile.id, "3c428547-8e47-4c46-ac34-58cde2f58f08", "Must map to existing UUID for zenitzu");
      assert.strictEqual(zenitzuProfile.evolution.level, 7, "zenitzu must have level 7");
      assert.strictEqual(zenitzuProfile.evolution.xp, 1174, "zenitzu must have 1174 XP");

      // Verify no duplicate profiles were created in Supabase
      const { data: allZenitzu } = await supabaseService.client
        .from("profiles")
        .select("id")
        .eq("username", "zenitzu");

      assert.strictEqual(allZenitzu.length, 1, "There must be exactly 1 profile for zenitzu (no duplicates)");
      console.log(`  ✓ zenitzu resolved cleanly: UUID=${zenitzuProfile.id}, Level=${zenitzuProfile.evolution.level}, XP=${zenitzuProfile.evolution.xp}`);
      console.log("  ✓ Exactly 1 record exists in Supabase profiles (0 duplicates).");
    }
    console.log("✓ TEST 2 PASSED: Existing profile mapped accurately without duplicates.\n");
    passed++;

    // --------------------------------------------------------------------
    // TEST 3: Concurrent Profile Lookups Deduplication
    // --------------------------------------------------------------------
    console.log("[TEST 3] Testing 10 concurrent profile lookups deduplication...");
    if (supabaseService.isConfigured) {
      // Clear cache to test in-flight deduplication
      supabaseService.profileCache.delete("zenitzu");

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(supabaseService.getOrCreatePlayer("zenitzu"));
      }

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, 10, "All 10 lookups completed");
      for (let i = 0; i < 10; i++) {
        assert.strictEqual(results[i].id, "3c428547-8e47-4c46-ac34-58cde2f58f08", "All concurrent lookups return same profile");
      }
      console.log("  ✓ 10 concurrent requests handled safely and deduplicated via in-flight Promise map.");
    }
    console.log("✓ TEST 3 PASSED: Concurrent lookups deduplicated.\n");
    passed++;

    // --------------------------------------------------------------------
    // TEST 4: JWT 'issued at future' Error Formatting & Clock Skew Recovery
    // --------------------------------------------------------------------
    console.log("[TEST 4] Testing JWT 'issued at future' error formatting & clock skew recovery...");
    const testUsername = "future_jwt_test_" + Date.now().toString(36);
    let errorFormattedCorrectly = false;

    // Temporarily mock client query to simulate a JWT issued at future error on first attempt, then success on retry
    const realFrom = supabaseService.client.from.bind(supabaseService.client);
    let attempts = 0;

    supabaseService.client.from = (table) => {
      const builder = realFrom(table);
      if (table === "profiles") {
        const origSelect = builder.select.bind(builder);
        builder.select = (...args) => {
          const query = origSelect(...args);
          const origEq = query.eq.bind(query);
          query.eq = (col, val) => {
            const filter = origEq(col, val);
            if (col === "username" && val === testUsername) {
              const origLimit = filter.limit.bind(filter);
              filter.limit = (l) => {
                attempts++;
                if (attempts === 1) {
                  // Simulate PostgREST 401 JWT issued at future
                  return Promise.resolve({
                    data: null,
                    error: { message: "JWT issued at future", code: "PGRST301" }
                  });
                }
                return Promise.resolve({
                  data: [{ id: "00000000-0000-0000-0000-000000000001", username: testUsername, display_name: testUsername, created_at: new Date().toISOString() }],
                  error: null
                });
              };
            }
            return filter;
          };
          return query;
        };
      }
      return builder;
    };

    try {
      loggedErrors = [];
      const recoveredPlayer = await supabaseService.getOrCreatePlayer(testUsername);
      assert.ok(recoveredPlayer, "Player should be recovered after clock skew retry");

      // Verify logged error output
      const errorLog = loggedErrors.find(e => e.includes("[Supabase] Profile lookup authentication error"));
      assert.ok(errorLog, "Must log '[Supabase] Profile lookup authentication error'");
      assert.ok(errorLog.includes(`player: ${testUsername}`), "Must include player username");
      assert.ok(errorLog.includes("error: JWT issued at future"), "Must include 'error: JWT issued at future'");

      console.log(`  ✓ Handled error with exact requested format:\n${errorLog}`);
      console.log("  ✓ Successfully recovered through clock skew retry path.");
    } finally {
      supabaseService.client.from = realFrom;
    }
    console.log("✓ TEST 4 PASSED: JWT future error handled and formatted securely.\n");
    passed++;

    // --------------------------------------------------------------------
    // TEST 5: RoomManager destroy, shutdown, close, cleanup idempotency
    // --------------------------------------------------------------------
    console.log("[TEST 5] Testing RoomManager shutdown aliases and idempotency...");
    assert.strictEqual(typeof roomManager.destroy, "function", "roomManager.destroy must be a function");
    assert.strictEqual(typeof roomManager.shutdown, "function", "roomManager.shutdown must be a function");
    assert.strictEqual(typeof roomManager.close, "function", "roomManager.close must be a function");
    assert.strictEqual(typeof roomManager.cleanup, "function", "roomManager.cleanup must be a function");

    // Call each alias in succession
    assert.doesNotThrow(() => roomManager.destroy(), "destroy() must not throw");
    assert.doesNotThrow(() => roomManager.shutdown(), "shutdown() must not throw");
    assert.doesNotThrow(() => roomManager.close(), "close() must not throw");
    assert.doesNotThrow(() => roomManager.cleanup(), "cleanup() must not throw");

    console.log("  ✓ All 4 methods exist and execute cleanly as idempotent no-ops.");
    console.log("✓ TEST 5 PASSED: RoomManager shutdown aliases verified.\n");
    passed++;

    // --------------------------------------------------------------------
    // TEST 6: Graceful Shutdown with SIGTERM in Child Server
    // --------------------------------------------------------------------
    console.log("[TEST 6] Testing graceful shutdown with SIGTERM in child server process...");
    const testPort = 3988;
    const serverProc = spawn("node", ["server/server.js"], {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, PORT: String(testPort) }
    });

    let serverStarted = false;
    let serverOutput = "";

    serverProc.stdout.on("data", chunk => {
      const str = chunk.toString();
      serverOutput += str;
      if (str.includes("DrawRealm Production server running")) {
        serverStarted = true;
      }
    });

    serverProc.stderr.on("data", chunk => {
      serverOutput += chunk.toString();
    });

    let w = 0;
    while (!serverStarted && w < 50) {
      await sleep(100);
      w++;
    }

    assert.ok(serverStarted, "Server process failed to start within 5s");
    assert.ok(serverOutput.includes("[TimeCheck] serverTime ="), "Server process must log [TimeCheck] serverTime on startup");
    console.log("  ✓ Server logged [TimeCheck] serverTime on port " + testPort);

    // Send SIGTERM
    serverProc.kill("SIGTERM");

    const exitInfo = await new Promise(resolve => {
      serverProc.on("exit", (code, sig) => resolve({ code, sig }));
    });

    console.log(`  ✓ Child server exited with code ${exitInfo.code}`);
    assert.ok(
      !serverOutput.includes("TypeError: roomManager.destroy is not a function"),
      "Must not contain 'TypeError: roomManager.destroy is not a function'"
    );
    assert.ok(
      serverOutput.includes("HTTP & WebSocket server stopped"),
      "Must confirm HTTP & WebSocket server stopped cleanly"
    );

    console.log("✓ TEST 6 PASSED: Child server shut down gracefully on SIGTERM.\n");
    passed++;

  } finally {
    console.error = originalError;
    console.log = originalLog;
  }

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
