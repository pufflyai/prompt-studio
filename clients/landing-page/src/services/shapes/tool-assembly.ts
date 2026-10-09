import { ASSEMBLY_EXAMPLES, type AssemblyView } from "../../content/tool-assembly";
import { createAssemblyAgents } from "./assembly-agents";
import { type AssemblyPosition, bindAssemblyDrag } from "./assembly-drag";
import { assemblyLayout, type BoardLayout, DEFAULT_COPY_SIZE, fieldPieces } from "./assembly-layout";
import { createShapePhysics, physicsPosition } from "./shape-physics";
import { readSimulation, saveSimulation } from "./simulation-state";

const transform = (point: AssemblyPosition) => `translate(${point.x} ${point.y}) rotate(${point.angle})`;

export const createToolAssembly = (
  scene: SVGSVGElement,
  onChange: (view: AssemblyView) => void,
  onLayoutChange: (board: BoardLayout) => void,
) => {
  const saved = readSimulation();
  let exampleIndex = saved ? ASSEMBLY_EXAMPLES.findIndex((example) => example.id === saved.example) : 0;
  const readLayout = () => {
    const { width, height } = scene.getBoundingClientRect();
    const copy = scene.closest("[data-assembly-area]")?.querySelector("[data-download-panel]");
    const unitScale = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
    return {
      size: { width, height },
      layout: assemblyLayout(
        { width, height },
        copy?.getBoundingClientRect() ?? { width: DEFAULT_COPY_SIZE.width * unitScale, height: 0 },
        ASSEMBLY_EXAMPLES[exampleIndex],
        unitScale,
      ),
    };
  };
  const initial = readLayout();
  scene.setAttribute("viewBox", `0 0 ${initial.size.width} ${initial.size.height}`);
  const pile = scene.querySelector<SVGSVGElement>("[data-assembly-pile]")!;
  pile.setAttribute("x", "0");
  pile.setAttribute("y", "0");
  const slots = initial.layout.slots;
  const physics = createShapePhysics(
    fieldPieces(initial.size, initial.layout.board),
    saved?.physics.size ?? initial.size,
  );
  if (saved) {
    physics.restore(saved.physics, slots);
    physics.resize(initial.size);
  }
  const claimed = new Map<string, number>(saved?.claimed);
  const agents = createAssemblyAgents(scene, physics, claimed, slots, saved?.agents);
  const pieces = physics.pieces.map((piece) => ({
    piece,
    element: scene.querySelector<SVGGElement>(`[data-assembly-piece="${piece.id}"]`)!,
  }));
  let clearing = saved?.clearing ?? false;
  let completedAt = saved?.completedAt;
  let signature = "";
  let elapsed = saved?.elapsed ?? 0;
  let frame = 0;
  let previous = 0;
  let active = false;
  let reduced = false;
  const currentExample = () => ASSEMBLY_EXAMPLES[exampleIndex];
  const activeSlots = () => slots.filter((slot) => currentExample().blocks.some((block) => block.kind === slot.kind));
  const occupied = (slot: (typeof slots)[number]) => physics.pieces.some((piece) => piece.slot === slot);
  const render = () => {
    for (const { piece, element } of pieces) {
      element.setAttribute("transform", transform(physicsPosition(piece)));
      element.dataset.placed = String(Boolean(piece.slot));
      element.dataset.slot = piece.slot?.id ?? "";
    }
    const required = activeSlots();
    const parts = required.filter(occupied).map((slot) => slot.kind);
    const next = `${exampleIndex}:${parts.join(",")}`;
    if (signature !== next) {
      signature = next;
      onChange({ example: currentExample().id, parts });
    }
  };
  const resize = () => {
    const { size, layout } = readLayout();
    if (!size.width || !size.height) return;
    scene.setAttribute("viewBox", `0 0 ${size.width} ${size.height}`);
    onLayoutChange(layout.board);
    layout.slots.forEach((slot, index) => {
      Object.assign(slots[index], slot);
    });
    physics.resize(size);
    agents.resize(elapsed);
    render();
  };
  const advance = () => {
    const required = activeSlots();
    if (!clearing) {
      if (required.every(occupied)) completedAt ??= elapsed;
      else completedAt = undefined;
      if (completedAt !== undefined && elapsed - completedAt > 4800 && agents.interactionsDone()) clearing = true;
    } else if (!required.some(occupied) && !agents.busy()) {
      exampleIndex = (exampleIndex + 1) % ASSEMBLY_EXAMPLES.length;
      completedAt = undefined;
      clearing = false;
      resize();
    }
    agents.update(elapsed, clearing, activeSlots(), currentExample().id, completedAt !== undefined);
  };
  const tick = (now: number) => {
    const delta = previous ? Math.min(now - previous, 48) : 1000 / 60;
    previous = now;
    elapsed += delta;
    for (const [id, until] of claimed) if (elapsed >= until) claimed.delete(id);
    if (!reduced) advance();
    physics.step(delta);
    render();
    if (active) frame = requestAnimationFrame(tick);
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    previous = 0;
  };
  const unbind = bindAssemblyDrag({
    scene,
    take: (id) => {
      const { piece, element } = pieces.find((item) => item.piece.id === id)!;
      claimed.set(id, Infinity);
      agents.relinquish(piece, elapsed);
      physics.grab(piece);
      element.dataset.dragging = "true";
      render();
      return physicsPosition(piece);
    },
    move: (id, point) => physics.move(pieces.find((item) => item.piece.id === id)!.piece, point),
    drop: (id, snap) => {
      const { piece, element } = pieces.find((item) => item.piece.id === id)!;
      const position = physicsPosition(piece);
      physics.release(piece);
      const available = activeSlots().filter((slot) => slot.kind === piece.kind && !occupied(slot));
      const distance = (slot: (typeof slots)[number]) => Math.hypot(position.x - slot.x, position.y - slot.y);
      available.sort((a, b) => distance(a) - distance(b));
      if (snap && available[0] && distance(available[0]) < 44) physics.snap(piece, available[0]);
      claimed.set(id, elapsed + 4000);
      element.dataset.dragging = "false";
      render();
    },
    nudge: (id, point) => physics.nudge(pieces.find((item) => item.piece.id === id)!.piece, point),
  });
  resize();
  agents.update(elapsed, clearing, activeSlots(), currentExample().id, completedAt !== undefined);
  render();
  return {
    resize,
    sync: (visible: boolean, reduceMotion: boolean) => {
      stop();
      active = visible;
      reduced = reduceMotion;
      if (reduced) agents.hide(elapsed);
      if (active) frame = requestAnimationFrame(tick);
    },
    destroy: () => {
      stop();
      saveSimulation({
        example: currentExample().id,
        elapsed,
        completedAt,
        clearing,
        claimed: [...claimed].map(([id, until]) => [id, Number.isFinite(until) ? until : elapsed + 4000]),
        physics: physics.snapshot(),
        agents: agents.snapshot(),
      });
      unbind();
      physics.dispose();
    },
  };
};
