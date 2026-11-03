import type { OAuthConfig } from "./oauth-config.js";

const CHATGPT_CALLBACK = /^\/aip\/[A-Za-z0-9_-]+\/oauth\/callback$/;

/**
 * Canonical form of a redirect URI, or null when it cannot be used.
 * Rejects userinfo, queries, fragments, whitespace, and backslashes so the
 * consent page cannot be turned into an open redirect.
 */
export function canonicalRedirect(uri: string): string | null {
  if (!uri || uri.length > 500) return null;
  if (/[\s\\@]/.test(uri) || /[\u0000-\u001f\u007f]/.test(uri)) return null;
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return null;
  }
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.pathname.includes("//")) return null;
  return `${url.origin}${url.pathname}`;
}

function isChatGptCallback(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  if (url.hostname !== "chatgpt.com" && url.hostname !== "chat.openai.com") return false;
  return CHATGPT_CALLBACK.test(url.pathname);
}

function isLocalCallback(url: URL): boolean {
  if (url.protocol !== "http:") return false;
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return false;
  return url.pathname.startsWith("/") && url.pathname.length > 1;
}

export function isAllowedRedirect(uri: string, config: OAuthConfig): boolean {
  const canonical = canonicalRedirect(uri);
  if (!canonical) return false;
  if (config.extraRedirects.includes(canonical)) return true;
  if (config.strictRedirects) return false;
  let url: URL;
  try {
    url = new URL(canonical);
  } catch {
    return false;
  }
  if (isChatGptCallback(url)) return true;
  return config.allowLocalRedirects && isLocalCallback(url);
}
