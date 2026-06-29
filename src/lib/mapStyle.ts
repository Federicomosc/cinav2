// Stile MapLibre offline: Protomaps dark + etichette EN, palette allineata all'app.

import { layersWithPartialCustomTheme } from 'protomaps-themes-base';
import type { StyleSpecification } from 'maplibre-gl';

/** Stile vettoriale locale da `public/tiles/cina.pmtiles`. */
export function offlineMapStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'Cina Tour — offline',
    glyphs: '/fonts/{fontstack}/{range}.pbf',
    sources: {
      protomaps: {
        type: 'vector',
        url: 'pmtiles:///tiles/cina.pmtiles',
        attribution:
          '<a href="https://openstreetmap.org">OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>',
      },
    },
    layers: layersWithPartialCustomTheme(
      'protomaps',
      'dark',
      {
        background: '#0f0c09',
        earth: '#14110d',
        water: '#0c1820',
        park_a: '#152218',
        park_b: '#121c16',
        buildings: '#1c1814',
        minor_a: '#2a2520',
        minor_b: '#322c26',
        major: '#3d3530',
        highway: '#4a4038',
        boundaries: '#5c4f42',
        city_label: '#e8dfd0',
        city_label_halo: '#0f0c09',
        subplace_label: '#c4b8a8',
        subplace_label_halo: '#0f0c09',
        roads_label_minor: '#a89a88',
        roads_label_major: '#d4c8b8',
        roads_label_minor_halo: '#0f0c09',
        roads_label_major_halo: '#0f0c09',
      },
      'en',
    ),
  };
}
