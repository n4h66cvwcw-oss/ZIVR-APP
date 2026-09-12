import assert from "node:assert/strict";
import test from "node:test";
import {
  FOREGROUND_CACHE_MS,
  createForegroundCheckHandler,
  createLatestAccessCheckGuard,
  runChildCheck,
  scheduleOverrideExpiryCheck,
  selectGateOutput,
  shouldRunForegroundCheck,
} from "./time-lock-gate.ts";

// ─── shouldRunForegroundCheck ─────────────────────────────────────────────────

test("shouldRunForegroundCheck: runs when no prior check has been recorded", () => {
  assert.equal(shouldRunForegroundCheck(null, Date.now()), true);
});

test("shouldRunForegroundCheck: skips a check made within the 60-second window", () => {
  const lastCheckMs = 1_000_000;
  const nowMs = lastCheckMs + FOREGROUND_CACHE_MS - 1; // 1 ms before expiry
  assert.equal(shouldRunForegroundCheck(lastCheckMs, nowMs), false);
});

test("shouldRunForegroundCheck: runs once the 60-second window has elapsed", () => {
  const lastCheckMs = 1_000_000;
  const nowMs = lastCheckMs + FOREGROUND_CACHE_MS; // exactly at boundary
  assert.equal(shouldRunForegroundCheck(lastCheckMs, nowMs), true);
});

// ─── selectGateOutput ─────────────────────────────────────────────────────────

test("selectGateOutput: denied status maps to locked — TimeLockScreen should render", () => {
  // This is the critical invariant: when checkAccess returns { allowed: false }
  // the gate records status "denied", and selectGateOutput must direct to the
  // TimeLockScreen ("locked") instead of passing children through.
  assert.equal(selectGateOutput("denied"), "locked");
});

test("selectGateOutput: allowed status passes children through", () => {
  assert.equal(selectGateOutput("allowed"), "children");
});

test("selectGateOutput: pending status shows the loading spinner", () => {
  assert.equal(selectGateOutput("pending"), "pending");
});

test("runChildCheck: network failure with no denied cache keeps the gate locked", async () => {
  let status: "allowed" | "denied" = "allowed";

  await runChildCheck({
    userId: "child-1",
    checkAccess: async () => {
      throw new Error("time-check server unavailable");
    },
    getDeniedCache: async () => null,
    setDeniedCache: () => {},
    isCurrent: () => true,
    setOverrideRemainingMs: () => {},
    setLockInfo: () => {},
    setStatus: (nextStatus) => {
      status = nextStatus;
    },
  });

  assert.equal(status, "denied");
  assert.equal(selectGateOutput(status), "locked");
});

test("runChildCheck: network failure with a denied cache shows the cached hours", async () => {
  const cachedHours = { startHour: 7, endHour: 19 };
  let status: "allowed" | "denied" = "allowed";
  let lockInfo: typeof cachedHours | null = null;

  await runChildCheck({
    userId: "child-1",
    checkAccess: async () => {
      throw new Error("time-check server unavailable");
    },
    getDeniedCache: async () => JSON.stringify(cachedHours),
    setDeniedCache: () => {},
    isCurrent: () => true,
    setOverrideRemainingMs: () => {},
    setLockInfo: (nextLockInfo) => {
      lockInfo = nextLockInfo;
    },
    setStatus: (nextStatus) => {
      status = nextStatus;
    },
  });

  assert.equal(status, "denied");
  assert.deepEqual(lockInfo, cachedHours);
});

test("latest access check wins when revocation races an older allowed response", async () => {
  const guard = createLatestAccessCheckGuard();
  let status: "allowed" | "denied" = "allowed";

  let resolveBeforeRevocation!: (allowed: boolean) => void;
  const beforeRevocation = new Promise<boolean>((resolve) => {
    resolveBeforeRevocation = resolve;
  });
  let resolveAfterRevocation!: (allowed: boolean) => void;
  const afterRevocation = new Promise<boolean>((resolve) => {
    resolveAfterRevocation = resolve;
  });

  const runCheck = async (resultPromise: Promise<boolean>) => {
    const generation = guard.begin();
    const allowed = await resultPromise;
    if (guard.isCurrent(generation)) {
      status = allowed ? "allowed" : "denied";
    }
  };

  const olderCheck = runCheck(beforeRevocation);
  const revocationCheck = runCheck(afterRevocation);

  resolveAfterRevocation(false);
  await revocationCheck;
  assert.equal(status, "denied", "the revocation check should lock the child");

  resolveBeforeRevocation(true);
  await olderCheck;
  assert.equal(
    status,
    "denied",
    "a late pre-revocation response must not unlock the child again",
  );
});

test("override expiry scheduler rechecks an allowed child at the server-provided boundary", () => {
  let scheduledDelay: number | null = null;
  let scheduledCallback: () => void = () => {
    assert.fail("expiry callback was not scheduled");
  };
  const recheckedUsers: string[] = [];

  scheduleOverrideExpiryCheck({
    userId: "child-1",
    remainingMs: 12_345,
    isCurrentUser: (userId) => userId === "child-1",
    onExpire: (userId) => {
      recheckedUsers.push(userId);
    },
    setTimer: (callback, delayMs) => {
      scheduledCallback = callback;
      scheduledDelay = delayMs;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: () => {},
  });

  assert.equal(scheduledDelay, 12_345);
  assert.deepEqual(recheckedUsers, [], "access remains allowed before the boundary");

  scheduledCallback();
  assert.deepEqual(
    recheckedUsers,
    ["child-1"],
    "expiry must apply a fresh server check while the app remains open",
  );
});

test("override expiry scheduler ignores a pending recheck after identity changes", () => {
  let activeUserId = "child-1";
  let scheduledCallback: () => void = () => {
    assert.fail("expiry callback was not scheduled");
  };
  const recheckedUsers: string[] = [];

  scheduleOverrideExpiryCheck({
    userId: "child-1",
    remainingMs: 5_000,
    isCurrentUser: (userId) => activeUserId === userId,
    onExpire: (userId) => {
      recheckedUsers.push(userId);
    },
    setTimer: (callback) => {
      scheduledCallback = callback;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: () => {},
  });

  activeUserId = "child-2";
  scheduledCallback();
  assert.deepEqual(
    recheckedUsers,
    [],
    "the previous child's timer must not affect the newer identity",
  );
});

test("override expiry scheduler replaces an earlier boundary when access is extended", () => {
  const scheduled = new Map<number, { callback: () => void; delayMs: number }>();
  const clearedTimers: number[] = [];
  const recheckedUsers: string[] = [];
  let nextTimerId = 1;

  const schedule = (remainingMs: number) => scheduleOverrideExpiryCheck({
    userId: "child-1",
    remainingMs,
    isCurrentUser: (userId) => userId === "child-1",
    onExpire: (userId) => {
      recheckedUsers.push(userId);
    },
    setTimer: (callback, delayMs) => {
      const timerId = nextTimerId++;
      scheduled.set(timerId, { callback, delayMs });
      return timerId as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: (timer) => {
      clearedTimers.push(timer as unknown as number);
    },
  });

  const cancelEarlierBoundary = schedule(5_000);
  cancelEarlierBoundary();
  schedule(20_000);

  assert.deepEqual(clearedTimers, [1], "the earlier expiry timer must be cancelled");
  assert.equal(scheduled.get(1)?.delayMs, 5_000);
  assert.equal(scheduled.get(2)?.delayMs, 20_000);

  scheduled.get(1)?.callback();
  assert.deepEqual(
    recheckedUsers,
    [],
    "a stale callback racing with cancellation must not trigger an early recheck",
  );

  scheduled.get(2)?.callback();
  assert.deepEqual(
    recheckedUsers,
    ["child-1"],
    "only the newest server-provided expiry boundary should trigger the recheck",
  );
});

// ─── createForegroundCheckHandler ────────────────────────────────────────────

test("foreground handler: calls runCheck on each active transition separated by more than 60 s", async () => {
  // Simulates the user force-quitting and reopening the app twice, with
  // sufficient time between opens for the cache to have expired.
  let checkCount = 0;
  let lastCheckMs: number | null = null;
  let currentTime = 0;

  const handler = createForegroundCheckHandler({
    getUserId: () => "child-1",
    getCachedAccountType: async () => "child",
    runCheck: async () => {
      checkCount++;
    },
    getLastCheckMs: () => lastCheckMs,
    setLastCheckMs: (ms) => {
      lastCheckMs = ms;
    },
    now: () => currentTime,
  });

  // Background transition — must be ignored.
  await handler("background");
  assert.equal(checkCount, 0, "background state must not trigger a check");

  // First foreground resume.
  await handler("active");
  assert.equal(checkCount, 1, "first foreground resume should trigger a check");

  // Second resume after more than 60 seconds (cache expired).
  currentTime += FOREGROUND_CACHE_MS + 5_000;
  await handler("active");
  assert.equal(
    checkCount,
    2,
    "foreground resume after cache expiry should trigger another check",
  );
});

test("foreground handler: 60-second cache prevents a duplicate network call within the window", async () => {
  // Simulates rapid force-quit and reopen (e.g. within 30 seconds).
  // The second activation must be suppressed to avoid duplicate API calls.
  let checkCount = 0;
  let lastCheckMs: number | null = null;
  let currentTime = 1_000_000;

  const handler = createForegroundCheckHandler({
    getUserId: () => "child-1",
    getCachedAccountType: async () => "child",
    runCheck: async () => {
      checkCount++;
    },
    getLastCheckMs: () => lastCheckMs,
    setLastCheckMs: (ms) => {
      lastCheckMs = ms;
    },
    now: () => currentTime,
  });

  // First resume: check runs.
  await handler("active");
  assert.equal(checkCount, 1, "first foreground resume should trigger a check");

  // Second resume 30 s later — still inside the 60-second cache window.
  currentTime += 30_000;
  await handler("active");
  assert.equal(
    checkCount,
    1,
    "foreground resume within 60 s must not trigger another network call",
  );
});

test("foreground handler: a reset cache runs on the next active transition", async () => {
  let checkCount = 0;
  let lastCheckMs: number | null = null;
  let currentTime = 1_000_000;

  const handler = createForegroundCheckHandler({
    getUserId: () => "child-2",
    getCachedAccountType: async () => "child",
    runCheck: async () => {
      checkCount++;
    },
    getLastCheckMs: () => lastCheckMs,
    setLastCheckMs: (ms) => {
      lastCheckMs = ms;
    },
    now: () => currentTime,
  });

  await handler("active");
  assert.equal(checkCount, 1, "the previous user's foreground check should run");

  // Identity changes reset the component's cache before the new user's resume.
  lastCheckMs = null;
  currentTime += 1_000;
  await handler("active");
  assert.equal(
    checkCount,
    2,
    "a freshly reset cache must trigger the next active transition",
  );
});

test("foreground handler: skips confirmed non-child accounts", async () => {
  let checkCount = 0;
  let lastCheckMs: number | null = null;

  const handler = createForegroundCheckHandler({
    getUserId: () => "parent-1",
    getCachedAccountType: async () => "parent",
    runCheck: async () => {
      checkCount++;
    },
    getLastCheckMs: () => lastCheckMs,
    setLastCheckMs: (ms) => {
      lastCheckMs = ms;
    },
  });

  await handler("active");
  assert.equal(checkCount, 0, "non-child accounts must never trigger an access check");
});

test("foreground handler: skips when no user is signed in", async () => {
  let checkCount = 0;

  const handler = createForegroundCheckHandler({
    getUserId: () => null,
    getCachedAccountType: async () => null,
    runCheck: async () => {
      checkCount++;
    },
    getLastCheckMs: () => null,
    setLastCheckMs: () => {},
  });

  await handler("active");
  assert.equal(checkCount, 0, "signed-out state must not trigger an access check");
});
