import { addAgent, agentFive, carry, code, job, moveAgent, raise } from "../agents";
import { file, type ToolKind, tool, workbench } from "../greek";
import { pick, shuffle } from "../motion";
import type { Agent, IsoBox, IsoScene } from "../scene";

export const WHY_WORLD = { W: 420, D: 360, top: 90, bottom: 28 };

type AgentFile = [name: string, tool: string, kind: ToolKind, lines: string[]];
type Island = IsoBox & { file: AgentFile; born: number; placed: boolean; claimed: boolean };

const FILES: AgentFile[] = [
  [
    "invoice-check.py",
    "Invoice checker",
    "command",
    ["def check(invoice):", "  total = sum(invoice.lines)", "  return total == invoice.due"],
  ],
  [
    "report.html",
    "Weekly report",
    "page",
    ["<h1>Weekly report</h1>", '<canvas id="sales"></canvas>', '<script src="chart.js">'],
  ],
  ["localhost:3000", "Pricing dashboard", "editor", ['app.get("/prices", list)', "app.listen(3000)"]],
  ["prices.ipynb", "Price explorer", "skill", ['df = load("prices.csv")', 'df.groupby("month").plot()']],
  ["digest.sh", "Monday digest", "automation", ["#!/bin/sh", 'curl "$FEED" | summarize', "# cron: 0 9 * * 1"]],
  ["scrape-reviews.js", "Review scraper", "command", ["const page = await fetch(url)", "reviews.push(...parse(page))"]],
];
const SPOTS: [number, number][] = [
  [8, 18],
  [186, 4],
  [352, 64],
  [348, 252],
  [176, 300],
  [4, 236],
  [24, 120],
  [298, 6],
];
const PLATE = { x: 130, y: 110, w: 170, d: 140 };
// Fast-forwarded time: a day passes every 110 ms, so a file looks forgotten within seconds.
const DAY_MS = 110;

const ago = (days: number) => {
  if (days < 1) return "just now";
  if (days < 7) return `${Math.floor(days)} day${days >= 2 ? "s" : ""} ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days >= 14 ? "s" : ""} ago`;
  return `${Math.floor(days / 30)} month${days >= 60 ? "s" : ""} ago`;
};

/** Agents code files that pile up and age, then the workbench rises and gives each one a home. */
export const setupWhyScene = (scene: IsoScene) => {
  const plate = scene.add({ ...PLATE, h: 0, html: workbench() });
  plate.el.classList.add("iso-hidden");
  const slots = Array.from({ length: 6 }, (_, i) => ({
    x: 162 + (i % 3) * 44,
    y: 128 + Math.floor(i / 3) * 58,
    w: 40,
    d: 52,
    island: null as Island | null,
    reserved: false,
  }));
  const agents = [
    addAgent(scene, { name: "Claude", color: "var(--chakra-colors-agent-claude)", x: 390, y: 170, z: 64 }),
    addAgent(scene, { name: "Codex", color: "var(--chakra-colors-agent-codex)", x: 70, y: 160, z: 64 }),
  ];
  let islands: Island[] = [];
  let open = false;
  let lastLabel = 0;

  scene.onTick = () => {
    const now = performance.now();
    if (now - lastLabel < 200) return;
    lastLabel = now;
    for (const island of islands) {
      if (island.placed) continue;
      scene.label(island, `<code>${island.file[0]}</code><small>opened ${ago((now - island.born) / DAY_MS)}</small>`);
    }
  };

  const place = (island: Island, index: number) => {
    const slot = slots[index];
    slot.island = island;
    Object.assign(island, { placed: true, drag: false, float: false, restLift: 0, liftT: 0 });
    Object.assign(island.t, { x: slot.x, y: slot.y, w: slot.w, d: slot.d, z: 10, h: 4 });
    island.top.innerHTML = tool(island.file[2]);
    island.el.classList.remove("iso-island");
    scene.label(island, island.file[1], true);
    setTimeout(() => island.plate?.classList.add("iso-fade"), 2200);
  };
  const freeSlot = () => slots.findIndex((slot) => !slot.island && !slot.reserved);

  scene.targets.push({
    ...PLATE,
    accept: (box) => open && "file" in box && !(box as Island).placed && freeSlot() >= 0,
    drop: (box) => {
      place(box as Island, freeSlot());
      raise(pick(agents));
    },
  });

  const write = async (agent: Agent, queue: AgentFile[], spots: [number, number][]) => {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      const agentFile = entry;
      const [x, y] = spots.shift()!;
      await job(agent, async () => {
        await moveAgent(agent, x + 29, y + 21, 48, 650);
        const island = scene.add({
          x,
          y,
          w: 58,
          d: 42,
          h: 5,
          className: "iso-island iso-pop",
          html: file(),
          label: "",
          float: true,
          restLift: 30,
          file: agentFile,
          born: Number.POSITIVE_INFINITY,
          placed: false,
          claimed: false,
        });
        const grow = island.top.querySelector<HTMLElement>(".g-grow")!;
        await code(scene, agent, agentFile[0], agentFile[3], (k) => {
          grow.style.height = `${Math.round(26 * k)}px`;
        });
        island.born = performance.now();
        island.drag = true;
        // Once the workbench is up, clicking a file moves it there, as the agents do.
        island.click = () => {
          if (open && !island.placed && freeSlot() >= 0) place(island, freeSlot());
        };
        islands.push(island);
      });
    }
  };

  const gather = async (agent: Agent) => {
    for (;;) {
      const island = islands.find(
        (candidate) => !candidate.placed && !candidate.carried && !candidate.held && !candidate.claimed,
      );
      const index = freeSlot();
      if (!island || index < 0) return;
      // Leave the files alone while the visitor is carrying one.
      if (scene.userBusy(3000)) {
        await scene.wait(300);
        continue;
      }
      island.claimed = true;
      slots[index].reserved = true;
      const moved = await job(agent, () => carry(agent, island, { x: slots[index].x, y: slots[index].y, z: 10 }, 30));
      slots[index].reserved = false;
      island.claimed = false;
      if (moved && !island.placed) place(island, index);
    }
  };

  scene.run(async () => {
    for (;;) {
      await scene.awake();
      islands = [];
      const queue = shuffle(FILES);
      const spots = shuffle(SPOTS);
      await Promise.all([write(agents[0], queue, spots), scene.wait(350).then(() => write(agents[1], queue, spots))]);
      await scene.wait(2400);
      open = true;
      plate.t.h = 10;
      plate.el.classList.remove("iso-hidden");
      await scene.wait(700);
      while (islands.some((island) => !island.placed)) {
        await Promise.all([gather(agents[0]), scene.wait(450).then(() => gather(agents[1]))]);
        await scene.wait(300);
      }
      await scene.wait(500);
      await agentFive(scene, agents[0], agents[1]);
      await scene.wait(3000);
      open = false;
      for (const island of islands) island.el.classList.add("iso-fade");
      plate.t.h = 0;
      plate.el.classList.add("iso-hidden");
      await scene.wait(900);
      for (const island of islands) scene.remove(island);
      for (const slot of slots) slot.island = null;
      await scene.wait(500);
    }
  });
};
