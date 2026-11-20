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
  const bob = agent.task ? 0 : Math.sin(time / 600 + agent.phase) * 3;
  const [sx, sy] = project(scene, agent.x, agent.y, agent.z + bob + (agent.raised ? 8 : 0));
  agent.el.style.transform = `translate(${sx}px,${sy}px)`;
  scene.place(agent.shadow, agent.x - 9, agent.y - 9, 0, 18, 18);
  agent.shadow.style.opacity = String(clamp(0.9 - agent.z * 0.008, 0.25, 0.9));
};
