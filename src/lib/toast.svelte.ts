export type ToastKind = 'ok' | 'info' | 'warn';

export interface ToastItem {
  id: number;
  msg: string;
  kind: ToastKind;
}

let nextId = 0;

export const toastState = $state<{ items: ToastItem[] }>({ items: [] });

export function showToast(msg: string, kind: ToastKind = 'ok', ms = 2400): void {
  const item: ToastItem = { id: ++nextId, msg, kind };
  toastState.items = [...toastState.items, item];
  setTimeout(() => {
    toastState.items = toastState.items.filter((t) => t.id !== item.id);
  }, ms);
}
