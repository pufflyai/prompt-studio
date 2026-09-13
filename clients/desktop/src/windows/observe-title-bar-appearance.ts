import type { TitleBarAppearance } from "./title-bar-appearance";

// The renderer owns the title bar dimensions and theme. Native controls must
// share that geometry so their icons stay centered beside the project tabs.
export const observeTitleBarAppearance = (update: (appearance: TitleBarAppearance) => void) => {
  const sync = () => {
    const titleBar = document.querySelector("[data-window-title-bar]");
    if (!titleBar) return;
    const style = getComputedStyle(titleBar);
    update({ color: style.backgroundColor, symbolColor: style.color, height: titleBar.clientHeight });
  };

  const size = new ResizeObserver(sync);
  let observedTitleBar: Element | null = null;
  const observeTitleBar = () => {
    const titleBar = document.querySelector("[data-window-title-bar]");
    if (titleBar === observedTitleBar) return;
    size.disconnect();
    observedTitleBar = titleBar;
    if (titleBar) size.observe(titleBar);
    sync();
  };

  const theme = new MutationObserver(sync);
  for (const element of [document.documentElement, document.body]) {
    theme.observe(element, { attributes: true, attributeFilter: ["class", "style"] });
  }

  const mounted = new MutationObserver(observeTitleBar);
  mounted.observe(document.body, { childList: true, subtree: true });
  observeTitleBar();
  window.addEventListener("focus", sync);

  return () => {
    mounted.disconnect();
    theme.disconnect();
    size.disconnect();
    window.removeEventListener("focus", sync);
  };
};
