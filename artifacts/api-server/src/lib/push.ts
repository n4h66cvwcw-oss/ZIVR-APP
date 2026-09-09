export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  sound: string,
  data: Record<string, unknown> = {},
  categoryId?: string,
) {
  if (!tokens.length) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(
        tokens.map((to) => ({
          to,
          title,
          body,
          sound: sound === "none" ? undefined : "default",
          data: { sound, ...data },
          categoryId,
        }))
      ),
    });
  } catch (err) {
    console.warn("[push] failed to send:", err);
  }
}
