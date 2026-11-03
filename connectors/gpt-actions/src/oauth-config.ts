import {
  CODE_TTL_MS,
  MIN_OAUTH_CLIENT_ID_LENGTH,
  MIN_OAUTH_CLIENT_SECRET_LENGTH,
  REFRESH_TTL_MS,
} from "./limits.js";
import { canonicalRedirect } from "./redirect.js";

export type OAuthConfig = {
  clientId: string;
  clientSecret: string;
  allowLocalRedirects: boolean;
  strictRedirects: boolean;
  /** Canonical redirect URIs. In strict mode these are the only ones allowed. */
  extraRedirects: string[];
  codeTtlMs: number;
  refreshTtlMs: number;
};

export type OAuthConfigRead =
  | { state: "disabled" }
  | { state: "invalid"; error: string }
  | { state: "ready"; config: OAuthConfig };

function nonempty(value: string | undefined): string {
  return value?.trim() ?? "";
}

function flag(value: string | undefined): boolean {
  const trimmed = value?.trim().toLowerCase();
  return trimmed === "1" || trimmed === "true" || trimmed === "yes";
}

/**
 * Disabled when both client env vars are unset, so the API can ship this
 * route without opening a consent form. One of the two set, or a short
 * secret, is a configuration error rather than a silent disable.
 */
export function readOAuthConfig(env: NodeJS.ProcessEnv): OAuthConfigRead {
  const clientId = nonempty(env["ZIVR_GPT_OAUTH_CLIENT_ID"]);
  const clientSecret = nonempty(env["ZIVR_GPT_OAUTH_CLIENT_SECRET"]);
  if (!clientId && !clientSecret) return { state: "disabled" };
  if (!clientId || !clientSecret) {
    return { state: "invalid", error: "Set both ZIVR_GPT_OAUTH_CLIENT_ID and ZIVR_GPT_OAUTH_CLIENT_SECRET" };
  }
  if (clientId.length < MIN_OAUTH_CLIENT_ID_LENGTH) {
    return { state: "invalid", error: `ZIVR_GPT_OAUTH_CLIENT_ID must be at least ${MIN_OAUTH_CLIENT_ID_LENGTH} characters` };
  }
  if (clientSecret.length < MIN_OAUTH_CLIENT_SECRET_LENGTH) {
    return { state: "invalid", error: `ZIVR_GPT_OAUTH_CLIENT_SECRET must be at least ${MIN_OAUTH_CLIENT_SECRET_LENGTH} characters` };
  }
  const extra: string[] = [];
  const rawList = nonempty(env["ZIVR_GPT_OAUTH_REDIRECT_URIS"]);
  if (rawList) {
    for (const item of rawList.split(",")) {
      const canonical = canonicalRedirect(item.trim());
      if (!canonical) return { state: "invalid", error: "ZIVR_GPT_OAUTH_REDIRECT_URIS contains an invalid URL" };
      extra.push(canonical);
    }
  }
  const strictRedirects = flag(env["ZIVR_GPT_OAUTH_STRICT_REDIRECTS"]);
  if (strictRedirects && extra.length === 0) {
    return { state: "invalid", error: "ZIVR_GPT_OAUTH_STRICT_REDIRECTS requires ZIVR_GPT_OAUTH_REDIRECT_URIS" };
  }
  return {
    state: "ready",
    config: {
      clientId,
      clientSecret,
      allowLocalRedirects: flag(env["ZIVR_GPT_OAUTH_ALLOW_LOCAL"]),
      strictRedirects,
      extraRedirects: extra,
      codeTtlMs: CODE_TTL_MS,
      refreshTtlMs: REFRESH_TTL_MS,
    },
  };
}
