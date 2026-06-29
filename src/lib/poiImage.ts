/** Percorso immagine POI in `public/places/` (jpg/webp/svg). */
export function poiImageSrc(id: string, ext: 'jpg' | 'webp' | 'svg' = 'jpg'): string {
  return `/places/${id}.${ext}`;
}
