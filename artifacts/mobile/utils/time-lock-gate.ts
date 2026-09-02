/**
 * Pure, testable utilities for the TimeLockGate component.
 *
 * Extracted so that:
 *  - The 60-second foreground-resume cache can be unit-tested without React.
 *  - The gate's render decision (pending / locked / children) can be tested
 *    independently of React Native rendering.
 *  - The AppState handler logic can be simulated with simple function calls.
 */

/** How long (ms) to suppress duplicate foreground access checks. */
export const FOREGROUND_CACHE_MS = 60_000;

/**
 * Returns true when enough time has passed since the last foreground check
 * (or when no check has been run yet), false when the result is still fresh.
 *
 * Prevents hammering the API when the user rapidly force-quits and reopens
 * the app (e.g. switches away and back within a few seconds).
 */
export function shouldRunForegroundCheck(
  lastCheckMs: number | null,
  nowMs: number,
): boolean {
  if (lastCheckMs === null) return true;
  return nowMs - lastCheckMs >= FOREGROUND_CACHE_MS;
}

export type GateStatus = "pending" | "allowed" | "denied";
export type GateOutput = "pending" | "locked" | "children";

/**
 * Tracks access-check ordering so only the newest request may update the gate.
 * This is especially important when a parent's revocation check races an older
 * request that still reports the previous active override.
 */
export function createLatestAccessCheckGuard() {
  let generation = 0;

  return {
    begin(): number {
      generation += 1;
      return generation;
    },
    isCurrent(candidate: number): boolean {
      return candidate === generation;
    },
    invalidate(): void {
      generation += 1;
    },
  };
}

/**
 * Maps the TimeLockGate's internal status to what should be rendered.
 *  - "pending"  → loading spinner
 *  - "denied"   → TimeLockScreen (access blocked)
 *  - "allowed"  → app content (children pass through)
 */
export function selectGateOutput(status: GateStatus): GateOutput {
  if (status === "pending") return "pending";
  if (status === "denied") return "locked";
  return "children";
}

export type ForegroundCheckOptions = {
  /** Current authenticated user ID, or null when signed out. */
  getUserId: () => string | null;
  /**
   * Read the cached account type for a user from persistent storage.
   * Returns the stored string (e.g. "child", "parent") or null when absent.
   */
  getCachedAccountType: (userId: string) => Promise<string | null>;
  /** Execute a live access check for the confirmed child user. */
  runCheck: (userId: string) => Promise<void>;
  /** Returns the ms timestamp of the last completed foreground check, or null. */
  getLastCheckMs: () => number | null;
  /** Persist the ms timestamp of a newly completed foreground check. */
  setLastCheckMs: (ms: number) => void;
  /** Clock source — defaults to Date.now(). Override in tests for determinism. */
  now?: () => number;
};

/**
 * Creates the handler that the AppState "change" event listener should invoke.
 *
 * Behaviour (in order):
 * 1. Ignores all states except "active" (background, inactive, unknown).
 * 2. No-ops when no user is signed in.
 * 3. Skips if the last check ran within the 60-second cache window.
 * 4. Skips confirmed non-child accounts (they are never subject to time locks).
 * 5. Records the current timestamp, then calls runCheck for child (or
 *    unknown-type) accounts.
 *
 * The timestamp is recorded *before* the async runCheck so that a second rapid
 * resume event is suppressed even if the first check hasn't resolved yet.
 */
export function createForegroundCheckHandler(opts: ForegroundCheckOptions) {
  const getNow = opts.now ?? (() => Date.now());
  return async (state: string): Promise<void> => {
    if (state !== "active") return;

    const userId = opts.getUserId();
    if (!userId) return;

    // Suppress duplicate checks within the 60-second window.
    if (!shouldRunForegroundCheck(opts.getLastCheckMs(), getNow())) return;

    // Non-child accounts never need an access check on foreground.
    const cachedType = await opts.getCachedAccountType(userId);
    if (cachedType !== null && cachedType !== "child") return;

    // Record the check time before awaiting so concurrent resumes are dropped.
    opts.setLastCheckMs(getNow());

    await opts.runCheck(userId);
  };
}
