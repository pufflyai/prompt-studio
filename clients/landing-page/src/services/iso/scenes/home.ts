import { addAgent, agentFive, agentSays, carry, code, job, moveAgent, pat, puff, toss } from "../agents";
import { kindColor, type ToolKind, workbench } from "../greek";
import { pick } from "../motion";
import type { Agent, IsoScene } from "../scene";
import { BLOCK, type Piece, type Slot, type State, shapePieces } from "./home-pieces";

export const HOME_WORLD = { W: 330, D: 300, top: 70, bottom: 24 };

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

/**
 * Agents code tools, pat them into place, then open a new tab and start over. The visitor can
 * take any piece, even from an agent's hand; it turns back into a block and the agents fetch it.
 */
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
    addAgent(scene, { name: "OpenCode", color: "var(--chakra-colors-agent-opencode)", x: 170, y: 280, z: 50 }),
  ];

  const { seat, toBlock, advance, patByHand, stageCount } = shapePieces(scene, slots);
  const finish = async (agent: Agent, piece: Piece) => {
    while (piece.state === "seated" && piece.stage < stageCount) await pat(scene, agent, piece, () => advance(piece));
  };

  // Turning to a new tab leaves the finished tools in the old tab and empties the workbench.
  let generation = 0;
  const turnPage = () => {
    generation++;
    const plus = { x: PLATE.x + 30 + tabs * 25 + 4, y: PLATE.y + 5 };
    puff(scene, plus.x, plus.y, 10);
    tabs = tabs >= MAX_TABS ? 1 : tabs + 1;
    plate.top.innerHTML = workbench(tabs);
    const old = pieces.splice(0);
    for (const piece of old) {
      piece.drag = false;
      piece.t.z = 24;
      piece.el.classList.add("iso-fade");
    }
    setTimeout(() => {
      for (const piece of old) scene.remove(piece);
    }, 450);
    for (const slot of slots) Object.assign(slot, { piece: null, reserved: false });
  };
  scene.onAction = (action) => {
    if (action === "new-tab" && !scene.held) turnPage();
  };

  scene.onGrab = (box) => {
    const piece = box as Piece;
    piece.state = "held";
    toBlock(piece);
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
    piece.state = "dropped";
    piece.claimed = false;
  };
  scene.onTick = () => {
    const box = scene.held;
    if (!chaser || !box) return;
    chaser.x += (box.x + box.w + 6 - chaser.x) * 0.07;
    chaser.y += (box.y - 6 - chaser.y) * 0.07;
    chaser.z += (box.z + box.lift + box.h + 24 - chaser.z) * 0.07;
  };
  // Dropping a piece on the workbench puts it back on its own slot for the agents to finish.
  scene.targets.push({
    x: 96,
    y: 80,
    w: 162,
    d: 146,
    accept: (box) => (box as Piece).state === "held",
    drop: (box) => seat(box as Piece),
  });

  const fetch = async (agent: Agent, piece: Piece) => {
    agentSays(agent, pick(["give that back", "mine!", "nice try"]), 1300);
    const slot = slots[piece.slot];
    const dest = { x: slot.x + slot.w / 2 - BLOCK.w / 2, y: slot.y + slot.d / 2 - BLOCK.d / 2, z: 10 };
    if (!(await carry(agent, piece, dest, 34))) return;
    seat(piece);
    await finish(agent, piece);
  };

  const build = async (agent: Agent, index: number) => {
    const page = generation;
    const slot = slots[index];
    const [kind, fileName, lines] = BUILDS[next++ % BUILDS.length];
    const spot = pick(SPOTS.filter((candidate) => !taken.has(candidate))) ?? SPOTS[0];
    taken.add(spot);
    const [x, y] = spot;
    await moveAgent(agent, x + 13, y + 13, 46, 650);
    await code(scene, agent, fileName, lines);
    taken.delete(spot);
    // The visitor opened a new tab while the agent was coding; this tool belongs to the old one.
    if (page !== generation) return;
    const piece = scene.add({
      x,
      y,
      ...BLOCK,
      color: kindColor(kind),
      className: "iso-pop",
      drag: true,
      kind,
      state: "block" as State,
      slot: index,
      claimed: true,
      stage: 0,
    });
    piece.click = () => patByHand(piece);
    piece.z = 30;
    pieces.push(piece);
    slot.piece = piece;
    slot.reserved = false;
    puff(scene, x + 13, y + 13, 0);
    await scene.wait(250);
    const dest = { x: slot.x + slot.w / 2 - BLOCK.w / 2, y: slot.y + slot.d / 2 - BLOCK.d / 2, z: 10 };
    const delivered =
      Math.random() < 0.5 ? await toss(scene, agent, piece, dest, 80) : await carry(agent, piece, dest, 24);
    if (!delivered) {
      agentSays(agent, pick(["hey!", "I was using that", "rude"]), 1300);
      piece.claimed = false;
      return;
    }
    if (page !== generation) return;
    seat(piece);
    await finish(agent, piece);
    piece.claimed = false;
  };

  // Each agent fetches dropped pieces first, then finishes seated ones, then builds new tools.
  const work = async (agent: Agent) => {
    await scene.wait(300 + Math.random() * 900);
    for (;;) {
      await scene.awake();
      if (agent === chaser || !building) {
        await scene.wait(250);
        continue;
      }
      const waiting = pieces.find((piece) => !piece.claimed && (piece.state === "dropped" || piece.state === "seated"));
      if (waiting) {
        waiting.claimed = true;
        await job(agent, () => (waiting.state === "dropped" ? fetch(agent, waiting) : finish(agent, waiting)));
        waiting.claimed = false;
        continue;
      }
      const free = slots.findIndex((slot) => !slot.piece && !slot.reserved);
      if (free < 0) {
        await scene.wait(300);
        continue;
      }
      slots[free].reserved = true;
      await job(agent, () => build(agent, free));
    }
  };

  const complete = () => slots.every((slot) => slot.piece?.state === "tool");

  // An agent clicks "+" in the tab bar, just as the visitor can.
  const openTab = async (agent: Agent) => {
    const plus = { x: PLATE.x + 30 + tabs * 25 + 4, y: PLATE.y + 5 };
    await moveAgent(agent, plus.x, plus.y, 34, 700);
    await moveAgent(agent, plus.x, plus.y, 14, 110);
    if (complete()) turnPage();
    await moveAgent(agent, plus.x, plus.y, 34, 160);
  };

  // When every slot holds a tool, the agents celebrate and open a fresh tab.
  const celebrate = async () => {
    building = false;
    await scene.wait(2000);
    while (agents.some((agent) => agent.task)) await scene.wait(150);
    // The visitor may have taken a tool while the agents finished up.
    building = !complete();
    if (building) return;
    for (const piece of pieces) piece.drag = false;
    const [first, second] = pick([agents.slice(0, 2), agents.slice(1), [agents[0], agents[2]]]);
    await agentFive(scene, first, second);
    await scene.wait(500);
    const agent = pick(agents);
    await job(agent, () => openTab(agent));
    await scene.wait(450);
    building = true;
  };
  const restart = async () => {
    for (;;) {
      await scene.awake();
      await scene.wait(400);
      if (building && !scene.held && complete()) await celebrate();
    }
  };

  for (const agent of agents) scene.run(() => work(agent));
  scene.run(restart);
};
