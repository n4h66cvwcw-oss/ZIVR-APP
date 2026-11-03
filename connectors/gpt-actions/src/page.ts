export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type ConsentPage = {
  actionPath: string;
  error?: string;
  clientId: string;
  redirectUri: string;
  state: string;
  scope: string;
  responseType: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
};

function hidden(name: string, value: string): string {
  return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;
}

export function renderConsentPage(page: ConsentPage): string {
  const error = page.error
    ? `<p class="error" role="alert">${escapeHtml(page.error)}</p>`
    : "";
  const challenge = page.codeChallenge
    ? hidden("code_challenge", page.codeChallenge) + hidden("code_challenge_method", page.codeChallengeMethod ?? "S256")
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>Connect ChatGPT to ZIVR</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0A0E1A; color: #E8E8F0; }
    main { max-width: 440px; margin: 0 auto; padding: 48px 20px 64px; }
    h1 { font-size: 1.4rem; font-weight: 650; color: #C4B5FD; margin: 0 0 12px; }
    p { color: #C9C9D8; line-height: 1.5; margin: 0 0 14px; }
    .error { background: #3F1D24; color: #FECDD3; border-radius: 10px; padding: 10px 12px; }
    label { display: block; font-size: 0.85rem; color: #A78BFA; margin-bottom: 6px; }
    input[type="password"] { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #2A3150; background: #12172A; color: #E8E8F0; font: inherit; }
    button { margin-top: 16px; width: 100%; padding: 12px; border: 0; border-radius: 10px; background: #7C6BF2; color: white; font: inherit; font-weight: 600; }
    .fine { font-size: 0.8rem; color: #8B90A8; }
  </style>
</head>
<body>
  <main>
    <h1>Connect ChatGPT to your ZIVR agent</h1>
    <p>Paste this agent's API key (<code>zivr_agent_…</code>). ZIVR checks it and gives ChatGPT a one-hour access token for that twin.</p>
    ${error}
    <form method="post" action="${escapeHtml(page.actionPath)}" autocomplete="off">
      ${hidden("client_id", page.clientId)}
      ${hidden("redirect_uri", page.redirectUri)}
      ${hidden("state", page.state)}
      ${hidden("scope", page.scope)}
      ${hidden("response_type", page.responseType)}
      ${challenge}
      <label for="apiKey">Agent API key</label>
      <input id="apiKey" name="apiKey" type="password" autocomplete="off" spellcheck="false" required>
      <button type="submit">Connect</button>
    </form>
    <p class="fine">The key stays on this server so ChatGPT can refresh the token. It is not sent to ChatGPT. A server restart asks you to connect again.</p>
  </main>
</body>
</html>`;
}

export function renderMessagePage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0A0E1A; color: #E8E8F0; }
    main { max-width: 440px; margin: 0 auto; padding: 48px 20px; }
    h1 { font-size: 1.3rem; color: #C4B5FD; }
    p { color: #C9C9D8; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </main>
</body>
</html>`;
}
