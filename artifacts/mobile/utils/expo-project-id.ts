/** EAS project for app.replit.zivr. Used when the manifest has no real project id. */
export const LOCKED_EAS_PROJECT_ID = "635c1471-d522-4ada-8309-2a5faa6fd6f4";

const UNUSABLE_PROJECT_IDS = new Set(["", "YOUR_EAS_PROJECT_ID"]);

/**
 * Expo push tokens are scoped to the EAS project. Prefer the id baked into
 * the build (`Constants.easConfig`), then app.json `extra.eas.projectId`.
 * Never use EXPO_PUBLIC_REPL_ID — that is a Replit id, not an EAS project.
 */
export function resolveExpoProjectId(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed || UNUSABLE_PROJECT_IDS.has(trimmed)) continue;
    return trimmed;
  }
  return LOCKED_EAS_PROJECT_ID;
}
