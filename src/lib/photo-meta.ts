import exifr from 'exifr';
import { itinerario } from './content';
import { toIsoDay } from './format';
import type { CityId } from '../data/types';

export function cityForIsoDay(day: string): CityId | undefined {
  return itinerario.legs.find((l) => day >= l.from && day <= l.to)?.city;
}

export interface ParsedPhotoMeta {
  takenAt: number;
  lat?: number;
  lng?: number;
  day?: string;
  city?: CityId;
}

/** Legge EXIF/GPS e assegna giorno + città dal calendario del viaggio. */
export async function parsePhotoMeta(file: File): Promise<ParsedPhotoMeta> {
  let takenAt = file.lastModified || Date.now();
  let lat: number | undefined;
  let lng: number | undefined;

  try {
    const exif = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'latitude', 'longitude'],
    });
    if (exif) {
      const dt =
        exif.DateTimeOriginal ?? exif.CreateDate ?? exif.ModifyDate;
      if (dt instanceof Date && !Number.isNaN(dt.getTime())) {
        takenAt = dt.getTime();
      }
      if (typeof exif.latitude === 'number') lat = exif.latitude;
      if (typeof exif.longitude === 'number') lng = exif.longitude;
    }
  } catch {
    /* foto senza EXIF */
  }

  const day = toIsoDay(new Date(takenAt));
  const city = cityForIsoDay(day);

  return { takenAt, lat, lng, day, city };
}
