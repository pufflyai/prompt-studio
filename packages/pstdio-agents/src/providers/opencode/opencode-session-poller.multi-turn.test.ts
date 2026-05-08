import { describe, expect, it } from "bun:test";
import { createEventStore } from "../../services/event-store";
import type { JsonPatch } from "../../types";
import { pollOpencodeMessages } from "./opencode-session-poller";
import {
  completedAssistant,
  createMessageTimeline,
  questionAssistant,
  userMessage,
} from "./opencode-session-poller.test-helpers";

const pollIntervalMs = 10;
const tick = () => Bun.sleep(20);

describe("pollOpencodeMessages multi-turn conversation", () => {
  it("handles question→answer→question→answer→final response across 3 turns", async () => {
    const { loader, set } = createMessageTimeline();

    const es1 = createEventStore();
    set([userMessage("build a CLI tool")]);

    let resolvePost1: () => void;
    const mc1 = new Promise<void>((r) => {
      resolvePost1 = r;
    });

    const poll1 = pollOpencodeMessages({
      loadMessages: loader,
      sessionId: "s1",
      cwd: undefined,
      eventStore: es1,
      baselineCount: 1,
      messageComplete: mc1,
      pollIntervalMs,
    });

    await tick();
    set([userMessage("build a CLI tool"), questionAssistant()]);
    resolvePost1!();
    await tick();

    expect((await poll1).code).toBe(0);
    expect(
      es1
        .getHistory()
        .filter((p: JsonPatch) => p.path === "/status")
        .at(-1)?.value,
    ).toBe("completed");

    const es2 = createEventStore();
    const baseline2 = [userMessage("build a CLI tool"), questionAssistant()];
    set(baseline2);

    let resolvePost2: () => void;
    const mc2 = new Promise<void>((r) => {
      resolvePost2 = r;
    });

    const poll2 = pollOpencodeMessages({
      loadMessages: loader,
      sessionId: "s1",
      cwd: undefined,
      eventStore: es2,
      baselineCount: 2,
      messageComplete: mc2,
      pollIntervalMs,
    });

    await tick();
    set([...baseline2, userMessage("TypeScript")]);
    await tick();
    await tick();
    expect(es2.getHistory().filter((p) => p.path === "/status")).toHaveLength(0);

    set([...baseline2, userMessage("TypeScript"), questionAssistant()]);
    resolvePost2!();
    await tick();

    expect((await poll2).code).toBe(0);
    expect(
      es2
        .getHistory()
        .filter((p: JsonPatch) => p.path === "/status")
        .at(-1)?.value,
    ).toBe("completed");

    const es3 = createEventStore();
    const baseline3 = [...baseline2, userMessage("TypeScript"), questionAssistant()];
    set(baseline3);

    let resolvePost3: () => void;
    const mc3 = new Promise<void>((r) => {
      resolvePost3 = r;
    });

    const poll3 = pollOpencodeMessages({
      loadMessages: loader,
      sessionId: "s1",
      cwd: undefined,
      eventStore: es3,
      baselineCount: 4,
      messageComplete: mc3,
      pollIntervalMs,
    });

    await tick();
    set([...baseline3, userMessage("yes, add tests")]);
    await tick();
    await tick();
    expect(es3.getHistory().filter((p) => p.path === "/status")).toHaveLength(0);

    set([...baseline3, userMessage("yes, add tests"), completedAssistant("Done!")]);
    resolvePost3!();
    await tick();

    expect((await poll3).code).toBe(0);
    expect(
      es3
        .getHistory()
        .filter((p: JsonPatch) => p.path === "/status")
        .at(-1)?.value,
    ).toBe("completed");

    es1.close();
    es2.close();
    es3.close();
  }, 30_000);
});
