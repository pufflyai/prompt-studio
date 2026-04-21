import { describe, expect, it, mock } from "bun:test";
import { EventBus } from "./event-bus";

describe("EventBus", () => {
  it("starts with seq 0", () => {
    const bus = new EventBus();
    expect(bus.seq).toBe(0);
  });

  it("increments seq on emit", () => {
    const bus = new EventBus();
    bus.emit("projects", "set", { id: "1", name: "test" });
    expect(bus.seq).toBe(1);
    bus.emit("projects", "set", { id: "2", name: "test2" });
    expect(bus.seq).toBe(2);
  });

  it("notifies subscribers on emit", () => {
    const bus = new EventBus();
    const cb = mock(() => {});

    bus.subscribe(cb);
    bus.emit("projects", "set", { id: "1" });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({
      table: "projects",
      op: "set",
      data: { id: "1" },
      seq: 1,
    });
  });

  it("stops notifying after unsubscribe", () => {
    const bus = new EventBus();
    const cb = mock(() => {});

    const unsub = bus.subscribe(cb);
    bus.emit("projects", "set", { id: "1" });
    unsub();
    bus.emit("projects", "set", { id: "2" });

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("returns events since a given seq", () => {
    const bus = new EventBus();
    bus.emit("projects", "set", { id: "1" });
    bus.emit("projects", "set", { id: "2" });
    bus.emit("projects", "delete", { id: "1" });

    const since1 = bus.getSince(1);
    expect(since1).toHaveLength(2);
    expect(since1[0].seq).toBe(2);
    expect(since1[1].seq).toBe(3);

    const since0 = bus.getSince(0);
    expect(since0).toHaveLength(3);
  });

  it("returns empty array when since >= current seq", () => {
    const bus = new EventBus();
    bus.emit("projects", "set", { id: "1" });

    expect(bus.getSince(1)).toHaveLength(0);
    expect(bus.getSince(5)).toHaveLength(0);
  });

  it("respects buffer limit and drops oldest events", () => {
    const bus = new EventBus({ bufferSize: 3 });

    bus.emit("projects", "set", { id: "1" });
    bus.emit("projects", "set", { id: "2" });
    bus.emit("projects", "set", { id: "3" });
    bus.emit("projects", "set", { id: "4" });

    const all = bus.getSince(0);
    expect(all).toHaveLength(3);
    expect(all[0].seq).toBe(2);
    expect(bus.minSeq()).toBe(2);
  });

  it("returns null min seq when buffer is empty", () => {
    const bus = new EventBus();
    expect(bus.minSeq()).toBeNull();
  });

  it("supports multiple subscribers", () => {
    const bus = new EventBus();
    const cb1 = mock(() => {});
    const cb2 = mock(() => {});

    bus.subscribe(cb1);
    bus.subscribe(cb2);
    bus.emit("agents", "set", { id: "a" });

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});
