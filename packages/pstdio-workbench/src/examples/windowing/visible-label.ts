export const visibleWindowingLabel = (canvas: HTMLElement, label: string) => {
  const found = [...canvas.querySelectorAll<HTMLElement>("[aria-label]")].find(
    (node) => node.getAttribute("aria-label") === label && node.checkVisibility(),
  );
  if (!found) throw new Error(`Visible windowing label not found: ${label}`);
  return found;
};
