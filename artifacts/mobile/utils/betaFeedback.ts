import AsyncStorage from "@react-native-async-storage/async-storage";

export const BETA_CHAT_ID = "zivr-beta-feedback";

// ─── Owner Configuration ──────────────────────────────────────────────────────
// TODO: Replace the empty string with the destination email address once
// the owner supplies it. As soon as this is set the app will forward every
// message sent in the Beta Feedback chat to that address via the API.
export const BETA_FEEDBACK_EMAIL = ""; // e.g. "feedback@zivr.app"

// ─── Storage ──────────────────────────────────────────────────────────────────
const QUEUE_KEY = "@zivr_beta_feedback_queue";

export type FeedbackItem = {
  id: string;
  text: string;
  senderName: string;
  timestamp: number;
  sent: boolean;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Called whenever the user sends a message in the Beta Feedback chat.
 * Persists the message to a local queue and, once BETA_FEEDBACK_EMAIL is
 * configured, immediately attempts to forward it.
 */
export async function queueFeedbackSubmission(
  text: string,
  senderName: string,
  timestamp: number
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: FeedbackItem[] = raw ? JSON.parse(raw) : [];
    const item: FeedbackItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      text,
      senderName,
      timestamp,
      sent: false,
    };
    queue.push(item);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

    if (BETA_FEEDBACK_EMAIL) {
      await _sendFeedbackEmail(item);
    }
  } catch (e) {
    console.warn("[BetaFeedback] Failed to queue submission:", e);
  }
}

/** Returns all queued feedback items (for debugging / admin view). */
export async function getFeedbackQueue(): Promise<FeedbackItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

/**
 * Forwards a single feedback item to the owner's email via the ZIVR API.
 *
 * HOW TO ACTIVATE:
 *  1. Set BETA_FEEDBACK_EMAIL above to the owner's email address.
 *  2. Add a POST /api/beta-feedback route to artifacts/api-server that accepts
 *     { to, from, text, timestamp } and sends the email (e.g. via Nodemailer,
 *     SendGrid, Resend, etc.).
 *  3. Uncomment the fetch block below.
 */
async function _sendFeedbackEmail(item: FeedbackItem): Promise<void> {
  // TODO: Uncomment once the /api/beta-feedback endpoint is created and
  //       BETA_FEEDBACK_EMAIL is set.
  /*
  try {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const res = await fetch(`https://${domain}/api/beta-feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: BETA_FEEDBACK_EMAIL,
        from: item.senderName,
        text: item.text,
        timestamp: item.timestamp,
      }),
    });
    if (res.ok) {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      const queue: FeedbackItem[] = raw ? JSON.parse(raw) : [];
      const updated = queue.map((q) =>
        q.id === item.id ? { ...q, sent: true } : q
      );
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.warn("[BetaFeedback] Email send failed:", e);
  }
  */
}
