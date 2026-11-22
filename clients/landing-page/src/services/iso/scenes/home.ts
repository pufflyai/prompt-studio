import { addAgent, agentFive, agentSays, carry, code, job, moveAgent, pat, puff, toss } from "../agents";
import { ISO_SURFACE } from "../greek";
import { pick } from "../motion";
import type { Agent, IsoBox, IsoScene } from "../scene";
import { BLOCK, benchHtml, blockHtml, MAIN_AREA, PLATE, plusPoint, TOOL_ORDER, TOOLS } from "./home-ui";

export const HOME_WORLD = { W: 312, D: 278, top: 60, bottom: 18 };

// Where agents stand to write code: around the workbench, never on it.
const SPOTS: [number, number][] = [
  [6, 14],
  [268, 8],
  [294, 120],
  [290, 252],
  [150, 262],
  [8, 248],
  [4, 130],
];

// block: made, on its way · held: in the visitor's hand · dropped: let go off the workbench
// `claimedBy` is the agent bringing it in; only that agent may give the claim up.
type Piece = IsoBox & { state: "block" | "held" | "dropped"; claimedBy: Agent | null; generation: number };

/**
 * One tool at a time grows on the workbench. Agents write an improvement beside it, carry the
 * result in and pat it into the panel: the ticket board gains columns, assignees, a list view.
 * When the tool is done they high five, one clicks "+", and the next tab starts a new tool.
 * The visitor can take any improvement, even from an agent's hand, and drop it on the panel
 * to install it, or anywhere else for an agent to fetch it back.
 */
export const setupHomeScene = (scene: IsoScene) => {
  let tabs = 1;
  let stage = 0;
  let issued = 0;
  let generation = 0;
  let celebrating = false;
  let chaser: Agent | null = null;
  const pieces: Piece[] = [];
  const taken = new Set<[number, number]>();
  // The workbench is large; swiping across it still scrolls the page. Only pieces capture touch.
  const plate = scene.add({ ...PLATE, h: 10, html: benchHtml(tabs, stage), className: "iso-pan", color: ISO_SURFACE });
  const tool = () => TOOLS[TOOL_ORDER[tabs - 1]];
  const render = () => {
    plate.top.innerHTML = benchHtml(tabs, stage);
  };
  const agents = [
    addAgent(scene, { name: "Claude", color: "var(--chakra-colors-agent-claude)", x: 300, y: 170, z: 50 }),
    addAgent(scene, { name: "Codex", color: "var(--chakra-colors-agent-codex)", x: 10, y: 100, z: 50 }),
    addAgent(scene, { name: "OpenCode", color: "var(--chakra-colors-agent-opencode)", x: 170, y: 266, z: 50 }),
  ];

  const forget = (piece: Piece) => {
    const index = pieces.indexOf(piece);
    if (index >= 0) pieces.splice(index, 1);
  };
  // The block sinks into the panel, and the panel gains the next part.
  const deliver = (piece: Piece) => {
    // Each block installs once: the visitor may drop it on the panel while an agent pats it.
    if (!pieces.includes(piece)) return;
    forget(piece);
    piece.drag = false;
    scene.fadeOut(piece);
    if (piece.generation !== generation) return;
    stage = Math.min(stage + 1, tool().improvements.length);
    render();
    puff(scene, piece.x + piece.w / 2, piece.y + piece.d / 2, 10);
  };

  // A new tab starts the next tool from nothing; improvements still on their way are dropped.
  const turnPage = () => {
    generation++;
    const plus = plusPoint(plate.top);
    puff(scene, plus.x, plus.y, 10);
    tabs = tabs >= TOOL_ORDER.length ? 1 : tabs + 1;
    stage = 0;
    issued = 0;
    render();
    for (const piece of pieces.splice(0)) {
      piece.drag = false;
      scene.fadeOut(piece);
    }
  };
  scene.onAction = (action) => {
    if (action === "new-tab" && !scene.held) turnPage();
  };

  scene.onGrab = (box) => {
    (box as Piece).state = "held";
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
    piece.claimedBy = null;
  };
  scene.onTick = () => {
    const box = scene.held;
    if (!chaser || !box) return;
    chaser.x += (box.x + box.w + 6 - chaser.x) * 0.07;
    chaser.y += (box.y - 6 - chaser.y) * 0.07;
    chaser.z += (box.z + box.lift + box.h + 24 - chaser.z) * 0.07;
  };
  // Dropping an improvement on the panel installs it, just as an agent's pat does.
  scene.targets.push({
    ...MAIN_AREA,
    accept: (box) => (box as Piece).state === "held",
    drop: (box) => deliver(box as Piece),
  });

  const dropPoint = () => ({
    x: MAIN_AREA.x + MAIN_AREA.w / 2 - BLOCK.w / 2 + (Math.random() - 0.5) * 60,
    y: MAIN_AREA.y + MAIN_AREA.d / 2 - BLOCK.d / 2 + (Math.random() - 0.5) * 50,
    z: 10,
  });
  const install = async (agent: Agent, piece: Piece) => {
    const dest = dropPoint();
    const delivered =
      piece.state === "block" && Math.random() < 0.5
        ? await toss(scene, agent, piece, dest, 70)
        : await carry(agent, piece, dest, 26);
    if (!delivered) {
      // The visitor took the block or the hand; a block left lying around waits to be fetched.
      if (!piece.held) piece.state = "dropped";
      if (!agent.held) agentSays(agent, pick(["hey!", "I was using that", "rude"]), 1300);
      return;
    }
    if (piece.generation !== generation) return;
    piece.state = "block";
    // A block the visitor took and dropped elsewhere mid-pat stays where it is.
    await pat(scene, agent, piece, () => {
      if (piece.state === "block") deliver(piece);
    });
    // The pat never landed (the visitor held the hand or took the block): someone fetches it again.
    if (pieces.includes(piece) && !piece.held) piece.state = "dropped";
  };

  const build = async (agent: Agent) => {
    const page = generation;
    const kind = TOOL_ORDER[tabs - 1];
    const step = TOOLS[kind].improvements[issued++];
    const spot = pick(SPOTS.filter((candidate) => !taken.has(candidate))) ?? SPOTS[0];
    taken.add(spot);
    const [x, y] = spot;
    await moveAgent(agent, x + 13, y + 13, 46, 600);
    await code(scene, agent, step.file, step.code);
    taken.delete(spot);
    // The visitor opened a new tab while the agent was coding; this belonged to the old tool.
    if (page !== generation) return;
    const piece = scene.add({
      x,
      y,
      ...BLOCK,
      color: TOOLS[kind].color,
      html: blockHtml(kind),
      className: "iso-pop",
      drag: true,
      state: "block" as Piece["state"],
      claimedBy: agent,
      generation: page,
    }) as Piece;
    scene.label(piece, `+ ${step.label}`, true);
    piece.z = 30;
    pieces.push(piece);
    puff(scene, x + 13, y + 13, 0);
    await scene.wait(220);
    await install(agent, piece);
    if (piece.claimedBy === agent) piece.claimedBy = null;
  };

  // Each agent fetches dropped improvements first, then builds the next one the tool still needs.
  const work = async (agent: Agent) => {
    await scene.wait(300 + Math.random() * 900);
    for (;;) {
      await scene.awake();
      if (agent === chaser || agent.held || celebrating) {
        await scene.wait(250);
        continue;
      }
      const dropped = pieces.find((piece) => !piece.claimedBy && piece.state === "dropped");
      if (dropped) {
        dropped.claimedBy = agent;
        await job(agent, () => install(agent, dropped));
        if (dropped.claimedBy === agent) dropped.claimedBy = null;
        continue;
      }
      if (issued < tool().improvements.length) {
        await job(agent, () => build(agent));
        continue;
      }
      await scene.wait(300);
    }
  };

  const complete = () => stage >= tool().improvements.length && pieces.length === 0;

  // An agent clicks "+" in the tab bar, just as the visitor can.
  const openTab = async (agent: Agent) => {
    const plus = plusPoint(plate.top);
    await moveAgent(agent, plus.x, plus.y, 34, 650);
    await moveAgent(agent, plus.x, plus.y, 14, 110);
    if (complete() && !scene.held) turnPage();
    await moveAgent(agent, plus.x, plus.y, 34, 160);
  };
  // When the tool has every improvement, two agents high five and one opens the next tab.
  const celebrate = async () => {
    celebrating = true;
    while (agents.some((agent) => agent.task)) await scene.wait(150);
    if (complete() && !scene.held) {
      await scene.wait(700);
      const [first, second] = pick([agents.slice(0, 2), agents.slice(1), [agents[0], agents[2]]]);
      await agentFive(scene, first, second);
      await scene.wait(400);
      const agent = pick(agents);
      if (complete()) await job(agent, () => openTab(agent));
      await scene.wait(400);
    }
    celebrating = false;
  };
  const restart = async () => {
    for (;;) {
      await scene.awake();
      await scene.wait(400);
      if (!celebrating && !scene.held && complete()) await celebrate();
    }
  };

  for (const agent of agents) scene.run(() => work(agent));
  scene.run(restart);
};
