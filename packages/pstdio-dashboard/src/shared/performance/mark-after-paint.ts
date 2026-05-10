export function markAfterPaint(name: string) {
  if (typeof performance === "undefined" || typeof requestAnimationFrame === "undefined") return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      performance.mark(name);
    });
  });
}
