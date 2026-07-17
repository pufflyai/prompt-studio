export type AnchorId = "primary" | "secondary" | "attached";

export type AnchorPersistence = "primary" | "derived" | "detached";

export type AnchorCandidates = "global" | "scoped";

export type AnchorReadId = "primary" | "attached";

export type SlotOwner = "project" | "resource";

export type SlotPresentation = "docked" | "floating" | "hidden";

export type SlotRole = "panels" | "projection" | "chrome" | "transient";

export interface FrameSlotSize {
  defaultPx?: number;
  minPx?: number;
  maxPx?: number;
}

export interface FrameSlot {
  kind: "slot";
  id: string;
  owner: SlotOwner;
  role: SlotRole;
  reads?: readonly AnchorReadId[];
  navigator?: boolean;
  companionOf?: string;
  targetable?: boolean;
  presentations?: readonly SlotPresentation[];
  size?: FrameSlotSize;
}

export interface FrameSplit {
  kind: "split";
  id: string;
  direction: "row" | "column";
  children: readonly FrameNode[];
}

export type FrameNode = FrameSlot | FrameSplit;

export type SlotsOf<T> = T extends { root: infer TRoot }
  ? SlotsOf<TRoot>
  : T extends { kind: "slot"; id: infer TId extends string }
    ? TId
    : T extends { kind: "split"; children: infer TChildren extends readonly unknown[] }
      ? number extends TChildren["length"]
        ? string
        : SlotsOf<TChildren[number]>
      : never;

export interface SideBinding<TSlot extends string = string> {
  slot: TSlot;
  persistence: AnchorPersistence;
  candidates: AnchorCandidates;
}

export interface Frame<TSlot extends string = string> {
  id: string;
  root: FrameNode;
  primary: TSlot;
  secondary?: SideBinding<TSlot>;
  attached?: SideBinding<TSlot>;
  slots: Readonly<Record<TSlot, FrameSlot & { id: TSlot }>>;
}
