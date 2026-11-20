import { addAgent, agentFive, agentSays, carry, code, job, moveAgent, pat, puff, toss } from "../agents";
import { ISO_SURFACE, kindColor, type ToolKind, tool, workbench } from "../greek";
import { pick, wait } from "../motion";
import type { Agent, IsoBox, IsoScene } from "../scene";

export const HOME_WORLD = { W: 330, D: 300, top: 70, bottom: 24 };

type State = "block" | "seated" | "tool" | "grabbed" | "stolen";
type Piece = IsoBox & { kind: ToolKind; state: State; slot: number };
interface Slot {
  x: number;
  y: number;
  w: number;
  d: number;
  piece: Piece | null;
  reserved: boolean;
}

const PLATE = { x: 70, y: 70, w: 190, d: 160 };
const SPOTS: [number, number][] = [
  [18, 30],
  [252, 22],
  [286, 120],
  [262, 250],
  [150, 262],
  [20, 230],
  [10, 130],
];
const BUILDS: [ToolKind, string, string[]][] = [
  ["page", "tracker.tsx", ["export const Tracker = () =>", "  <Board columns={stages} />"]],
  ["command", "invoices.ts", ['command("check-invoices",', "  () => totals.match(due))"]],
  ["automation", "digest.ts", ['schedule("0 9 * * 1",', "  () => post(summary()))"]],
  ["editor", "chart.tsx", ["<LineChart data={prices}", '  range="90d" />']],
  ["skill", "review.md", ["# Review checklist", "- tests pass, copy reads well"]],
];
const MAX_TABS = 5;

/** Agents code tools, pat them into place, then open a new tab and start over. Steal a tool to tease them. */
export const setupHomeScene = (scene: IsoScene) => {
  let tabs = 1;
  const plate = scene.add({ ...PLATE, h: 10, html: workbench(tabs) });
  const slots: Slot[] = [
    { x: 106, y: 88 },
    { x: 180, y: 88 },
    { x: 106, y: 156 },
    { x: 180, y: 156 },
  ].map((at) => ({ ...at, w: 66, d: 60, piece: null, reserved: false }));
  const pieces: Piece[] = [];
  const taken = new Set<[number, number]>();
  let next = 0;
  let building = true;
  let chaser: Agent | null = null;
  const agents = [
    addAgent(scene, { name: "Claude", color: "var(--chakra-colors-agent-claude)", x: 300, y: 150, z: 50 }),
    addAgent(scene, { name: "Codex", color: "var(--chakra-colors-agent-codex)", x: 28, y: 100, z: 50 }),
  ];

  const center = (piece: Piece, w: number, d: number) => {
    const slot = slots[piece.slot];
    Object.assign(piece.t, { x: slot.x + slot.w / 2 - w / 2, y: slot.y + slot.d / 2 - d / 2, w, d });
  };
  const seat = (piece: Piece, index: number) => {
    slots[index].piece = piece;
    piece.slot = index;
    piece.state = "seated";
    center(piece, piece.t.w, piece.t.d);
    piece.t.z = 10;
  };
  const putBack = (piece: Piece) => {
    const slot = slots[piece.slot];
    Object.assign(piece.t, { x: slot.x, y: slot.y, w: slot.w, d: slot.d, z: 10, h: 3 });
    piece.state = "tool";
  };
  // Each pat visibly reshapes the block until it becomes a working tool.
  const stages = [
    (piece: Piece) => {
      center(piece, 42, 38);
      piece.t.h = 14;
    },
    (piece: Piece) => {
      center(piece, 62, 56);
      piece.t.h = 6;
    },
    (piece: Piece) => {
      center(piece, 66, 60);
      piece.t.h = 3;
      piece.color = ISO_SURFACE;
      scene.paint(piece);
      piece.top.innerHTML = tool(piece.kind);
      piece.state = "tool";
      piece.drag = true;
    },
  ];

  scene.onGrab = (box) => {
    const piece = box as Piece;
    if (piece.state !== "tool") return;
    piece.state = "grabbed";
    chaser = agents.find((agent) => !agent.task) ?? null;
    if (!chaser) return;
    chaser.task = true;
    agentSays(chaser, pick(["hey!", "that’s mine", "wait!"]), 1300);
  };
  scene.onRelease = () => {
    if (!chaser) return;
    chaser.task = false;
    chaser.wander = undefined;
    chaser = null;
  };
  scene.onFree = (box) => {
    const piece = box as Piece;
    if (piece.state === "grabbed") piece.state = "stolen";
  };
  scene.onTick = () => {
    const box = scene.held;
    if (!chaser || !box) return;
    chaser.x += (box.x + box.w + 6 - chaser.x) * 0.07;
    chaser.y += (box.y - 6 - chaser.y) * 0.07;
    chaser.z += (box.z + box.lift + box.h + 24 - chaser.z) * 0.07;
  };
  scene.targets.push({
    x: 96,
    y: 80,
    w: 162,
    d: 146,
    accept: (box) => (box as Piece).state === "grabbed",
    drop: (box) => putBack(box as Piece),
  });

  const build = async (agent: Agent, index: number) => {
    const slot = slots[index];
    const [kind, fileName, lines] = BUILDS[next++ % BUILDS.length];
    const spot = pick(SPOTS.filter((candidate) => !taken.has(candidate))) ?? SPOTS[0];
    taken.add(spot);
    const [x, y] = spot;
    await moveAgent(agent, x + 13, y + 13, 46, 650);
    await code(scene, agent, fileName, lines);
    const piece = scene.add({
      x,
      y,
      w: 26,
      d: 26,
      h: 22,
      color: kindColor(kind),
      className: "iso-pop",
      kind,
      state: "block" as State,
      slot: index,
    });
    piece.z = 30;
    pieces.push(piece);
    puff(scene, x + 13, y + 13, 0);
    await wait(250);
    const dest = { x: slot.x + slot.w / 2 - 13, y: slot.y + slot.d / 2 - 13, z: 10 };
    if (Math.random() < 0.5) await toss(scene, agent, piece, dest, 80);
    else await carry(agent, piece, dest, 24);
    taken.delete(spot);
    seat(piece, index);
    slot.reserved = false;
    for (const stage of stages) await pat(scene, agent, piece, (box) => stage(box as Piece));
  };

  const work = async (agent: Agent) => {
    await wait(300 + Math.random() * 900);
    for (;;) {
      await scene.awake();
      if (agent === chaser || !building) {
        await wait(250);
        continue;
      }
      const stolen = pieces.find((piece) => piece.state === "stolen" && !piece.held);
      if (stolen) {
        stolen.state = "grabbed";
        agentSays(agent, pick(["give that back", "mine!", "nice try"]), 1300);
        const slot = slots[stolen.slot];
        await job(agent, () => carry(agent, stolen, { x: slot.x, y: slot.y, z: 10 }, 34));
        if (stolen.state === "grabbed" && !stolen.held) putBack(stolen);
        continue;
      }
      const free = slots.findIndex((slot) => !slot.piece && !slot.reserved);
      if (free < 0) {
        await wait(300);
        continue;
      }
      slots[free].reserved = true;
      await job(agent, () => build(agent, free));
    }
  };

  // When every slot holds a tool, the agents celebrate and open a fresh tab.
  const restart = async () => {
    for (;;) {
      await scene.awake();
      await wait(400);
      if (!building || scene.held || !slots.every((slot) => slot.piece?.state === "tool")) continue;
      building = false;
      await wait(2000);
      while (agents.some((agent) => agent.task)) await wait(150);
      await agentFive(scene, agents[0], agents[1]);
      await wait(500);
      const agent = pick(agents);
      const plus = { x: PLATE.x + 30 + tabs * 25 + 4, y: PLATE.y + 5 };
      await job(agent, async () => {
        await moveAgent(agent, plus.x, plus.y, 34, 700);
        await moveAgent(agent, plus.x, plus.y, 14, 110);
        puff(scene, plus.x, plus.y, 10);
        tabs = tabs >= MAX_TABS ? 1 : tabs + 1;
        plate.top.innerHTML = workbench(tabs);
        for (const piece of pieces) {
          piece.t.z = 24;
          piece.el.classList.add("iso-fade");
        }
        await moveAgent(agent, plus.x, plus.y, 34, 160);
      });
      await wait(450);
      for (const piece of pieces.splice(0)) scene.remove(piece);
      for (const slot of slots) Object.assign(slot, { piece: null, reserved: false });
      building = true;
    }
  };

  for (const agent of agents) scene.run(() => work(agent));
  scene.run(restart);
};
