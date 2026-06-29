/** ID univoco per un'attività nel programma (IndexedDB `actChecks`). */
export function actId(dayN: number, label: string): string {
  return `d${dayN}:${label}`;
}
