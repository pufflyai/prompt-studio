import { clamp } from "./motion";
import { COS, type Origin, project, SIN, topMatrix } from "./projection";
import type { Agent, IsoBox } from "./types";

export interface Placer extends Origin {
  place: (el: HTMLElement, x: number, y: number, z: number, w: number, d: number) => void;
}

export const renderBox = (scene: Placer, box: IsoBox) => {
  const { x, y, w, d } = box;
  const z = box.z + box.lift;
  const h = Math.max(0, box.h);
  const face = (el: HTMLElement, width: number, height: number, transform: string) => {
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.transform = transform;
  };
  face(box.top, w, d, topMatrix(scene, x, y, z + h));
  let [ex, ey] = project(scene, x + w, y, z + h);
  face(box.right, d, h, `matrix(${-COS},${SIN},0,1,${ex},${ey})`);
  [ex, ey] = project(scene, x, y + d, z + h);
  face(box.front, w, h, `matrix(${COS},${SIN},0,1,${ex},${ey})`);
  if (box.lift > 1.5) {
    const grow = box.lift * 0.12;
    scene.place(box.shadow, x - grow, y - grow, box.z + 0.1, w + 2 * grow, d + 2 * grow);
    box.shadow.style.opacity = String(clamp(0.4 - box.lift * 0.006, 0.1, 0.4));
    box.shadow.style.filter = `blur(${2 + box.lift / 7}px)`;
  } else box.shadow.style.opacity = "0";
  if (box.plate) {
    const [px, py] = project(scene, x + w / 2, y + d / 2, z + h);
    box.plate.style.transform = `translate(${px}px,${py - 12}px) translate(-50%,-100%)`;
  }
};

export const renderAgent = (scene: Placer, agent: Agent, time: number) => {
  if (!agent.task) {
    if (!agent.wander || time > agent.nextWander) {
      const { home } = agent;
      agent.wander = [
        home.x + (Math.random() - 0.5) * 70,
        home.y + (Math.random() - 0.5) * 70,
        home.z + (Math.random() - 0.5) * 18,
      ];
      agent.nextWander = time + 1500 + Math.random() * 2000;
    }
    agent.x += (agent.wander[0] - agent.x) * 0.03;
    agent.y += (agent.wander[1] - agent.y) * 0.03;
    agent.z += (agent.wander[2] - agent.z) * 0.03;
  }
  const bob = agent.task || agent.held ? 0 : Math.sin(time / 600 + agent.phase) * 3;
  let [x, y, z] = agent.held ?? [agent.x, agent.y, agent.z];
  if (!agent.held && agent.offset) {
    const [ox, oy, oz] = agent.offset;
    [x, y, z] = [x + ox, y + oy, z + oz];
    agent.offset = Math.hypot(ox, oy, oz) < 0.5 ? undefined : [ox * 0.86, oy * 0.86, oz * 0.86];
  }
  const [sx, sy] = project(scene, x, y, z + bob + (agent.raised ? 8 : 0));
  agent.el.style.transform = `translate(${sx}px,${sy}px)`;
  scene.place(agent.shadow, x - 9, y - 9, 0, 18, 18);
  agent.shadow.style.opacity = agent.el.classList.contains("iso-away")
    ? "0"
    : String(clamp(0.9 - z * 0.008, 0.25, 0.9));
};

/** Height of whatever the box's center rests on, so a dropped box lands on top of it. */
export const supportHeight = (boxes: IsoBox[], box: IsoBox) => {
  const cx = box.t.x + box.t.w / 2;
  const cy = box.t.y + box.t.d / 2;
  let z = 0;
  for (const o of boxes) {
    if (o === box || o.held || o.carried || o.float) continue;
    if (cx >= o.t.x && cx <= o.t.x + o.t.w && cy >= o.t.y && cy <= o.t.y + o.t.d) z = Math.max(z, o.t.z + o.t.h);
  }
  return z;
};
