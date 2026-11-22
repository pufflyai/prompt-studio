import { dust, grabAgent, highFive } from "./agents";
import { clamp } from "./motion";
import { unproject } from "./projection";
import { supportHeight } from "./render";
import type { IsoBox, IsoScene } from "./scene";

// How far the pointer must move before a press on a box becomes a drag instead of a click.
const DRAG_DISTANCE = 5;

const stagePoint = (scene: IsoScene, event: PointerEvent) => {
  const rect = scene.stage.getBoundingClientRect();
  return [(event.clientX - rect.left) / scene.scale, (event.clientY - rect.top) / scene.scale] as const;
};

/** A press becomes a drag once the pointer moves; releasing without moving is a click. */
export const pressBox = (scene: IsoScene, source: IsoBox, event: PointerEvent) => {
  if ((!source.drag && !source.click) || scene.held || scene.press) return;
  event.preventDefault();
  scene.lastUser = performance.now();
  scene.press = { box: source, at: stagePoint(scene, event) };
};

const startDrag = (scene: IsoScene) => {
  const source = scene.press!.box;
  if (!source.drag) return;
  let box = source;
  if (source.copy) {
    const { x, y, z, w, d, h } = source;
    box = scene.add({ ...source.copy, x, y, z, w, d, h, drag: true, className: "iso-pop" });
    box.isCopy = true;
  }
  const [sx, sy] = scene.press!.at;
  const [wx, wy] = unproject(scene, sx, sy, box.z + box.lift + box.h);
  box.grab = [box.x - wx, box.y - wy];
  box.held = true;
  // Taking a box from an agent's hand: the agent's motion stops applying (see agents.ts).
  box.carried = false;
  box.liftT = 26;
  scene.held = box;
  scene.setHand("🤏");
  scene.onGrab?.(box);
};

const settle = (scene: IsoScene, box: IsoBox) => {
  const cx = box.t.x + box.t.w / 2;
  const cy = box.t.y + box.t.d / 2;
  const target = scene.targets.find(
    (t) => t.accept(box) && cx >= t.x && cx <= t.x + t.w && cy >= t.y && cy <= t.y + t.d,
  );
  if (target) target.drop(box);
  else if (box.isCopy) scene.fadeOut(box);
  else if (box.home) {
    Object.assign(box.t, box.home);
    scene.onHome?.(box);
  } else {
    box.t.z = supportHeight(scene.boxes, box);
    scene.onFree?.(box);
  }
};

/** Releasing a pressed hand: put it down if it was picked up, otherwise high five it. */
const releaseHand = (scene: IsoScene) => {
  const { agent } = scene.agentPress!;
  scene.agentPress = null;
  if (scene.releaseAgent) {
    scene.releaseAgent();
    scene.releaseAgent = null;
  } else highFive(scene, agent);
};

const release = (scene: IsoScene) => {
  if (scene.agentPress) {
    releaseHand(scene);
    return;
  }
  const press = scene.press;
  scene.press = null;
  const box = scene.held;
  scene.lastUser = performance.now();
  if (!box) {
    press?.box.click?.();
    return;
  }
  scene.held = null;
  box.held = false;
  box.liftT = box.restLift;
  scene.setHand("🖐️");
  scene.onRelease?.(box);
  settle(scene, box);
};

export const bindPointer = (scene: IsoScene) => {
  const { stage, hand } = scene;
  stage.addEventListener("pointermove", (event) => {
    const [sx, sy] = stagePoint(scene, event);
    scene.pointer = [sx, sy];
    hand.style.transform = `translate(${sx}px,${sy}px)`;
    hand.classList.add("iso-on");
    const pressed = scene.agentPress;
    if (pressed) {
      if (!scene.heldAgent && Math.hypot(sx - pressed.at[0], sy - pressed.at[1]) > DRAG_DISTANCE)
        scene.releaseAgent = grabAgent(scene, pressed.agent);
      const agent = scene.heldAgent;
      if (agent?.held) {
        const z = agent.held[2];
        const [wx, wy] = unproject(scene, sx, sy, z);
        agent.held = [clamp(wx, -40, scene.world.W + 40), clamp(wy, -40, scene.world.D + 40), z];
      }
      return;
    }
    const press = scene.press;
    if (press && !scene.held && Math.hypot(sx - press.at[0], sy - press.at[1]) > DRAG_DISTANCE) startDrag(scene);
    const box = scene.held;
    if (!box) return;
    scene.lastUser = performance.now();
    const [wx, wy] = unproject(scene, sx, sy, box.t.z + box.liftT + box.t.h);
    box.t.x = clamp(wx + box.grab[0], -30, scene.world.W - box.t.w + 30);
    box.t.y = clamp(wy + box.grab[1], -30, scene.world.D - box.t.d + 30);
  });
  stage.addEventListener("pointerleave", () => hand.classList.remove("iso-on"));
  // Clicking empty space (not a box you can use, not another hand) makes the visitor's hand pat the floor.
  stage.addEventListener("pointerdown", (event) => {
    if (scene.press || scene.held) return;
    const [sx, sy] = stagePoint(scene, event);
    hand
      .querySelector(".iso-icon")!
      .animate(
        [
          { transform: "translate(-50%,-55%)" },
          { transform: "translate(-50%,-35%) scale(.9)", offset: 0.4 },
          { transform: "translate(-50%,-55%)" },
        ],
        { duration: 260, easing: "ease-out" },
      );
    setTimeout(() => dust(scene, sx, sy + 6), 100);
  });
  // Buttons drawn inside a box's placeholder UI, such as a workbench's "+" tab.
  stage.addEventListener(
    "pointerdown",
    (event) => {
      const action = (event.target as Element).closest<HTMLElement>("[data-iso-action]");
      if (!action) return;
      event.stopPropagation();
      scene.lastUser = performance.now();
      scene.onAction?.(action.dataset.isoAction!);
    },
    true,
  );
  const up = () => release(scene);
  // A cancelled pointer (a scroll took over, a context menu) puts a held hand down without a high five.
  const cancel = () => {
    if (!scene.agentPress) return;
    scene.agentPress = null;
    scene.releaseAgent?.();
    scene.releaseAgent = null;
  };
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  scene.cleanups.push(
    () => window.removeEventListener("pointerup", up),
    () => window.removeEventListener("pointercancel", cancel),
  );
};
