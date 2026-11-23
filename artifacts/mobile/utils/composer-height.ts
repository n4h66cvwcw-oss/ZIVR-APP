/**
 * String rendered by the hidden composer mirror.
 * A trailing newline has no glyph, so the last line measures as zero height
 * unless a space follows it. Empty text still occupies one line.
 */
export function composerMirrorText(text: string): string {
  if (text.length === 0) return " ";
  if (text.endsWith("\n")) return `${text} `;
  return text;
}

/** Apply min/max to a mirror measurement. `null` means the measurement is unusable. */
export function clampComposerHeight(measured: number, min: number, max: number): number | null {
  const rounded = Math.ceil(measured);
  if (!Number.isFinite(rounded) || rounded <= 0) return null;
  return Math.min(Math.max(rounded, min), max);
}

/**
 * Next TextInput height. The mirror onLayout value is the only measurement;
 * min/max only constrain it. Empty text always collapses to one line so a
 * stale multi-line layout cannot keep the field tall after send or clear.
 */
export function nextComposerHeight(options: {
  textLength: number;
  measured: number;
  min: number;
  max: number;
  previous: number;
}): number {
  const { textLength, measured, min, max, previous } = options;
  if (textLength === 0) return min;
  const clamped = clampComposerHeight(measured, min, max);
  if (clamped == null) return previous;
  return Math.abs(previous - clamped) < 2 ? previous : clamped;
}
