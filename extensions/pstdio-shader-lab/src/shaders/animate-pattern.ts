// Dash offset cannot run on the compositor. Only this shader subscribes to clock ticks.
export const animateOutline = (root: HTMLElement, speed: number, time: number) => {
  root.querySelector('[data-motion="outline"]')?.setAttribute("stroke-dashoffset", String(-time * speed));
};
