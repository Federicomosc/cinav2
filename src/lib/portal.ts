/** Monta un nodo su document.body (modali sopra scroll/transform dell'app). */
export function portal(node: HTMLElement) {
  document.body.appendChild(node);
  return {
    destroy() {
      node.remove();
    },
  };
}
