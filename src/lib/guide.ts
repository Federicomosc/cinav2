export interface GuideBlock {
  tag: string;
  text: string;
}

export interface GuideSection {
  title: string;
  blocks: GuideBlock[];
}

/** Divide la guida in panoramica iniziale + sezioni (da titoli h2). */
export function splitGuide(blocks: GuideBlock[]): { intro: GuideBlock[]; sections: GuideSection[] } {
  const intro: GuideBlock[] = [];
  const sections: GuideSection[] = [];
  let current: GuideSection | null = null;

  for (const b of blocks) {
    if (b.tag === 'h2') {
      current = { title: b.text, blocks: [] };
      sections.push(current);
    } else if (current) {
      current.blocks.push(b);
    } else {
      intro.push(b);
    }
  }

  return { intro, sections };
}
