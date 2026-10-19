// A sandboxed iframe cannot expose its intrinsic width to the host's flex layout.
// Measure the mount at max-content so resizing the iframe cannot feed back into it.
export const observeContentWidth = (mount: HTMLElement, report: (width: number) => void) => {
  mount.style.width = "max-content";
  let previous = -1;
  const observer = new ResizeObserver(() => {
    const width = Math.ceil(mount.getBoundingClientRect().width);
    if (width === previous) return;
    previous = width;
    report(width);
  });
  observer.observe(mount);
  return () => observer.disconnect();
};
