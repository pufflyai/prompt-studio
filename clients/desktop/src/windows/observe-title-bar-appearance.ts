interface TitleBarAppearance {
  color: string;
  symbolColor: string;
}

// The renderer owns theme colors. Native controls must follow the rendered theme,
// which can differ from the operating system theme.
export const observeTitleBarAppearance = (update: (appearance: TitleBarAppearance) => void) => {
  const sync = () => {
    const titleBar = document.querySelector("[data-window-title-bar]");
    if (!titleBar) return;
    const style = getComputedStyle(titleBar);
    update({ color: style.backgroundColor, symbolColor: style.color });
  };

  const theme = new MutationObserver(sync);
  for (const element of [document.documentElement, document.body]) {
    theme.observe(element, { attributes: true, attributeFilter: ["class", "style"] });
  }

  const mounted = new MutationObserver(() => {
    if (!document.querySelector("[data-window-title-bar]")) return;
    sync();
    mounted.disconnect();
  });
  mounted.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("focus", sync);
  sync();

  return () => {
    mounted.disconnect();
    theme.disconnect();
    window.removeEventListener("focus", sync);
  };
};
