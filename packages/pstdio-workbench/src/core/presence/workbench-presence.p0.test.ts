import { expect, test } from "bun:test";
import { createWorkbench } from "../workbench-core";

const source = (initial: Array<{ id: string; label: string }>) => {
  let participants = initial;
  const listeners = new Set<() => void>();
  return {
    getParticipants: () => participants,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(next: typeof initial) {
      participants = next;
      for (const listener of listeners) listener();
    },
    listeners,
  };
};

test("presence combines open tabs and keeps each editor until its last source closes", () => {
  const presence = createWorkbench().presence;
  expect(presence).toBeDefined();
  const alex = { id: "device-a", label: "Alex" };
  const sam = { id: "device-b", label: "Sam" };
  const first = source([alex]);
  const second = source([alex, sam]);
  const firstTab = presence.register(first);
  const secondTab = presence.register(second);
  expect(presence.store.getState().participants).toEqual([alex, sam]);
  firstTab.dispose();
  expect(presence.store.getState().participants).toEqual([alex, sam]);
  second.update([sam]);
  expect(presence.store.getState().participants).toEqual([sam]);
  secondTab.dispose();
  expect(presence.store.getState().participants).toEqual([]);
  expect(first.listeners.size + second.listeners.size).toBe(0);
});

test("text and selection notifications do not change chrome presence snapshots", () => {
  const presence = createWorkbench().presence;
  const room = source([{ id: "device-a", label: "Alex" }]);
  presence.register(room);
  const snapshot = presence.store.getState().participants;
  room.update([{ id: "device-a", label: "Alex" }]);
  expect(presence.store.getState().participants).toBe(snapshot);
  room.update([{ id: "device-a", label: "Alex renamed" }]);
  expect(presence.store.getState().participants).toEqual([{ id: "device-a", label: "Alex renamed" }]);
  presence.dispose();
  expect(room.listeners.size).toBe(0);
  expect(presence.store.getState().participants).toEqual([]);
});

test("two open views can observe the same source independently", () => {
  const presence = createWorkbench().presence;
  const room = source([{ id: "device-a", label: "Alex" }]);
  const first = presence.register(room);
  const second = presence.register(room);
  first.dispose();
  room.update([{ id: "device-b", label: "Sam" }]);
  expect(presence.store.getState().participants).toEqual([{ id: "device-b", label: "Sam" }]);
  second.dispose();
  expect(room.listeners.size).toBe(0);
});
