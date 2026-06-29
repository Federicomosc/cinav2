/** Percorso immagine POI in `public/places/`. */
export function poiImageSrc(id: string, ext: 'jpg' | 'webp' | 'svg' = 'jpg'): string {
  return `/places/${id}.${ext}`;
}
