import { ease, wait } from "../iso/motion";

/** Thrown out of a recording step when a newer recording takes over. */
export const CANCELLED = Symbol("cancelled");

/**
 * Plays scripted "recordings" inside the Examples window: a fake cursor moves, clicks, drags,
 * and types. The window is drawn at a fixed size and scaled, so positions divide by `scale`.
 */
export class Director {
  scale = 1;
  visible = false;
  private run = 0;
  private x = 300;
  private y = 300;

  constructor(
    readonly root: HTMLElement,
    private cursor: HTMLElement,
  ) {}

  /** Starts a new recording; every step of the previous one throws `CANCELLED`. */
  next() {
    this.run += 1;
    return this.run;
  }

  stop() {
    this.run += 1;
  }

  find<T extends HTMLElement = HTMLElement>(selector: string) {
    return this.root.querySelector<T>(selector)!;
  }

  async step(id: number, ms: number) {
    await wait(ms);
    while (!this.visible && id === this.run) await wait(300);
    if (id !== this.run) throw CANCELLED;
  }

  private position(el: Element, fx: number, fy: number) {
    const frame = this.root.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    return [
      (rect.left - frame.left + rect.width * fx) / this.scale,
      (rect.top - frame.top + rect.height * fy) / this.scale,
    ] as const;
  }

  private place() {
    this.cursor.style.transform = `translate(${this.x}px,${this.y}px)`;
  }

  async moveTo(id: number, el: Element, fx = 0.5, fy = 0.5, ms = 650) {
    [this.x, this.y] = this.position(el, fx, fy);
    this.cursor.style.transitionDuration = `${ms}ms`;
    this.place();
    await this.step(id, ms + 60);
  }

  async click(id: number) {
    this.cursor.classList.remove("rec-click");
    void this.cursor.offsetWidth;
    this.cursor.classList.add("rec-click");
    await this.step(id, 200);
  }

  async drag(id: number, ms: number, dx: number, dy: number, update: (k: number) => void) {
    const [x0, y0] = [this.x, this.y];
    this.cursor.style.transitionDuration = "0ms";
    const start = performance.now();
    for (;;) {
      const k = Math.min(1, (performance.now() - start) / ms);
      const eased = ease(k);
      this.x = x0 + dx * eased;
      this.y = y0 + dy * eased;
      this.place();
      update(eased);
      if (k >= 1) break;
      await this.step(id, 16);
    }
  }

  async type(id: number, el: HTMLElement, text: string) {
    for (const char of text) {
      el.textContent += char;
      await this.step(id, 35 + Math.random() * 45);
    }
  }

  /** Animates an element from where it was to where `move` puts it. */
  flip(el: HTMLElement, move: () => void) {
    const before = el.getBoundingClientRect();
    move();
    const after = el.getBoundingClientRect();
    el.style.transition = "none";
    el.style.transform = `translate(${(before.left - after.left) / this.scale}px,${(before.top - after.top) / this.scale}px)`;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.style.transition = "transform .6s cubic-bezier(.3,1,.4,1)";
        el.style.transform = "";
      }),
    );
  }
}
