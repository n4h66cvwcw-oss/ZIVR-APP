export const CONTENT_ALERT_THRESHOLDS = ["all", "medium", "high"] as const;

export type ContentAlertThreshold = (typeof CONTENT_ALERT_THRESHOLDS)[number];

export function isContentAlertThreshold(value: unknown): value is ContentAlertThreshold {
  return typeof value === "string" &&
    (CONTENT_ALERT_THRESHOLDS as readonly string[]).includes(value);
}

/**
 * Decides whether a content-flag severity should send a push notification.
 * Unknown stored preferences intentionally preserve the documented default.
 */
export function shouldNotifyForSeverity(
  severity: string,
  minimumSeverity: string | null | undefined,
): boolean {
  const threshold: ContentAlertThreshold =
    minimumSeverity === "all" || minimumSeverity === "high"
      ? minimumSeverity
      : "medium";

  if (threshold === "all") {
    return severity === "low" || severity === "medium" || severity === "high";
  }
  if (threshold === "high") return severity === "high";
  return severity === "medium" || severity === "high";
}