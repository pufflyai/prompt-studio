/** Keep the guest's content height independent of the iframe viewport. */
export const observeContentHeight = (mount: HTMLElement, report: (height: number) => void) => {
  mount.style.height = "auto";
  let previous = -1;
  const measure = () => {
    const height = Math.ceil(mount.getBoundingClientRect().height);
    if (height === previous) return;
    previous = height;
    report(height);
  };
  const resize = new ResizeObserver(measure);
  // Clipped frames can defer resize delivery. DOM changes must still reveal newly mounted content.
  const mutations = new MutationObserver(measure);
  resize.observe(mount);
  mutations.observe(mount, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "hidden"] });
  return () => {
    resize.disconnect();
    mutations.disconnect();
  };
};
