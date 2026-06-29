import type { MetroCityData, MetroLine, MetroStation } from './metro';

export interface MetroRouteLeg {
  line: MetroLine;
  stations: MetroStation[];
}

export interface MetroRoutePlan {
  from: MetroStation;
  to: MetroStation;
  legs: MetroRouteLeg[];
  path: MetroStation[];
  transfers: number;
  stops: number;
}

function stationMap(data: MetroCityData): Map<string, MetroStation> {
  return new Map(data.stations.map((s) => [s.id, s]));
}

function buildGraph(data: MetroCityData): Map<string, Set<string>> {
  const g = new Map<string, Set<string>>();
  function link(a: string, b: string) {
    if (!g.has(a)) g.set(a, new Set());
    if (!g.has(b)) g.set(b, new Set());
    g.get(a)!.add(b);
    g.get(b)!.add(a);
  }
  for (const line of data.lines) {
    const ids = line.stationIds;
    for (let i = 0; i < ids.length - 1; i++) link(ids[i], ids[i + 1]);
  }
  return g;
}

function bfsPath(graph: Map<string, Set<string>>, fromId: string, toId: string): string[] | null {
  if (fromId === toId) return [fromId];
  const prev = new Map<string, string>();
  const q = [fromId];
  prev.set(fromId, '');
  while (q.length) {
    const cur = q.shift()!;
    for (const next of graph.get(cur) ?? []) {
      if (prev.has(next)) continue;
      prev.set(next, cur);
      if (next === toId) {
        const path: string[] = [];
        let n: string | undefined = toId;
        while (n) {
          path.unshift(n);
          n = prev.get(n) || undefined;
          if (n === '') break;
        }
        return path;
      }
      q.push(next);
    }
  }
  return null;
}

function lineForEdge(
  data: MetroCityData,
  a: string,
  b: string,
  preferLineId?: string,
): MetroLine | undefined {
  const candidates = data.lines.filter((line) => {
    const ia = line.stationIds.indexOf(a);
    const ib = line.stationIds.indexOf(b);
    return ia >= 0 && ib >= 0 && Math.abs(ia - ib) === 1;
  });
  if (!candidates.length) return undefined;
  if (preferLineId) {
    const pref = candidates.find((c) => c.id === preferLineId);
    if (pref) return pref;
  }
  return candidates[0];
}

function pathToLegs(pathIds: string[], data: MetroCityData): MetroRouteLeg[] {
  if (pathIds.length < 2) return [];
  const byId = stationMap(data);
  const legs: MetroRouteLeg[] = [];
  let line = lineForEdge(data, pathIds[0], pathIds[1]);
  if (!line) return [];
  let legIds = [pathIds[0], pathIds[1]];

  for (let i = 1; i < pathIds.length - 1; i++) {
    const a = pathIds[i];
    const b = pathIds[i + 1];
    const nextLine = lineForEdge(data, a, b, line.id);
    if (!nextLine) continue;
    if (nextLine.id !== line.id) {
      legs.push({
        line,
        stations: legIds.map((id) => byId.get(id)!).filter(Boolean),
      });
      line = nextLine;
      legIds = [a];
    }
    legIds.push(b);
  }
  legs.push({
    line,
    stations: legIds.map((id) => byId.get(id)!).filter(Boolean),
  });
  return legs.filter((l) => l.stations.length >= 2);
}

/** Percorso metro offline (meno fermate, con cambi). */
export function planMetroRoute(
  data: MetroCityData,
  fromId: string,
  toId: string,
): MetroRoutePlan | null {
  if (!data.hasMetro || fromId === toId) return null;
  const byId = stationMap(data);
  const from = byId.get(fromId);
  const to = byId.get(toId);
  if (!from || !to) return null;

  const graph = buildGraph(data);
  const pathIds = bfsPath(graph, fromId, toId);
  if (!pathIds || pathIds.length < 2) return null;

  const legs = pathToLegs(pathIds, data);
  if (!legs.length) return null;

  const path = pathIds.map((id) => byId.get(id)!).filter(Boolean);
  return {
    from,
    to,
    legs,
    path,
    transfers: Math.max(0, legs.length - 1),
    stops: pathIds.length - 1,
  };
}

export function filterMetroStations(stations: MetroStation[], query: string): MetroStation[] {
  const q = query.trim().toLowerCase();
  if (!q) return stations;
  return stations.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.nameLocal.includes(q) ||
      s.lines.some((n) => n.includes(q)),
  );
}

export function metroRouteInstructions(plan: MetroRoutePlan): string[] {
  const lines: string[] = [];
  for (let i = 0; i < plan.legs.length; i++) {
    const leg = plan.legs[i];
    const start = leg.stations[0];
    const end = leg.stations[leg.stations.length - 1];
    const n = leg.stations.length - 1;
    lines.push(
      `Prendi la ${leg.line.name} (${leg.line.nameLocal}) da ${start.nameLocal} · ${start.name} verso ${end.nameLocal} · ${end.name} (${n} ${n === 1 ? 'fermata' : 'fermate'})`,
    );
    if (i < plan.legs.length - 1) {
      const hub = leg.stations[leg.stations.length - 1];
      const next = plan.legs[i + 1].line;
      lines.push(
        `Scendi a ${hub.nameLocal} · ${hub.name} e cambia sulla ${next.name} (${next.nameLocal})`,
      );
    }
  }
  lines.push(`Arrivo a ${plan.to.nameLocal} · ${plan.to.name}`);
  return lines;
}
