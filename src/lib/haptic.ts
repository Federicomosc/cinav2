/** Breve feedback tattile su dispositivi che lo supportano. */
export function haptic(ms = 8): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}
