export const observeContentHeight = (mount: HTMLElement, report: (height: number) => void) => {
  let height = -1;
  const update = () => {
    const next = Math.ceil(mount.getBoundingClientRect().height);
    if (next === height) return;
    height = next;
    report(height);
  };
  const observer = new ResizeObserver(update);
  observer.observe(mount);
  update();
  return () => observer.disconnect();
};
