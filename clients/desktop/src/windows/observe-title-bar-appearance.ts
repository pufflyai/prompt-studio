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
  const observeTitleBar = () => {
    const titleBar = document.querySelector("[data-window-title-bar]");
    if (!titleBar) return false;
    size.observe(titleBar);
    sync();
    return true;
  };

  const theme = new MutationObserver(sync);
  for (const element of [document.documentElement, document.body]) {
    theme.observe(element, { attributes: true, attributeFilter: ["class", "style"] });
  }

  const mounted = new MutationObserver(() => {
    if (observeTitleBar()) mounted.disconnect();
  });
  if (!observeTitleBar()) mounted.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("focus", sync);

  return () => {
    mounted.disconnect();
    theme.disconnect();
    size.disconnect();
    window.removeEventListener("focus", sync);
  };
};
