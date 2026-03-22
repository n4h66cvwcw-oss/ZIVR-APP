import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.get("/privacy", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VibeMsg Privacy Policy</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0A0E1A; color: #E8E8F0; line-height: 1.7; }
    .container { max-width: 760px; margin: 0 auto; padding: 48px 24px 80px; }
    h1 { font-size: 2rem; font-weight: 700; color: #A78BFA; margin-bottom: 8px; }
    .updated { color: #6B7280; font-size: 0.875rem; margin-bottom: 40px; }
    h2 { font-size: 1.2rem; font-weight: 600; color: #C4B5FD; margin: 32px 0 12px; }
    p { color: #C9C9D8; margin-bottom: 12px; }
    ul { padding-left: 20px; margin-bottom: 12px; }
    li { color: #C9C9D8; margin-bottom: 6px; }
    a { color: #818CF8; text-decoration: none; }
    .section { background: #12172A; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #1E2540; }
  </style>
</head>
<body>
  <div class="container">
    <h1>VibeMsg Privacy Policy</h1>
    <p class="updated">Last updated: March 2026</p>

    <div class="section">
      <h2>1. Information We Collect</h2>
      <p>VibeMsg collects the following information to provide its services:</p>
      <ul>
        <li><strong>Profile data:</strong> Display name, username, and optional status message you choose to provide.</li>
        <li><strong>Messages:</strong> Messages you send and receive. All messages between users on our server are transmitted over encrypted connections. End-to-end encryption (E2E) is available and user-controlled per chat.</li>
        <li><strong>Contacts:</strong> With your permission, we access your device contacts to help you find friends who use VibeMsg. We do not store your full contact list on our servers.</li>
        <li><strong>Push notification tokens:</strong> Used solely to deliver message notifications to your device.</li>
        <li><strong>Usage data:</strong> Anonymous data about app performance and crash reports.</li>
      </ul>
    </div>

    <div class="section">
      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To deliver messages, notifications, and app features.</li>
        <li>To identify your account and maintain your session.</li>
        <li>To improve app reliability and fix bugs.</li>
        <li>We do not sell, rent, or share your personal information with third parties for marketing purposes.</li>
      </ul>
    </div>

    <div class="section">
      <h2>3. Data Storage and Security</h2>
      <p>Messages are stored on our servers to enable delivery to offline recipients. Locally-locked chats protected by your passcode are hashed and never transmitted in plaintext. End-to-end encrypted chats use AES-256 encryption; decryption keys are generated and stored only on your device.</p>
      <p>Your data is stored on servers located in the United States. We use industry-standard security practices including TLS encryption for all data in transit.</p>
    </div>

    <div class="section">
      <h2>4. Permissions</h2>
      <ul>
        <li><strong>Camera &amp; Microphone:</strong> Used for secure picture messages and voice/video calls, only when you initiate those actions.</li>
        <li><strong>Photos:</strong> Used only when you choose to attach an image to a message.</li>
        <li><strong>Contacts:</strong> Used to find friends on VibeMsg and invite others. Not stored on our servers.</li>
        <li><strong>Notifications:</strong> Used to alert you to new messages. You can disable at any time in device settings.</li>
        <li><strong>Face ID / Biometrics:</strong> Used locally on-device only, to unlock passcode-protected chats. Biometric data never leaves your device.</li>
      </ul>
    </div>

    <div class="section">
      <h2>5. In-App Purchases</h2>
      <p>VibeMsg offers VibeCoin, a virtual currency purchasable through Apple App Store and Google Play in-app purchase systems. Purchases are processed by Apple or Google according to their respective terms. VibeMsg does not store your payment information.</p>
    </div>

    <div class="section">
      <h2>6. Children's Privacy</h2>
      <p>VibeMsg is not intended for users under the age of 13. We do not knowingly collect information from children under 13. If you believe a child has provided us with personal information, please contact us.</p>
    </div>

    <div class="section">
      <h2>7. Your Rights</h2>
      <p>You may request deletion of your account and associated data at any time by contacting us. Upon deletion, your messages and profile will be removed from our servers within 30 days.</p>
    </div>

    <div class="section">
      <h2>8. Changes to This Policy</h2>
      <p>We may update this policy from time to time. We will notify you of significant changes via in-app notification. Continued use of the app after changes constitutes acceptance.</p>
    </div>

    <div class="section">
      <h2>9. Contact Us</h2>
      <p>If you have questions about this privacy policy or your data, contact us at: <a href="mailto:privacy@vibemsg.app">privacy@vibemsg.app</a></p>
    </div>
  </div>
</body>
</html>`);
});

app.get("/support", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VibeMsg Support</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0A0E1A; color: #E8E8F0; line-height: 1.7; }
    .container { max-width: 680px; margin: 0 auto; padding: 48px 24px; }
    h1 { font-size: 2rem; font-weight: 700; color: #A78BFA; margin-bottom: 16px; }
    p { color: #C9C9D8; margin-bottom: 16px; }
    a { color: #818CF8; }
    .card { background: #12172A; border-radius: 12px; padding: 24px; border: 1px solid #1E2540; margin-bottom: 16px; }
    h2 { color: #C4B5FD; font-size: 1.1rem; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>VibeMsg Support</h1>
    <div class="card">
      <h2>Contact Support</h2>
      <p>Email us at <a href="mailto:support@vibemsg.app">support@vibemsg.app</a> and we'll get back to you within 24 hours.</p>
    </div>
    <div class="card">
      <h2>Common Questions</h2>
      <p><strong>How do I reset a chat passcode?</strong><br>Go to Chat Settings and use your recovery email to reset the passcode.</p>
      <p><strong>How does E2E encryption work?</strong><br>End-to-end encryption uses AES-256. Keys are generated on your device and never leave it. Enable it per-chat in Chat Settings.</p>
      <p><strong>How do I delete my account?</strong><br>Email us at support@vibemsg.app with subject "Delete Account" and your username.</p>
    </div>
  </div>
</body>
</html>`);
});

export default app;
