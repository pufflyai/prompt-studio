import { describe, expect, it } from "bun:test";
import { pollOpencodeMessages } from "./opencode-session-poller";
import {
  completedAssistant,
  createMessageTimeline,
  lastStatusPatch,
  questionAssistant,
  recordingSink,
  userMessage,
} from "./opencode-session-poller.test-helpers";

const pollIntervalMs = 10;
const tick = () => Bun.sleep(20);

describe("pollOpencodeMessages multi-turn conversation", () => {
  it("handles question→answer→question→answer→final response across 3 turns", async () => {
    const { loader, set } = createMessageTimeline();

    const turn1 = recordingSink();
    set([userMessage("build a CLI tool")]);

    let resolvePost1: () => void;
    const mc1 = new Promise<void>((r) => {
      resolvePost1 = r;
    });

    const poll1 = pollOpencodeMessages({
      loadMessages: loader,
      sessionId: "s1",
      cwd: undefined,
      events: turn1.sink,
      baselineCount: 1,
      messageComplete: mc1,
      pollIntervalMs,
    });

    await tick();
    set([userMessage("build a CLI tool"), questionAssistant()]);
    resolvePost1!();
    await tick();

    expect(await poll1).toEqual({ status: "completed" });
    expect(lastStatusPatch(turn1.patches)?.value).toBe("completed");

    const turn2 = recordingSink();
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
      events: turn2.sink,
      baselineCount: 2,
      messageComplete: mc2,
      pollIntervalMs,
    });

    await tick();
    set([...baseline2, userMessage("TypeScript")]);
    await tick();
    await tick();
    expect(turn2.patches.filter((p) => p.path === "/status")).toHaveLength(0);

    set([...baseline2, userMessage("TypeScript"), questionAssistant()]);
    resolvePost2!();
    await tick();

    expect(await poll2).toEqual({ status: "completed" });
    expect(lastStatusPatch(turn2.patches)?.value).toBe("completed");

    const turn3 = recordingSink();
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
      events: turn3.sink,
      baselineCount: 4,
      messageComplete: mc3,
      pollIntervalMs,
    });

    await tick();
    set([...baseline3, userMessage("yes, add tests")]);
    await tick();
    await tick();
    expect(turn3.patches.filter((p) => p.path === "/status")).toHaveLength(0);

    set([...baseline3, userMessage("yes, add tests"), completedAssistant("Done!")]);
    resolvePost3!();
    await tick();

    expect(await poll3).toEqual({ status: "completed" });
    expect(lastStatusPatch(turn3.patches)?.value).toBe("completed");
  }, 30_000);
});
