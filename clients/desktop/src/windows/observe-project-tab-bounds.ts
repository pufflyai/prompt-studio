import type { Rectangle } from "electron";

const visibleTabBounds = (tabs: Element[], scale: number) => {
  const bounds: Rectangle[] = [];
  for (const tab of tabs) {
    const rect = tab.getBoundingClientRect();
    const clip = tab.closest('[role="tablist"]')?.getBoundingClientRect();
    if (!clip) continue;
    const left = Math.max(0, rect.left, clip.left);
    const top = Math.max(0, rect.top, clip.top);
    const right = Math.min(innerWidth, rect.right, clip.right);
    const bottom = Math.min(innerHeight, rect.bottom, clip.bottom);
    if (right <= left || bottom <= top) continue;
    // Covered tabs must not arm the native filter for a dialog or menu above them.
    if (!tab.contains(document.elementFromPoint((left + right) / 2, (top + bottom) / 2))) continue;
    bounds.push({ x: left * scale, y: top * scale, width: (right - left) * scale, height: (bottom - top) * scale });
  }
  return bounds;
};

export const observeProjectTabBounds = (zoomFactor: () => number, update: (bounds: Rectangle[]) => void) => {
  let titleBar: Element | null = null;
  let frame = 0;
  let previous = "";
  const observed = new Set<Element>();
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(sync);
  };
  const size = new ResizeObserver(schedule);
  const layout = new MutationObserver(schedule);
  const sync = () => {
    frame = 0;
    const current = document.querySelector("[data-window-title-bar]");
    if (current !== titleBar) {
      layout.disconnect();
      titleBar?.removeEventListener("scroll", schedule, true);
      titleBar = current;
      titleBar?.addEventListener("scroll", schedule, true);
      if (titleBar) layout.observe(titleBar, { subtree: true, childList: true, characterData: true, attributes: true });
    }
    const tabs = [...(titleBar?.querySelectorAll('[role="tab"]') ?? [])];
    const next = new Set<Element>([...(titleBar ? [titleBar] : []), ...tabs]);
    for (const element of observed) {
      if (next.has(element)) continue;
      size.unobserve(element);
      observed.delete(element);
    }
    for (const element of next) {
      if (observed.has(element)) continue;
      size.observe(element);
      observed.add(element);
    }
    const bounds = visibleTabBounds(tabs, zoomFactor());
    const signature = JSON.stringify(bounds);
    if (signature !== previous) {
      previous = signature;
      update(bounds);
    }
  };
  const mounted = new MutationObserver(schedule);
  mounted.observe(document.body, { childList: true, subtree: true });
  const fullScreen = new MutationObserver(schedule);
  fullScreen.observe(document.documentElement, { attributes: true, attributeFilter: ["data-window-full-screen"] });
  window.addEventListener("resize", schedule);
  window.addEventListener("focus", schedule);
  sync();
  return () => {
    cancelAnimationFrame(frame);
    size.disconnect();
    layout.disconnect();
    mounted.disconnect();
    fullScreen.disconnect();
    titleBar?.removeEventListener("scroll", schedule, true);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("focus", schedule);
    update([]);
  };
};
