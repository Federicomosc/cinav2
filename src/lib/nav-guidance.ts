// Indicazioni turn-by-turn e avanzamento lungo un percorso — tutto offline.

import type { RouteStep } from './routing';

const WALK_MPS = 5 / 3.6;
const TURN_DEG = 28;
const MIN_STEP_M = 18;
const ARRIVE_M = 28;
const OFF_ROUTE_M = 55;

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

function toDeg(r: number) {
  return (r * 180) / Math.PI;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearingDeg(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function normalizeAngle(d: number): number {
  let a = d % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}

function compassIt(deg: number): string {
  const dirs = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ovest', 'ovest', 'nord-ovest'];
  return dirs[Math.round(deg / 45) % 8];
}

function turnIt(delta: number): string {
  const a = Math.abs(delta);
  if (a < TURN_DEG) return 'Prosegui dritto';
  const side = delta > 0 ? 'destra' : 'sinistra';
  if (a >= 150) return 'Inversione a U';
  if (a >= 75) return `Svolta stretta a ${side}`;
  if (a >= 45) return `Svolta a ${side}`;
  return `Leggermente a ${side}`;
}

/** Genera indicazioni pedonali da una polyline [lng,lat]. */
export function buildStepsFromCoordinates(coords: [number, number][]): RouteStep[] {
  if (coords.length < 2) {
    return coords.length
      ? [{ instruction: 'Sei arrivato', distanceM: 0, durationS: 0 }]
      : [];
  }

  const raw: { idx: number; instruction: string; distanceM: number }[] = [];
  const departBear = bearingDeg(coords[0][0], coords[0][1], coords[1][0], coords[1][1]);
  raw.push({
    idx: 0,
    instruction: `Parti verso ${compassIt(departBear)}`,
    distanceM: 0,
  });

  for (let i = 1; i < coords.length - 1; i++) {
    const prev = coords[i - 1];
    const cur = coords[i];
    const next = coords[i + 1];
    const segM = haversineM(prev[1], prev[0], cur[1], cur[0]);
    const bIn = bearingDeg(prev[0], prev[1], cur[0], cur[1]);
    const bOut = bearingDeg(cur[0], cur[1], next[0], next[1]);
    const delta = normalizeAngle(bOut - bIn);
    if (Math.abs(delta) >= TURN_DEG) {
      raw.push({ idx: i, instruction: turnIt(delta), distanceM: segM });
    } else if (segM >= MIN_STEP_M * 3) {
      raw.push({ idx: i, instruction: `Prosegui verso ${compassIt(bOut)}`, distanceM: segM });
    }
  }

  const steps: RouteStep[] = [];
  for (let i = 0; i < raw.length; i++) {
    const startIdx = raw[i].idx;
    const endIdx = i < raw.length - 1 ? raw[i + 1].idx : coords.length - 1;
    let distanceM = 0;
    for (let j = startIdx; j < endIdx; j++) {
      distanceM += haversineM(
        coords[j][1],
        coords[j][0],
        coords[j + 1][1],
        coords[j + 1][0],
      );
    }
    if (distanceM < MIN_STEP_M && i > 0 && i < raw.length - 1) continue;
    steps.push({
      instruction: raw[i].instruction,
      distanceM,
      durationS: distanceM / WALK_MPS,
    });
  }

  const totalM = pathDistanceM(coords);
  steps.push({
    instruction: 'Sei arrivato',
    distanceM: Math.max(0, totalM - steps.reduce((s, x) => s + x.distanceM, 0)),
    durationS: 0,
  });

  return steps.length ? steps : [{ instruction: 'Prosegui', distanceM: totalM, durationS: totalM / WALK_MPS }];
}

function pathDistanceM(coords: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    d += haversineM(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return d;
}

/** Distanza minima punto → polyline e indice del segmento più vicino. */
export function snapToRoute(
  coords: [number, number][],
  point: [number, number],
): { distanceM: number; segmentIdx: number; t: number } {
  if (coords.length < 2) {
    return {
      distanceM: coords.length
        ? haversineM(coords[0][1], coords[0][0], point[1], point[0])
        : Infinity,
      segmentIdx: 0,
      t: 0,
    };
  }

  let bestD = Infinity;
  let bestI = 0;
  let bestT = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const { dist, t } = pointToSegmentM(point, a, b);
    if (dist < bestD) {
      bestD = dist;
      bestI = i;
      bestT = t;
    }
  }

  return { distanceM: bestD, segmentIdx: bestI, t: bestT };
}

function pointToSegmentM(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): { dist: number; t: number } {
  const [plng, plat] = p;
  const [alng, alat] = a;
  const [blng, blat] = b;

  const dx = blng - alng;
  const dy = blat - alat;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((plng - alng) * dx + (plat - alat) * dy) / len2;
  t = Math.max(0, Math.min(1, t));

  const clng = alng + t * dx;
  const clat = alat + t * dy;
  return { dist: haversineM(plat, plng, clat, clng), t };
}

export interface NavProgress {
  stepIndex: number;
  distanceToStepM: number;
  distanceRemainingM: number;
  durationRemainingS: number;
  offRouteM: number;
  arrived: boolean;
  mapBearing: number;
  traversedM: number;
  segmentIdx: number;
}

function stepCumulativeEnds(steps: RouteStep[]): number[] {
  const ends: number[] = [];
  let acc = 0;
  for (const s of steps) {
    acc += s.distanceM;
    ends.push(acc);
  }
  return ends;
}

export function sliceRouteAt(
  coords: [number, number][],
  traversedM: number,
): { done: [number, number][]; remaining: [number, number][] } {
  if (coords.length < 2 || traversedM <= 0) {
    return { done: [], remaining: coords };
  }

  let acc = 0;
  const done: [number, number][] = [coords[0]];

  for (let i = 0; i < coords.length - 1; i++) {
    const seg = haversineM(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]);
    if (acc + seg >= traversedM) {
      const t = seg > 0 ? (traversedM - acc) / seg : 0;
      const lng = coords[i][0] + t * (coords[i + 1][0] - coords[i][0]);
      const lat = coords[i][1] + t * (coords[i + 1][1] - coords[i][1]);
      done.push([lng, lat]);
      const remaining: [number, number][] = [[lng, lat]];
      for (let j = i + 1; j < coords.length; j++) remaining.push(coords[j]);
      return { done, remaining };
    }
    acc += seg;
    done.push(coords[i + 1]);
  }

  return { done: coords, remaining: [coords[coords.length - 1]] };
}

export function computeNavProgress(
  coords: [number, number][],
  steps: RouteStep[] | undefined,
  user: [number, number],
  dest: [number, number],
): NavProgress {
  const destM = haversineM(user[1], user[0], dest[1], dest[0]);
  if (destM <= ARRIVE_M) {
    return {
      stepIndex: Math.max(0, (steps?.length ?? 1) - 1),
      distanceToStepM: 0,
      distanceRemainingM: 0,
      durationRemainingS: 0,
      offRouteM: 0,
      arrived: true,
      mapBearing: bearingDeg(user[0], user[1], dest[0], dest[1]),
      traversedM: pathDistanceM(coords),
      segmentIdx: Math.max(0, coords.length - 2),
    };
  }

  const snap = snapToRoute(coords, user);
  const offRouteM = snap.distanceM;

  let traversedM = 0;
  for (let i = 0; i < snap.segmentIdx; i++) {
    traversedM += haversineM(
      coords[i][1],
      coords[i][0],
      coords[i + 1][1],
      coords[i + 1][0],
    );
  }
  if (snap.segmentIdx < coords.length - 1) {
    const a = coords[snap.segmentIdx];
    const b = coords[snap.segmentIdx + 1];
    traversedM += haversineM(a[1], a[0], b[1], b[0]) * snap.t;
  }

  const totalM = pathDistanceM(coords);
  const distanceRemainingM = Math.max(0, totalM - traversedM);
  const durationRemainingS = distanceRemainingM / WALK_MPS;

  const stepList = steps?.length ? steps : buildStepsFromCoordinates(coords);
  const stepEnds = stepCumulativeEnds(stepList);

  let stepIndex = 0;
  for (let i = 0; i < stepEnds.length - 1; i++) {
    if (traversedM >= stepEnds[i] - MIN_STEP_M * 0.5) stepIndex = i + 1;
  }
  stepIndex = Math.min(stepIndex, stepList.length - 1);

  let distanceToStepM = 0;
  if (stepIndex < stepList.length - 1 && stepEnds[stepIndex] != null) {
    distanceToStepM = Math.max(0, stepEnds[stepIndex] - traversedM);
  } else if (stepIndex === 0 && stepList[0]?.distanceM) {
    distanceToStepM = Math.max(0, stepList[0].distanceM - traversedM);
  }

  const lookIdx = Math.min(snap.segmentIdx + 1, coords.length - 1);
  const mapBearing = bearingDeg(
    user[0],
    user[1],
    coords[lookIdx][0],
    coords[lookIdx][1],
  );

  return {
    stepIndex,
    distanceToStepM,
    distanceRemainingM,
    durationRemainingS,
    offRouteM,
    arrived: false,
    mapBearing,
    traversedM,
    segmentIdx: snap.segmentIdx,
  };
}

export function isOffRoute(offRouteM: number): boolean {
  return offRouteM > OFF_ROUTE_M;
}

function fmtDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function fmtDur(s: number): string {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function formatNavSummary(distanceM: number, durationS: number): string {
  return `${fmtDist(distanceM)} · ${fmtDur(durationS)}`;
}
