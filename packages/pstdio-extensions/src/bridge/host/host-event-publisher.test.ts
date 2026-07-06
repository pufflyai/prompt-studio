import { describe, expect, test } from "bun:test";
import type { HostEventMessage } from "../contract";
import { createHostEventPublisher } from "./host-event-publisher";

describe("createHostEventPublisher", () => {
  test("delivers events to the bound sink", () => {
    const publisher = createHostEventPublisher();
    const received: HostEventMessage[] = [];
    publisher.bind((message) => received.push(message));

    publisher.emit({ scope: "terminal.session", payload: { kind: "data" } });

    expect(received).toEqual([{ scope: "terminal.session", payload: { kind: "data" } }]);
  });

  test("buffers events emitted before the guest connects and flushes them on bind", () => {
    const publisher = createHostEventPublisher();
    publisher.emit({ scope: "terminal.session", payload: 1 });
    publisher.emit({ scope: "terminal.session", payload: 2 });

    const received: unknown[] = [];
    publisher.bind((message) => received.push(message.payload));

    expect(received).toEqual([1, 2]);
    publisher.emit({ scope: "terminal.session", payload: 3 });
    expect(received).toEqual([1, 2, 3]);
  });

  test("unbind returns the publisher to buffering until the next bind", () => {
    const publisher = createHostEventPublisher();
    const first: unknown[] = [];
    publisher.bind((message) => first.push(message.payload));
    publisher.unbind();
    publisher.emit({ scope: "s", payload: "buffered" });
    expect(first).toEqual([]);

    const second: unknown[] = [];
    publisher.bind((message) => second.push(message.payload));

    expect(second).toEqual(["buffered"]);
  });

  test("rebinding routes subsequent events to the new sink", () => {
    const publisher = createHostEventPublisher();
    const first: unknown[] = [];
    const second: unknown[] = [];
    publisher.bind((message) => first.push(message.payload));
    publisher.emit({ scope: "s", payload: "a" });
    publisher.bind((message) => second.push(message.payload));
    publisher.emit({ scope: "s", payload: "b" });

    expect(first).toEqual(["a"]);
    expect(second).toEqual(["b"]);
  });

  test("notifies disconnect listeners when the sink is unbound", () => {
    const publisher = createHostEventPublisher();
    let disconnects = 0;
    publisher.onDisconnect(() => {
      disconnects += 1;
    });

    publisher.unbind();

    expect(disconnects).toBe(1);
  });
});
