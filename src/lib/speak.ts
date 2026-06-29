import type { Frase } from '../data/types';

// Pronuncia di una frase. Preferisce una clip mp3 pre-registrata (offline, affidabile);
// se manca, ripiega sul TTS del browser (zh-CN) — utile in sviluppo, ma sul campo la
// sintesi cinese offline è inaffidabile, quindi le clip mp3 restano la strada giusta.
export function speak(f: Frase): void {
  if (f.audio) {
    const audio = new Audio(`/phrases/${f.audio}`);
    audio.play().catch(() => fallbackTTS(f.hanzi));
    return;
  }
  fallbackTTS(f.hanzi);
}

/** true se la frase ha una clip locale (m4a/mp3). */
export function hasLocalAudio(f: Frase): boolean {
  return !!f.audio;
}

function fallbackTTS(text: string): void {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
