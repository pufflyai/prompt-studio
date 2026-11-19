/** Keep the guest's content height independent of the iframe viewport. */
export const observeContentHeight = (
  mount: HTMLElement,
  report: (height: number) => void,
  sizing: "content-height" | "bounded-height",
) => {
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
  resize.observe(mount);
  if (sizing === "content-height") return () => resize.disconnect();
  const mutations = new MutationObserver(measure);
  mutations.observe(mount, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "hidden"] });
  return () => {
    resize.disconnect();
    mutations.disconnect();
  };
};
