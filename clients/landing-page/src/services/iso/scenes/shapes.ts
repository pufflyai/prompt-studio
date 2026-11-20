import { addAgent, agentSays, carry, job, pat, raise, say, toss } from "../agents";
import { bars, cardFront, kindColor, stripes, wire, workbench } from "../greek";
import { clamp, pick } from "../motion";
import type { Agent, IsoBox, IsoScene } from "../scene";
import {
  type Area,
  cardY,
  columnWidth,
  columnX,
  LAYER_COLORS,
  SHAPE_LAYOUTS,
  type Shape,
  type ShapePart,
} from "./shape-layouts";

export const SHAPES_WORLD = { W: 380, D: 330, top: 140, bottom: 26 };

type Part = IsoBox & Omit<ShapePart, keyof IsoBox>;
type Token = IsoBox & { shape: Shape; tray: { x: number; y: number; z: number } };

const PLATE = { x: 100, y: 40, w: 200, d: 180 };
const AREA: Area = { x: PLATE.x + 32, y: PLATE.y + 16, w: PLATE.w - 38, d: PLATE.d - 28 };
const ORDER: Shape[] = ["board", "layers", "viewer", "dashboard"];
const PROMPTS: Record<Shape, string> = {
  board: "make it a ticket board",
  layers: "turn this into an image editor",
  viewer: "now a 3D viewer",
  dashboard: "show it as a dashboard",
};
const TOKENS: [Shape, number, number, number, number, number, string, string][] = [
  ["board", 334, 30, 30, 10, 40, kindColor("page"), cardFront()],
  ["layers", 332, 100, 32, 32, 18, kindColor("skill"), stripes()],
  ["viewer", 334, 176, 28, 28, 28, kindColor("editor"), ""],
  ["dashboard", 332, 256, 34, 18, 30, kindColor("automation"), bars()],
];
const PAUSE_AFTER_USER_MS = 6000;

/** One workbench, four shapes: agents work inside each shape, then swap in the next token. */
export const setupShapesScene = (scene: IsoScene) => {
  const plate = scene.add({ ...PLATE, h: 10, html: workbench() });
  plate.top.classList.add("g-filled");
  const [claude, opencode] = [
    addAgent(scene, { name: "Claude", color: "var(--chakra-colors-agent-claude)", x: 230, y: 290, z: 70 }),
    addAgent(scene, { name: "OpenCode", color: "var(--chakra-colors-agent-opencode)", x: 40, y: 120, z: 80 }),
  ];
  const tokens = TOKENS.map(([shape, x, y, w, d, h, color, side]) =>
    scene.add({
      shape,
      x,
      y,
      w,
      d,
      h,
      color,
      drag: true,
      tray: { x, y, z: 0 },
      home: { x, y, z: 0 },
      sideHtml: side,
      html: shape === "viewer" ? wire() : "",
    }),
  ) as Token[];
  for (const token of tokens) {
    token.click = () => {
      if (token !== active && !changing) void apply(token, "visitor");
    };
  }
  // The token for the current shape sits in a socket on the workbench, so it reads as applied.
  const socket = (token: Token) => ({
    x: PLATE.x + 14 - token.t.w / 2,
    y: PLATE.y + PLATE.d - 24 - token.t.d / 2,
    z: 10,
  });
  let parts: Part[] = [];
  let current: Shape = "board";
  let active = tokens[0];
  let changing = false;

  const build = (shape: Shape) => {
    current = shape;
    for (const part of parts) {
      part.drag = false;
      scene.fadeOut(part);
    }
    parts = [];
    SHAPE_LAYOUTS[shape](AREA).forEach((spec, i) => {
      setTimeout(
        () => {
          const part = scene.add({ ...spec, className: "iso-pop" }) as Part;
          part.z = (spec.z ?? 0) + 50;
          part.click = () => clickPart(part);
          parts.push(part);
        },
        160 + i * 45,
      );
    });
  };

  const apply = async (token: Token, by: Agent | "visitor") => {
    changing = true;
    if (active !== token) {
      active.home = active.tray;
      Object.assign(active.t, active.tray);
    }
    active = token;
    token.home = socket(token);
    Object.assign(token.t, token.home);
    build(token.shape);
    if (by === "visitor") {
      say(scene.hand.querySelector(".iso-bubble")!, PROMPTS[token.shape], 1800);
      agentSays(claude, "on it", 1100);
    } else agentSays(by, PROMPTS[token.shape], 1500);
    await scene.wait(900);
    changing = false;
    if (by === "visitor") raise(opencode);
  };

  active.home = socket(active);
  Object.assign(active.t, active.home);
  Object.assign(active, active.home);
  build("board");

  scene.targets.push({
    ...PLATE,
    accept: (box) => "shape" in box && box !== active && !changing,
    drop: (box) => apply(box as Token, "visitor"),
  });
  scene.onFree = (box) => {
    const part = box as Part;
    if (part.card) part.column = clamp(Math.floor((part.t.x + part.t.w / 2 - AREA.x) / (columnWidth(AREA) + 5)), 0, 2);
  };
  let lastBars = 0;
  scene.onTick = () => {
    const now = performance.now();
    if (now - lastBars < 1300) return;
    lastBars = now;
    for (const part of parts) if (part.bar && !part.carried) part.t.h = 18 + Math.random() * 64;
  };

  const restack = (column: number) => {
    parts
      .filter((part) => part.card && part.column === column && !part.carried)
      .sort((a, b) => a.t.y - b.t.y)
      .forEach((part, row) => {
        Object.assign(part.t, { x: columnX(AREA, column) + 4, y: cardY(AREA, row), z: 12 });
      });
  };

  // Each shape has its own small job the agents do between shape changes.
  const moveCard = async (agent: Agent) => {
    const cards = parts.filter((part) => part.card && !part.held && !part.carried);
    const movable = cards.filter((part) => (part.column ?? 0) < 2);
    const chosen = pick(movable.length ? movable : cards);
    if (!chosen) return;
    const from = chosen.column ?? 0;
    const to = movable.length ? from + 1 : 0;
    const row = cards.filter((part) => part.column === to && part !== chosen).length;
    const dest = { x: columnX(AREA, to) + 4, y: cardY(AREA, row), z: 12 };
    const moved = movable.length ? await carry(agent, chosen, dest, 26) : await toss(scene, agent, chosen, dest, 70);
    if (!moved) return;
    chosen.column = to;
    restack(from);
  };
  const recolorLayer = async (agent: Agent) => {
    const layer = pick(parts.filter((part) => part.layer && !part.held));
    if (!layer) return;
    await pat(scene, agent, layer, () => {
      layer.color = pick(LAYER_COLORS);
      scene.paint(layer);
    });
  };
  const throwCube = async (agent: Agent) => {
    const cube = pick(parts.filter((part) => part.cube && !part.held));
    if (!cube) return;
    const dest = {
      x: AREA.x + 8 + Math.random() * (AREA.w - cube.t.w - 16),
      y: AREA.y + 8 + Math.random() * (AREA.d - cube.t.d - 16),
      z: 12,
    };
    await toss(scene, agent, cube, dest, 80);
  };
  const raiseBar = async (agent: Agent) => {
    const bar = pick(parts.filter((part) => part.bar));
    if (!bar) return;
    await pat(scene, agent, bar, () => {
      bar.t.h = 92;
    });
  };
  // Clicking does by hand what the agents do: advance a card, recolor a layer, bounce the cube, raise a bar.
  const clickPart = (part: Part) => {
    if (part.card) {
      const from = part.column ?? 0;
      const to = (from + 1) % 3;
      const row = parts.filter((other) => other.card && other.column === to).length;
      Object.assign(part.t, { x: columnX(AREA, to) + 4, y: cardY(AREA, row), z: 12 });
      part.column = to;
      restack(from);
    } else if (part.layer) {
      part.color = pick(LAYER_COLORS.filter((color) => color !== part.color));
      scene.paint(part);
    } else if (part.cube) {
      part.liftT = 34;
      setTimeout(() => {
        part.liftT = part.restLift;
      }, 260);
    } else if (part.bar) part.t.h = 92;
  };
  const JOBS: Record<Shape, (agent: Agent) => Promise<void>> = {
    board: moveCard,
    layers: recolorLayer,
    viewer: throwCube,
    dashboard: raiseBar,
  };
  const tinker = (agent: Agent) => JOBS[current](agent);

  scene.run(async () => {
    await scene.wait(1200);
    for (;;) {
      await scene.awake();
      if (scene.userBusy(PAUSE_AFTER_USER_MS) || changing) {
        await scene.wait(400);
        continue;
      }
      const [first, second] = Math.random() < 0.5 ? [claude, opencode] : [opencode, claude];
      await Promise.all([
        job(first, () => tinker(first)),
        scene.wait(600).then(() => job(second, () => tinker(second))),
      ]);
      await scene.wait(500);
      await Promise.all([
        job(second, () => tinker(second)),
        scene.wait(500).then(() => job(first, () => tinker(first))),
      ]);
      await scene.wait(700);
      if (scene.userBusy(PAUSE_AFTER_USER_MS)) continue;
      const next = tokens.find((token) => token.shape === ORDER[(ORDER.indexOf(current) + 1) % ORDER.length])!;
      await job(first, async () => {
        if (await carry(first, next, socket(next), 40)) await apply(next, first);
      });
      await scene.wait(700);
    }
  });
};
