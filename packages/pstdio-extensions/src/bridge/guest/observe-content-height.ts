/** Keep the guest's content height independent of the iframe viewport. */
export const observeContentHeight = (mount: HTMLElement, report: (height: number) => void) => {
  mount.style.height = "auto";
  let previous = -1;
  const observer = new ResizeObserver(() => {
    const height = Math.ceil(mount.getBoundingClientRect().height);
    if (height === previous) return;
    previous = height;
    report(height);
  });
  observer.observe(mount);
  return () => observer.disconnect();
};
