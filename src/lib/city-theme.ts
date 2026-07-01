import type { CityId } from '../data/types';
import { poiImageSrc } from './poiImage';

export interface CityTheme {
  id?: CityId;
  accent: string;
  icon: string;
  hanzi: string;
  coverPoi: string;
}

export const CITY_THEME: Record<CityId, CityTheme> = {
  // Accenti "gioiello imperiale": tonalità profonde e sature, un'identità per
  // città ma tutte in dialogo con la lacca vermiglia e l'oro dell'app.
  chengdu: { id: 'chengdu', accent: '#2f9e6c', icon: '🐼', hanzi: '成都', coverPoi: 'panda-base' },
  chongqing: { id: 'chongqing', accent: '#d23a24', icon: '🌶️', hanzi: '重庆', coverPoi: 'hongya' },
  zhangjiajie: { id: 'zhangjiajie', accent: '#1f9aa0', icon: '⛰️', hanzi: '张家界', coverPoi: 'avatar-park' },
  pechino: { id: 'pechino', accent: '#d6a43e', icon: '🏯', hanzi: '北京', coverPoi: 'forbidden-city' },
  shanghai: { id: 'shanghai', accent: '#8a5bc9', icon: '🌃', hanzi: '上海', coverPoi: 'bund' },
};

export const CITY_BY_IT_NAME: Record<string, CityId> = {
  Chengdu: 'chengdu',
  Chongqing: 'chongqing',
  Zhangjiajie: 'zhangjiajie',
  Pechino: 'pechino',
  Shanghai: 'shanghai',
};

export const TRAVEL_THEME: CityTheme = {
  accent: '#8a7d6e',
  icon: '✈️',
  hanzi: '行',
  coverPoi: '',
};

export function cityTheme(id: CityId | string | undefined): CityTheme {
  if (id && id in CITY_THEME) return CITY_THEME[id as CityId];
  return TRAVEL_THEME;
}

export function cityThemeByItalianName(name: string): CityTheme {
  const id = CITY_BY_IT_NAME[name];
  return id ? CITY_THEME[id] : TRAVEL_THEME;
}

export function cityCoverSrc(id: CityId): string {
  const poi = CITY_THEME[id]?.coverPoi;
  return poi ? poiImageSrc(poi) : '';
}
