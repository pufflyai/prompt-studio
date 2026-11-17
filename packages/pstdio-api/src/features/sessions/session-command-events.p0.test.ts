import { expect, test } from "bun:test";
import { EventBus } from "../sync/event-bus";
import { emitSessionCommandsChanged, observeSessionCommandsChanged } from "./session-command-events";

test("native command hints reach only exact live observers without entering sync traffic or replay", () => {
  const bus = new EventBus();
  let exact = 0;
  let other = 0;
  const first = observeSessionCommandsChanged(bus, "a", () => {
    exact++;
  });
  const second = observeSessionCommandsChanged(bus, "a", () => {
    exact++;
  });
  const foreign = observeSessionCommandsChanged(bus, "b", () => {
    other++;
  });
  emitSessionCommandsChanged(bus, "a");
  expect({ exact, other }).toEqual({ exact: 2, other: 0 });
  expect(bus.seq).toBe(0);
  expect(bus.getSince(0)).toEqual([]);
  first();
  second();
  foreign();
  emitSessionCommandsChanged(bus, "a");
  expect(exact).toBe(2);
  const reopened = observeSessionCommandsChanged(bus, "a", () => {
    exact++;
  });
  first();
  emitSessionCommandsChanged(bus, "a");
  expect(exact).toBe(3);
  reopened();
});
