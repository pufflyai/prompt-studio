import { wait } from "./motion";
import { bindPointer, pressBox } from "./pointer";
import { COS, type Origin, paintOrder, project, SIN, topMatrix } from "./projection";
import { renderAgent, renderBox } from "./render";
import { type Agent, type BoxSpec, DISPOSED, type DropTarget, div, type IsoBox, shade, type World } from "./types";

export type { Agent, BoxSpec, DropTarget, IsoBox, World } from "./types";
export { DISPOSED, shade } from "./types";

export class IsoScene implements Origin {
  readonly ox: number;
  readonly oy: number;
  readonly width: number;
  readonly height: number;
  readonly ui: HTMLElement;
  readonly hand: HTMLElement;
  boxes: IsoBox[] = [];
  agents: Agent[] = [];
  targets: DropTarget[] = [];
  held: IsoBox | null = null;
  pointer: [number, number] | null = null;
  lastUser = Number.NEGATIVE_INFINITY;
  disposed = false;
  onTick?: () => void;
  onGrab?: (box: IsoBox) => void;
  onRelease?: (box: IsoBox) => void;
  onFree?: (box: IsoBox) => void;
  onHome?: (box: IsoBox) => void;
  onAction?: (action: string) => void;
  press: { box: IsoBox; at: readonly [number, number] } | null = null;
  readonly stage: HTMLElement;
  private shadows: HTMLElement;
  private solids: HTMLElement;
  scale = 1;
  private visible = false;
  private running = false;
  private readonly still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private timers: number[] = [];
  readonly cleanups: (() => void)[] = [];

  constructor(
    private host: HTMLElement,
    readonly world: World,
  ) {
    const margin = 26;
    const top = world.top ?? 90;
    this.width = (world.W + world.D) * COS + margin * 2;
    this.height = (world.W + world.D) * SIN + top + (world.bottom ?? 30);
    this.ox = world.D * COS + margin;
    this.oy = top;
    this.stage = div("iso-stage");
    this.stage.style.width = `${this.width}px`;
    this.stage.style.height = `${this.height}px`;
    const floor = div("iso-layer");
    this.shadows = div("iso-layer");
    this.solids = div("iso-layer");
    this.ui = div("iso-layer iso-ui");
    this.stage.append(floor, this.shadows, this.solids, this.ui);
    host.append(this.stage);
    const grid = div("iso-face iso-floor");
    floor.append(grid);
    this.place(grid, -40, -40, 0, world.W + 80, world.D + 80);
    this.hand = div("iso-hand iso-user", '<span class="iso-icon">🖐️</span><span class="iso-bubble"></span>');
    this.ui.append(this.hand);
    this.fit();
    const resize = new ResizeObserver(() => this.fit());
    resize.observe(host);
    const seen = new IntersectionObserver((entries) => {
      this.visible = entries[entries.length - 1].isIntersecting;
      if (this.visible) this.loop();
    });
    seen.observe(host);
    bindPointer(this);
    this.cleanups.push(
      () => resize.disconnect(),
      () => seen.disconnect(),
    );
  }

  P(x: number, y: number, z: number) {
    return project(this, x, y, z);
  }

  place(el: HTMLElement, x: number, y: number, z: number, w: number, d: number) {
    el.style.width = `${w}px`;
    el.style.height = `${d}px`;
    el.style.transform = topMatrix(this, x, y, z);
  }

  dispose() {
    this.disposed = true;
    this.held = null;
    for (const timer of this.timers) clearInterval(timer);
    for (const cleanup of this.cleanups) cleanup();
    this.host.replaceChildren();
  }

  /** Resolves when the scene is on screen; loops call it every cycle so they pause off screen. */
  awake() {
    return new Promise<void>((resolve, reject) => {
      const check = () => {
        if (this.disposed) reject(DISPOSED);
        else if (this.visible && !this.still) resolve();
        else setTimeout(check, 300);
      };
      check();
    });
  }

  /** Like `wait`, but ends the calling loop once the scene is gone. */
  async wait(ms: number) {
    await wait(ms);
    if (this.disposed) throw DISPOSED;
  }

  run(loop: () => Promise<unknown>) {
    loop().catch((error) => {
      if (error !== DISPOSED) throw error;
    });
  }

  every(ms: number, step: () => void) {
    this.timers.push(window.setInterval(step, ms));
  }

  userBusy(ms: number) {
    return Boolean(this.held) || performance.now() - this.lastUser < ms;
  }

  add<T extends object = object>(spec: BoxSpec & T): IsoBox & Omit<T, keyof BoxSpec> {
    const dims = { x: 0, y: 0, z: 0, w: 20, d: 20, h: 20, ...spec };
    const restLift = spec.restLift ?? 0;
    const el = div(`iso-box ${spec.className ?? ""}`);
    const top = div("iso-face", spec.html);
    const right = div("iso-face", spec.sideHtml);
    const front = div("iso-face", spec.sideHtml);
    const shadow = div("iso-face iso-shadow");
    el.append(right, front, top);
    this.solids.append(el);
    this.shadows.append(shadow);
    const box = Object.assign({}, spec, dims, {
      t: { x: dims.x, y: dims.y, z: dims.z, w: dims.w, d: dims.d, h: dims.h },
      lift: restLift,
      liftT: restLift,
      restLift,
      color: spec.color ?? "var(--chakra-colors-bg-panel)",
      drag: spec.drag ?? false,
      float: spec.float ?? false,
      phase: Math.random() * 6,
      held: false,
      carried: false,
      isCopy: false,
      grab: [0, 0] as [number, number],
      el,
      top,
      right,
      front,
      shadow,
    }) as IsoBox & Omit<T, keyof BoxSpec>;
    if (spec.label !== undefined) this.label(box, spec.label);
    el.addEventListener("pointerdown", (event) => pressBox(this, box, event));
    this.paint(box);
    this.boxes.push(box);
    return box;
  }

  paint(box: IsoBox) {
    box.top.style.background = box.color;
    box.right.style.background = shade(box.color, 22);
    box.front.style.background = shade(box.color, 38);
  }

  label(box: IsoBox, html: string, small = false) {
    if (!box.plate) {
      box.plate = div("iso-plate");
      this.ui.append(box.plate);
    }
    if (box.plate.innerHTML !== html) box.plate.innerHTML = html;
    box.plate.classList.toggle("iso-small", small);
  }

  remove(box: IsoBox) {
    box.el.remove();
    box.shadow.remove();
    box.plate?.remove();
    this.boxes = this.boxes.filter((other) => other !== box);
  }

  fadeOut(box: IsoBox) {
    box.t.h = 0;
    box.el.classList.add("iso-fade");
    setTimeout(() => this.remove(box), 420);
  }

  private fit() {
    const available = this.host.clientWidth;
    if (!available) return;
    // Scenes grow with their column so they read well on large screens too.
    this.scale = Math.min(1.8, available / this.width);
    this.stage.style.transform = `scale(${this.scale})`;
    this.stage.style.left = `${(available - this.width * this.scale) / 2}px`;
    this.stage.style.setProperty("--iso-inverse", Math.min(1.45, 1 / this.scale).toFixed(3));
    this.host.style.height = `${this.height * this.scale}px`;
  }

  private loop() {
    if (this.running) return;
    this.running = true;
    const frame = (time: number) => {
      if (!this.visible || this.disposed) {
        this.running = false;
        return;
      }
      // Reduced motion pauses the scene loops (see `awake`) but keeps drawing, so dragging still works.
      this.tick(time);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private tick(time: number) {
    this.onTick?.();
    for (const box of this.boxes) {
      const k = box.held || box.carried ? 0.45 : 0.16;
      for (const key of ["x", "y", "z", "w", "d", "h"] as const) box[key] += (box.t[key] - box[key]) * k;
      const bob = box.float && !box.held && !box.carried ? Math.sin(time / 650 + box.phase) * 4 : 0;
      box.lift += (box.liftT + bob - box.lift) * 0.18;
      renderBox(this, box);
    }
    const order = paintOrder(
      this,
      this.boxes.map((b) => ({
        x0: b.x,
        x1: b.x + b.w,
        y0: b.y,
        y1: b.y + b.d,
        z0: b.z + b.lift,
        z1: b.z + b.lift + Math.max(0, b.h),
      })),
    );
    order.forEach((index, position) => {
      this.boxes[index].el.style.zIndex = String(position + 1);
    });
    for (const agent of this.agents) renderAgent(this, agent, time);
  }

  attachAgent(agent: Agent) {
    this.shadows.append(agent.shadow);
    this.ui.append(agent.el);
    this.agents.push(agent);
  }

  setHand(icon: string) {
    this.hand.querySelector(".iso-icon")!.textContent = icon;
    this.hand.classList.toggle("iso-grab", icon === "🤏");
  }
}
