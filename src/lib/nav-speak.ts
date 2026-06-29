/** Annuncio vocale delle indicazioni (funziona offline su molti browser). */

let lastSpoken = '';

export function speakNavInstruction(text: string): void {
  if (!text || text === lastSpoken) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT';
    u.rate = 1.05;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
    lastSpoken = text;
  } catch {
    /* ignore */
  }
}

export function resetNavSpeech(): void {
  lastSpoken = '';
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}
