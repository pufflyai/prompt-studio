import { tween, wait } from "./motion";
import type { Agent, IsoBox, IsoScene } from "./scene";
import { div } from "./types";

type Point = { x: number; y: number; z?: number; ms?: number };

const OPEN = "🖐️";
const PINCH = "🤏";
const RAISED = "✋";

const swing = (el: HTMLElement, dx: number, dy: number, turn: number) =>
  el.animate(
    [
      { transform: "translate(-50%,-55%)" },
      {
        transform: `translate(calc(-50% + ${dx}px),calc(-55% + ${dy}px)) rotate(${turn}deg) scale(1.25)`,
        offset: 0.45,
      },
      { transform: "translate(-50%,-55%)" },
    ],
    { duration: 480, easing: "cubic-bezier(.3,1.4,.5,1)" },
  );

export const setIcon = (agent: Agent, icon: string) => {
  agent.icon.textContent = icon;
};

export const addAgent = (scene: IsoScene, spec: Pick<Agent, "name" | "color" | "x" | "y" | "z">) => {
  const el = div(
    "iso-hand iso-agent",
    `<span class="iso-ring"></span><span class="iso-icon">${OPEN}</span><span class="iso-tag">${spec.name}</span><span class="iso-bubble"></span>`,
  );
  el.style.setProperty("--iso-agent", spec.color);
  const agent: Agent = {
    ...spec,
    home: { x: spec.x, y: spec.y, z: spec.z },
    phase: Math.random() * 6,
    task: false,
    raised: false,
    nextWander: 0,
    el,
    icon: el.querySelector(".iso-icon")!,
    shadow: div("iso-face iso-agent-shadow"),
  };
  el.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    highFive(scene, agent);
  });
  scene.attachAgent(agent);
  return agent;
};

/** Marks the agent busy so it stops wandering while `work` runs. */
export const job = async <T>(agent: Agent, work: () => Promise<T>) => {
  agent.task = true;
  try {
    return await work();
  } finally {
    agent.task = false;
    agent.wander = undefined;
  }
};

export const moveAgent = (agent: Agent, x: number, y: number, z: number, ms = 600) => {
  const [x0, y0, z0] = [agent.x, agent.y, agent.z];
  return tween(ms, (k) => {
    agent.x = x0 + (x - x0) * k;
    agent.y = y0 + (y - y0) * k;
    agent.z = z0 + (z - z0) * k;
  });
};

export const say = (bubble: Element, text: string, ms = 2000) => {
  const el = bubble as HTMLElement & { hideTimer?: number };
  el.textContent = text;
  el.classList.add("iso-on");
  clearTimeout(el.hideTimer);
  el.hideTimer = window.setTimeout(() => el.classList.remove("iso-on"), ms);
};

export const agentSays = (agent: Agent, text: string, ms?: number) =>
  say(agent.el.querySelector(".iso-bubble")!, text, ms);

export const puff = (scene: IsoScene, x: number, y: number, z: number) => {
  const [sx, sy] = scene.P(x, y, z);
  const fx = div(
    "iso-fx",
    Array.from({ length: 5 }, (_, i) => {
      const angle = (i / 5) * Math.PI * 2;
      return `<i style="--dx:${Math.cos(angle) * 15}px;--dy:${Math.sin(angle) * 7}px"></i>`;
    }).join(""),
  );
  fx.style.transform = `translate(${sx}px,${sy}px)`;
  scene.ui.append(fx);
  setTimeout(() => fx.remove(), 650);
};

const burst = (scene: IsoScene, sx: number, sy: number) => {
  const sparks = Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 2;
    return `<b style="--dx:${Math.cos(angle) * 22}px;--dy:${Math.sin(angle) * 22}px">✦</b>`;
  }).join("");
  const fx = div("iso-fx", `<b class="iso-clap">👏</b>${sparks}`);
  fx.style.transform = `translate(${sx}px,${sy}px)`;
  scene.ui.append(fx);
  setTimeout(() => fx.remove(), 900);
};

export const highFive = (scene: IsoScene, agent: Agent) => {
  scene.lastUser = performance.now();
  agent.raised = false;
  setIcon(agent, RAISED);
  const [ax, ay] = scene.P(agent.x, agent.y, agent.z);
  const [ux, uy] = scene.pointer ?? [ax - 40, ay - 12];
  const [dx, dy] = [(ux - ax) * 0.5, (uy - ay) * 0.5];
  swing(agent.icon, dx, dy, -18);
  swing(scene.hand.querySelector(".iso-icon")!, -dx * 0.6, -dy * 0.6, 18);
  setTimeout(() => burst(scene, ax + dx, ay + dy), 210);
  setTimeout(() => setIcon(agent, agent.task ? PINCH : OPEN), 520);
};

export const agentFive = async (scene: IsoScene, a: Agent, b: Agent) => {
  if (a.task || b.task) return;
  a.task = b.task = true;
  const [mx, my, mz] = [(a.x + b.x) / 2, (a.y + b.y) / 2, Math.max(a.z, b.z)];
  setIcon(a, RAISED);
  setIcon(b, RAISED);
  await Promise.all([moveAgent(a, mx + 12, my - 12, mz, 520), moveAgent(b, mx - 12, my + 12, mz, 520)]);
  swing(a.icon, 0, 0, -18);
  swing(b.icon, 0, 0, 18);
  const [sx, sy] = scene.P(mx, my, mz + 8);
  setTimeout(() => burst(scene, sx, sy), 160);
  await wait(420);
  setIcon(a, OPEN);
  setIcon(b, OPEN);
  a.task = b.task = false;
  a.wander = b.wander = undefined;
};

/** Lifts the agent's hand for a moment so the visitor can high five it. */
export const raise = (agent: Agent) => {
  agent.raised = true;
  setIcon(agent, RAISED);
  agent.el.classList.add("iso-raised");
  setTimeout(() => {
    agent.raised = false;
    agent.el.classList.remove("iso-raised");
    if (!agent.task) setIcon(agent, OPEN);
  }, 2200);
};

const aboveBox = (agent: Agent, box: IsoBox, gap: number, ms: number) =>
  moveAgent(agent, box.x + box.w / 2, box.y + box.d / 2, box.z + box.lift + box.h + gap, ms);

/** Picks up `box` and walks it to `dest`; returns false if the visitor took it first. */
export const carry = async (agent: Agent, box: IsoBox, dest: Point, arc = 0) => {
  await aboveBox(agent, box, 12, 480);
  if (box.held || box.carried) return false;
  box.carried = true;
  const floated = box.float;
  box.float = false;
  box.liftT = 22;
  setIcon(agent, PINCH);
  let lost = false;
  const [x0, y0, z0] = [box.t.x, box.t.y, box.t.z];
  const z1 = dest.z ?? z0;
  await tween(dest.ms ?? 950, (k) => {
    // The visitor can snatch the box out of the hand; the hand then stops where it is.
    lost ||= box.held;
    if (lost) return;
    box.t.x = x0 + (dest.x - x0) * k;
    box.t.y = y0 + (dest.y - y0) * k;
    box.t.z = z0 + (z1 - z0) * k + arc * 4 * k * (1 - k);
    agent.x = box.t.x + box.t.w / 2;
    agent.y = box.t.y + box.t.d / 2;
    agent.z = box.t.z + box.liftT + box.t.h + 12;
  });
  setIcon(agent, OPEN);
  box.float = floated;
  if (lost) return false;
  box.liftT = box.restLift;
  box.carried = false;
  return true;
};

/** Picks up `box` and throws it in an arc to `dest`. */
export const toss = async (scene: IsoScene, agent: Agent, box: IsoBox, dest: Point, arc = 70) => {
  await aboveBox(agent, box, 12, 460);
  if (box.held || box.carried) return false;
  box.carried = true;
  box.liftT = 14;
  setIcon(agent, PINCH);
  let lost = false;
  await wait(180);
  const [ax, ay] = [agent.x, agent.y];
  const dx = dest.x + box.t.w / 2 - ax;
  const dy = dest.y + box.t.d / 2 - ay;
  const length = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [dx / length, dy / length];
  await tween(170, (k) => {
    lost ||= box.held;
    if (lost) return;
    agent.x = ax - ux * 10 * k;
    agent.y = ay - uy * 10 * k;
    box.t.x = agent.x - box.t.w / 2;
    box.t.y = agent.y - box.t.d / 2;
  });
  setIcon(agent, OPEN);
  tween(260, (k) => {
    agent.x = ax - ux * 10 + ux * 34 * k;
    agent.y = ay - uy * 10 + uy * 34 * k;
  });
  const [x0, y0, z0] = [box.t.x, box.t.y, box.t.z];
  const z1 = dest.z ?? 0;
  await tween(dest.ms ?? 760, (k) => {
    lost ||= box.held;
    if (lost) return;
    box.t.x = x0 + (dest.x - x0) * k;
    box.t.y = y0 + (dest.y - y0) * k;
    box.t.z = z0 + (z1 - z0) * k + arc * 4 * k * (1 - k);
  });
  if (lost) return false;
  box.carried = false;
  box.liftT = box.restLift;
  box.lift = box.restLift;
  box.h = box.t.h * 0.5;
  puff(scene, dest.x + box.t.w / 2, dest.y + box.t.d / 2, z1);
  return true;
};

/** Pats `box` from above; `change` runs on each impact so the box can reshape. */
export const pat = async (scene: IsoScene, agent: Agent, box: IsoBox, change: (box: IsoBox) => void = () => {}) => {
  const top = () => box.t.z + box.t.h;
  await moveAgent(agent, box.t.x + box.t.w / 2, box.t.y + box.t.d / 2, top() + 26, 380);
  await moveAgent(agent, agent.x, agent.y, top() + 7, 90);
  // A box pulled out from under the hand keeps its shape.
  if (!box.held) {
    change(box);
    box.h = Math.max(1, box.h * 0.55);
    puff(scene, agent.x, agent.y, top());
  }
  await moveAgent(agent, agent.x, agent.y, top() + 26, 160);
  await wait(220);
};

/** The agent's hand gives way to a small code window while it writes `lines`. */
export const code = async (
  scene: IsoScene,
  agent: Agent,
  file: string,
  lines: string[],
  progress?: (k: number) => void,
) => {
  const [sx, sy] = scene.P(agent.x, agent.y, agent.z);
  const editor = div("iso-code", `<div class="iso-code-head"><i></i>${agent.name} · ${file}</div><pre></pre>`);
  editor.style.setProperty("--iso-agent", agent.color);
  editor.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-60%)`;
  scene.ui.append(editor);
  agent.el.classList.add("iso-coding");
  requestAnimationFrame(() => editor.classList.add("iso-on"));
  const pre = editor.querySelector("pre")!;
  const text = lines.join("\n");
  for (let i = 0; i < text.length; i++) {
    pre.textContent += text[i];
    progress?.((i + 1) / text.length);
    await wait(text[i] === "\n" ? 110 : 24);
  }
  await wait(300);
  editor.classList.remove("iso-on");
  agent.el.classList.remove("iso-coding");
  setTimeout(() => editor.remove(), 350);
};
