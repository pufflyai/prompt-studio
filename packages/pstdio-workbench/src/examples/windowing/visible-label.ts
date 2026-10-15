export const isWindowingElementVisible = (node: HTMLElement) =>
  !node.closest("[inert]") && node.checkVisibility({ visibilityProperty: true, opacityProperty: true });

export const visibleWindowingLabel = (canvas: HTMLElement, label: string) => {
  const found = [...canvas.querySelectorAll<HTMLElement>("[aria-label]")].filter(
    (node) => node.getAttribute("aria-label") === label && isWindowingElementVisible(node),
  );
  if (found.length !== 1) throw new Error(`Expected one visible windowing label: ${label}; found ${found.length}`);
  return found[0]!;
};
