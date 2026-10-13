export const visibleWindowingLabel = (canvas: HTMLElement, label: string) => {
  const found = [...canvas.querySelectorAll<HTMLElement>("[aria-label]")].filter(
    (node) => node.getAttribute("aria-label") === label && node.checkVisibility(),
  );
  if (found.length !== 1) throw new Error(`Expected one visible windowing label: ${label}; found ${found.length}`);
  return found[0]!;
};
