import { CURSOR_CHAT_HEIGHT, CURSOR_CHAT_WIDTH } from "../../content/demo-cli-commands";
import { ASSEMBLY_AGENTS } from "../../content/tool-assembly";
import type { ToolExampleId } from "../../content/tool-examples-content";
import { createAssemblyInteractions } from "./assembly-interactions";
import { type AssemblySlot, cursorStart } from "./assembly-layout";
import { MOTION_DURATION_SCALE, type Point, travel } from "./assembly-motion";
import { type createShapePhysics, type PhysicsPiece, physicsPosition } from "./shape-physics";

interface Drift {
  from: Point;
  to: Point;
  started: number;
  duration: number;
  bend: number;
}
interface Job {
  piece: PhysicsPiece;
  slot: AssemblySlot;
  clearing: boolean;
  phase: "approach" | "carry";
  started: number;
  duration: number;
  from: Point;
  bend: number;
}
export interface AssemblyAgentsSnapshot {
  nextPickup: number;
  sequence: number;
  agents: {
    position: Point;
    drift?: Drift;
    visits: number;
    restUntil: number;
    angle: number;
    job?: Omit<Job, "piece" | "slot"> & { piece: string; slot: string };
  }[];
}

/** Cursors share real bodies with people and choose a new task after yielding a piece. */
export const createAssemblyAgents = (
  scene: SVGSVGElement,
  physics: ReturnType<typeof createShapePhysics>,
  claimed: Map<string, number>,
  slots: AssemblySlot[],
  snapshot?: AssemblyAgentsSnapshot,
) => {
  const board = scene.querySelector<SVGGElement>("[data-tool-board]")!;
  const card = board.querySelector<SVGRectElement>("rect")!;
  const agents = ASSEMBLY_AGENTS.map((_, index) => ({
    element: scene.querySelector<SVGGElement>(`[data-assembly-cursor="${index}"]`)!,
    tip: scene.querySelector<SVGGElement>(`[data-assembly-cursor="${index}"] [data-cursor-tip]`)!,
    position: cursorStart(scene.viewBox.baseVal.width, index),
    drift: undefined as Drift | undefined,
    visits: 0,
    job: undefined as Job | undefined,
    restUntil: 900 + index * 850,
    angle: 0,
  }));
  type Agent = (typeof agents)[number];
  let nextPickup = snapshot?.nextPickup ?? 900;
  let sequence = snapshot?.sequence ?? 0;
  snapshot?.agents.forEach((saved, index) => {
    const { job, ...state } = saved;
    Object.assign(agents[index], state, { position: { ...state.position } });
    if (job) {
      const piece = physics.pieces.find((piece) => piece.id === job.piece)!;
      agents[index].job = { ...job, piece, slot: slots.find((slot) => slot.id === job.slot)! };
      if (job.phase === "carry") physics.grab(piece);
    }
  });
  const interactions = createAssemblyInteractions(scene, agents);
  const releaseJob = (agent: Agent, now: number) => {
    if (agent.job) physics.release(agent.job.piece);
    agent.job = undefined;
    agent.drift = undefined;
    agent.restUntil = now + 700;
  };
  const assign = (agent: Agent, index: number, now: number, clearing: boolean, slots: AssemblySlot[]) => {
    if (agent.job || now < agent.restUntil || now < nextPickup) return;
    const slot = slots.find((slot) => {
      if (agents.some((other) => other.job?.slot === slot)) return false;
      const docked = physics.pieces.find((piece) => piece.slot === slot);
      return clearing ? docked && !claimed.has(docked.id) : !docked;
    });
    if (!slot) return;
    const candidates = physics.pieces.filter(
      (piece) =>
        !claimed.has(piece.id) &&
        !agents.some((other) => other.job?.piece === piece) &&
        (clearing ? piece.slot === slot : !piece.slot && piece.kind === slot.kind),
    );
    const piece = candidates[(sequence * 7 + index * 3) % candidates.length];
    if (!piece) return;
    const target = physicsPosition(piece);
    agent.job = {
      piece,
      slot,
      clearing,
      phase: "approach",
      started: now,
      duration:
        (550 + Math.hypot(target.x - agent.position.x, target.y - agent.position.y) * 0.65) * MOTION_DURATION_SCALE,
      from: { ...agent.position },
      bend: (index % 2 ? -1 : 1) * (35 + (sequence % 35)),
    };
    agent.drift = undefined;
    sequence++;
    nextPickup = now + 950 * MOTION_DURATION_SCALE;
  };
  const approach = (agent: Agent, job: Job, index: number, now: number, progress: number) => {
    agent.position = travel(job.from, physicsPosition(job.piece), progress, job.bend);
    if (progress < 1) return;
    physics.grab(job.piece);
    job.phase = "carry";
    job.started = now + 160;
    job.from = physicsPosition(job.piece);
    job.duration = (1250 + index * 180) * MOTION_DURATION_SCALE;
  };
  const carry = (agent: Agent, job: Job, index: number, now: number, progress: number) => {
    const bounds = scene.viewBox.baseVal;
    const center = new DOMPoint(card.width.baseVal.value / 2, 0).matrixTransform(
      board.transform.baseVal.consolidate()!.matrix,
    );
    const target = job.clearing ? { x: center.x + (index - 1) * 60, y: bounds.height - 110 } : job.slot;
    physics.move(job.piece, { ...physicsPosition(job.piece), ...travel(job.from, target, progress, -job.bend) });
    const point = physicsPosition(job.piece);
    agent.position = point;
    const arrived = Math.hypot(point.x - target.x, point.y - target.y) < 14;
    if (progress < 1 || (!arrived && progress <= 1.7)) return;
    if (job.clearing) physics.release(job.piece);
    else physics.snap(job.piece, job.slot);
    releaseJob(agent, now);
  };
  const drift = (agent: Agent, index: number, now: number) => {
    if (!agent.drift || now >= agent.drift.started + agent.drift.duration) {
      const visit = agent.visits++;
      const bounds = scene.viewBox.baseVal;
      const entering = agent.position.x > bounds.width;
      const angle = index * 2.1 + visit * 2.4;
      const point = entering
        ? new DOMPoint(
            card.width.baseVal.value * (0.4 + index * 0.15),
            card.height.baseVal.value * 0.3,
          ).matrixTransform(board.transform.baseVal.consolidate()!.matrix)
        : {
            x: agent.position.x + Math.cos(angle) * 28,
            y: agent.position.y + Math.sin(angle) * 20,
          };
      agent.drift = {
        from: { ...agent.position },
        to: {
          x: Math.max(12, Math.min(bounds.width - 92, point.x)),
          y: Math.max(12, Math.min(bounds.height - 56, point.y)),
        },
        started: now,
        duration: (entering ? 1600 : 3600 + index * 240) * MOTION_DURATION_SCALE,
        bend: visit % 2 ? -8 : 8,
      };
    }
    const { from, to, started, duration, bend } = agent.drift;
    agent.position = travel(from, to, (now - started) / duration, bend);
  };
  const move = (agent: Agent, index: number, now: number) => {
    const job = agent.job;
    if (!job) {
      drift(agent, index, now);
      return;
    }
    const occupied = physics.pieces.some((piece) => piece !== job.piece && piece.slot === job.slot);
    if (claimed.has(job.piece.id) || (!job.clearing && occupied)) {
      releaseJob(agent, now);
      return;
    }
    const progress = (now - job.started) / job.duration;
    if (job.phase === "approach") approach(agent, job, index, now, progress);
    else carry(agent, job, index, now, progress);
  };
  return {
    update: (now: number, clearing: boolean, slots: AssemblySlot[], example: ToolExampleId, complete = false) => {
      const positions = agents.map((agent) => agent.position);
      const interacting = interactions.update(
        now,
        complete && !clearing ? example : undefined,
        (index) => !agents[index].job,
      );
      agents.forEach((agent, index) => {
        agent.element.setAttribute("visibility", "visible");
        assign(agent, index, now, clearing, slots);
        const old = positions[index];
        const mode = interactions.mode(index);
        if (interacting === index && mode !== "chat") agent.drift = undefined;
        else move(agent, index, now);
        const dx = agent.position.x - old.x;
        agent.angle += (Math.max(-12, Math.min(12, dx * 2)) - agent.angle) * 0.12;
        agent.element.dataset.holding = agent.job?.phase === "carry" ? agent.job.piece.id : "";
        const holding = agent.job?.phase === "carry";
        agent.element.dataset.cursorMode = holding ? "grabbing" : interactions.mode(index);
        agent.element.setAttribute("transform", `translate(${agent.position.x + 5} ${agent.position.y + 5})`);
        if (mode === "chat") {
          const bounds = scene.viewBox.baseVal;
          const width = Math.min(CURSOR_CHAT_WIDTH, bounds.width - 16);
          const chat = agent.element.querySelector<SVGGElement>("[data-cursor-chat]")!;
          chat.querySelector("foreignObject")!.setAttribute("width", String(width));
          const x = Math.max(8 - agent.position.x, Math.min(-width / 2, bounds.width - agent.position.x - width - 8));
          const y = Math.max(
            8 - agent.position.y,
            Math.min(-CURSOR_CHAT_HEIGHT - 12, bounds.height - agent.position.y - CURSOR_CHAT_HEIGHT - 8),
          );
          chat.setAttribute("transform", `translate(${x} ${y})`);
        }
        agent.tip.setAttribute(
          "transform",
          `rotate(${interactions.mode(index) === "text" ? 0 : agent.angle}) scale(${interactions.pressed(index) ? 0.85 : 1})`,
        );
      });
    },
    resize: (now: number) => {
      for (const agent of agents) {
        agent.drift = undefined;
        if (agent.job) {
          agent.job.from = agent.job.phase === "carry" ? physicsPosition(agent.job.piece) : { ...agent.position };
          agent.job.started = now;
        }
      }
    },
    busy: () => agents.some((agent) => agent.job),
    interactionsDone: interactions.done,
    snapshot: () => ({
      nextPickup,
      sequence,
      agents: agents.map((agent) => ({
        position: { ...agent.position },
        drift: agent.drift ? { ...agent.drift } : undefined,
        visits: agent.visits,
        restUntil: agent.restUntil,
        angle: agent.angle,
        job: agent.job
          ? { ...agent.job, from: { ...agent.job.from }, piece: agent.job.piece.id, slot: agent.job.slot.id }
          : undefined,
      })),
    }),
    relinquish: (piece: PhysicsPiece, now: number) => {
      for (const agent of agents) if (agent.job?.piece === piece) releaseJob(agent, now);
    },
    hide: (now: number) => {
      interactions.reset();
      for (const agent of agents) {
        releaseJob(agent, now);
        agent.element.setAttribute("visibility", "hidden");
        agent.element.dataset.holding = "";
      }
    },
  };
};
