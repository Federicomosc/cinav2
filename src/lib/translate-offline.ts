import type { Frase } from '../data/types';
import type { LessicoEntry } from '../data/lessico';

export interface TranslateHit {
  it: string;
  hanzi: string;
  pinyin: string;
  score: number;
  source: 'frase' | 'lessico';
  showBig?: boolean;
  audio?: string;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s: string): string[] {
  return norm(s).split(' ').filter((t) => t.length > 1);
}

function hasHanzi(s: string): boolean {
  return /\p{Script=Han}/u.test(s);
}

function scorePhrase(query: string, qTok: string[], f: Frase): number {
  const it = norm(f.it);
  if (!it) return 0;
  if (it === query) return 100;
  if (query.length >= 3 && it.includes(query)) return 88;
  if (query.length >= 3 && query.includes(it)) return 82;

  const fTok = tokens(f.it);
  if (!qTok.length || !fTok.length) return 0;
  let overlap = 0;
  for (const t of qTok) {
    if (fTok.some((x) => x === t || x.includes(t) || t.includes(x))) overlap++;
  }
  if (!overlap) return 0;
  return 35 + overlap * 18 + (overlap === qTok.length ? 12 : 0);
}

function scoreLessico(query: string, qTok: string[], e: LessicoEntry): number {
  let best = 0;
  for (const kw of e.it) {
    const k = norm(kw);
    if (!k) continue;
    if (query === k) best = Math.max(best, 92);
    else if (query.includes(k) || k.includes(query)) best = Math.max(best, 75);
    else if (qTok.includes(k)) best = Math.max(best, 55);
    else if (qTok.some((t) => k.includes(t) || t.includes(k))) best = Math.max(best, 42);
  }
  return best;
}

/** Traduzione offline: cerca in frasario + dizionario lessicale (zero rete). */
export function translateOffline(
  raw: string,
  frasi: Frase[],
  lessico: LessicoEntry[],
  limit = 10,
): TranslateHit[] {
  const query = norm(raw);
  if (!query && !hasHanzi(raw)) return [];

  const hits = new Map<string, TranslateHit>();

  function add(hit: TranslateHit) {
    const key = hit.hanzi;
    const prev = hits.get(key);
    if (!prev || hit.score > prev.score) hits.set(key, hit);
  }

  if (hasHanzi(raw)) {
    const q = raw.trim();
    for (const f of frasi) {
      if (f.hanzi.includes(q) || q.includes(f.hanzi.replace(/[？?！!，,。.]/g, ''))) {
        add({
          it: f.it,
          hanzi: f.hanzi,
          pinyin: f.pinyin,
          score: f.hanzi === q ? 100 : 85,
          source: 'frase',
          showBig: f.showBig,
          audio: f.audio,
        });
      }
    }
    for (const e of lessico) {
      if (e.hanzi.includes(q) || q.includes(e.hanzi)) {
        add({
          it: e.it[0],
          hanzi: e.hanzi,
          pinyin: e.pinyin,
          score: e.hanzi === q ? 95 : 78,
          source: 'lessico',
        });
      }
    }
  }

  const qTok = tokens(query);
  for (const f of frasi) {
    const s = scorePhrase(query, qTok, f);
    if (s >= 40) {
      add({
        it: f.it,
        hanzi: f.hanzi,
        pinyin: f.pinyin,
        score: s,
        source: 'frase',
        showBig: f.showBig,
        audio: f.audio,
      });
    }
  }

  for (const e of lessico) {
    const s = scoreLessico(query, qTok, e);
    if (s >= 40) {
      add({
        it: e.it[0],
        hanzi: e.hanzi,
        pinyin: e.pinyin,
        score: s,
        source: 'lessico',
      });
    }
  }

  return [...hits.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
