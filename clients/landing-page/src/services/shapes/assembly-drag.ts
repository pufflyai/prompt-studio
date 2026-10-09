export interface AssemblyPosition {
  x: number;
  y: number;
  angle: number;
}

interface AssemblyDragOptions {
  scene: SVGSVGElement;
  take: (id: string) => AssemblyPosition;
  move: (id: string, point: AssemblyPosition) => void;
  drop: (id: string, snap: boolean) => void;
  nudge: (id: string, point: AssemblyPosition) => void;
}

/** Pointer capture keeps mouse, pen, and touch drags attached outside the SVG. */
export const bindAssemblyDrag = ({ scene, take, move, drop, nudge }: AssemblyDragOptions) => {
  let drag: { id: string; pointer: number; start: DOMPoint; origin: AssemblyPosition } | undefined;
  const pieceId = (target: EventTarget | null) =>
    (target as Element).closest<SVGGElement>("[data-assembly-piece]")?.dataset.assemblyPiece;
  const localPoint = (event: PointerEvent) =>
    new DOMPoint(event.clientX, event.clientY).matrixTransform(scene.getScreenCTM()!.inverse());
  const down = (event: PointerEvent) => {
    const id = pieceId(event.target);
    if (!id || drag || event.button !== 0) return;
    event.preventDefault();
    const origin = { ...take(id) };
    drag = { id, pointer: event.pointerId, start: localPoint(event), origin };
    scene.setPointerCapture(event.pointerId);
    scene.querySelector<SVGGElement>(`[data-assembly-piece="${id}"]`)!.focus({ preventScroll: true });
  };
  const pointerMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const point = localPoint(event);
    move(drag.id, {
      ...drag.origin,
      x: drag.origin.x + point.x - drag.start.x,
      y: drag.origin.y + point.y - drag.start.y,
    });
  };
  const end = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    if (event.type === "pointercancel") nudge(drag.id, drag.origin);
    drop(drag.id, event.type !== "pointercancel");
    drag = undefined;
    if (scene.hasPointerCapture(event.pointerId)) scene.releasePointerCapture(event.pointerId);
  };
  const key = (event: KeyboardEvent) => {
    if (event.key === "Escape" && drag) {
      nudge(drag.id, drag.origin);
      drop(drag.id, false);
      const pointer = drag.pointer;
      drag = undefined;
      scene.releasePointerCapture(pointer);
      return;
    }
    const id = pieceId(event.target);
    if (!id || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    const point = { ...take(id) };
    const step = event.shiftKey ? 24 : 8;
    if (event.key === "ArrowLeft") point.x -= step;
    if (event.key === "ArrowRight") point.x += step;
    if (event.key === "ArrowUp") point.y -= step;
    if (event.key === "ArrowDown") point.y += step;
    nudge(id, point);
    drop(id, event.key === "Enter" || event.key === " ");
  };
  scene.addEventListener("pointerdown", down);
  scene.addEventListener("pointermove", pointerMove);
  scene.addEventListener("pointerup", end);
  scene.addEventListener("pointercancel", end);
  scene.addEventListener("lostpointercapture", end);
  scene.addEventListener("keydown", key);
  return () => {
    scene.removeEventListener("pointerdown", down);
    scene.removeEventListener("pointermove", pointerMove);
    scene.removeEventListener("pointerup", end);
    scene.removeEventListener("pointercancel", end);
    scene.removeEventListener("lostpointercapture", end);
    scene.removeEventListener("keydown", key);
  };
};
