/** Acquisizione posizione GPS per la navigazione. */

export type GpsPoint = { lng: number; lat: number; heading: number | null };

export function ensureGeolocation(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/** Attende una posizione GPS (alta precisione). */
export function waitForPosition(timeoutMs = 18_000): Promise<GpsPoint | null> {
  if (!ensureGeolocation()) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (p: GpsPoint | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(p);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        finish({
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
          heading:
            typeof pos.coords.heading === 'number' && !Number.isNaN(pos.coords.heading)
              ? pos.coords.heading
              : null,
        });
      },
      () => finish(null),
      { enableHighAccuracy: true, timeout: timeoutMs - 500, maximumAge: 0 },
    );
  });
}
