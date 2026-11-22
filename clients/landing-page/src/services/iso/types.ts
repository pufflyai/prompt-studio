export interface Dims {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

export interface BoxSpec extends Partial<Dims> {
  color?: string;
  html?: string;
  sideHtml?: string;
  className?: string;
  drag?: boolean;
  float?: boolean;
  restLift?: number;
  label?: string;
  home?: Pick<Dims, "x" | "y" | "z">;
  /** Runs when the visitor clicks the box without dragging it. */
  click?: () => void;
  /** Grabbing creates a copy from this spec and leaves the original in place. */
  copy?: BoxSpec;
}

export interface IsoBox extends Dims {
  t: Dims;
  lift: number;
  liftT: number;
  restLift: number;
  color: string;
  drag: boolean;
  float: boolean;
  phase: number;
  held: boolean;
  carried: boolean;
  isCopy: boolean;
  home?: Pick<Dims, "x" | "y" | "z">;
  copy?: BoxSpec;
  click?: () => void;
  grab: [number, number];
  el: HTMLElement;
  top: HTMLElement;
  right: HTMLElement;
  front: HTMLElement;
  shadow: HTMLElement;
  plate?: HTMLElement;
}

export interface Agent {
  name: string;
  color: string;
  x: number;
  y: number;
  z: number;
  home: Pick<Dims, "x" | "y" | "z">;
  phase: number;
  task: boolean;
  raised: boolean;
  wander?: [number, number, number];
  nextWander: number;
  el: HTMLElement;
  icon: HTMLElement;
  shadow: HTMLElement;
  /** Where the visitor holds the hand; it is drawn there while its work carries on underneath. */
  held?: [number, number, number];
  /** The box in the hand while it carries one; grabbing the hand drops it. */
  carrying?: IsoBox;
  /** Left over from being held: shrinks every frame so the hand springs back to its work. */
  offset?: [number, number, number];
}

export interface DropTarget {
  x: number;
  y: number;
  w: number;
  d: number;
  accept: (box: IsoBox) => boolean;
  drop: (box: IsoBox) => void;
}

export interface World {
  W: number;
  D: number;
  top?: number;
  bottom?: number;
}

/** Thrown out of `awake()` once the scene is gone, which ends every scene loop. */
export const DISPOSED = Symbol("disposed");

export const div = (className: string, html = "") => {
  const el = document.createElement("div");
  el.className = className;
  el.innerHTML = html;
  return el;
};

export const shade = (color: string, percent: number) => `color-mix(in oklab, ${color} ${100 - percent}%, black)`;
