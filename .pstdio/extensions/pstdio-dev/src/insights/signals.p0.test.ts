import { describe, expect, test } from "bun:test";
import { renderDigest } from "./digest";
import { extractSignals, heuristicVerdict, type SessionMessage, segmentTurns, userRequestText } from "./signals";

let next = 0;
const user = (text: string): SessionMessage => ({ id: `m${next++}`, role: "user", parts: [{ type: "text", text }] });
const agent = (text: string): SessionMessage => ({
  id: `m${next++}`,
  role: "assistant",
  parts: [{ type: "text", text }],
});
const tool = (status: "completed" | "failed" | "denied", errorText = ""): SessionMessage => ({
  id: `m${next++}`,
  role: "assistant",
  parts: [{ type: "tool", tool: "bash", status, state: errorText ? { errorText } : {} }],
});
const error = (message: string): SessionMessage => ({
  id: `m${next++}`,
  role: "assistant",
  parts: [{ type: "error", errorType: "other", message }],
});

const judge = (status: string, messages: SessionMessage[]) => {
  const signals = extractSignals(segmentTurns(messages));
  return { signals, verdict: heuristicVerdict({ status }, signals) };
};

describe("turns", () => {
  test("background notifications fold into the agent's turn instead of counting as user requests", () => {
    const turns = segmentTurns([
      user("fix the build"),
      agent("Working on it"),
      user("<task-notification><summary>CI finished</summary></task-notification>"),
      agent("CI is green. Done."),
    ]);
    expect(turns).toHaveLength(1);
    expect(turns[0]!.assistantTexts).toEqual(["Working on it", "CI is green. Done."]);
    expect(turns[0]!.notices).toEqual(["[background task notification]"]);
  });

  test("editor context blocks are dropped from the request", () => {
    expect(
      userRequestText("# Context from my IDE setup:\n## Open tabs:\n- a.md\n\n## My request:\ncreate a proposal\n"),
    ).toBe("create a proposal");
    expect(userRequestText("## My request for Codex:\nfix it")).toBe("fix it");
  });

  test("planner prompts and resume nudges are automated, not the person's turns", () => {
    const { signals } = judge("completed", [
      user("Implement ticket PS-1"),
      agent("Implemented."),
      user("resume"),
      agent("Resumed."),
    ]);
    expect(signals.userTurns).toBe(0);
    expect(signals.resumeNudges).toBe(1);
  });
});

describe("heuristic verdicts", () => {
  test("a usage limit that ends a failed run is an infrastructure failure", () => {
    const { verdict } = judge("failed", [
      user("release 0.47"),
      agent("Starting"),
      error("You've hit your 5-hour limit · resets 9:10pm"),
    ]);
    expect(verdict).toMatchObject({ outcome: "infra_failure", failureMode: "infra_usage_limit", needsReview: false });
  });

  test("a user complaint outranks an infrastructure error and asks for review", () => {
    const { verdict, signals } = judge("failed", [
      user("get release verification green"),
      agent("Switching the Ubuntu mirror."),
      user("why are you switching mirror? don't do that this is probably an intermittent issue!"),
      agent("Reverted."),
      error("You've hit your 5-hour limit"),
    ]);
    expect(signals.corrections).toBe(1);
    expect(verdict).toMatchObject({ outcome: "failed", failureMode: null, needsReview: true });
    expect(verdict.evidence).toContain("why are you switching mirror");
  });

  test("one correction on a completed run is partial", () => {
    const { verdict } = judge("completed", [
      user("write an X post"),
      agent("Here is a long thread."),
      user("no, I want to keep it very short"),
      agent("Shortened."),
    ]);
    expect(verdict.outcome).toBe("partial");
  });

  test("the first request never counts as a correction", () => {
    const { signals } = judge("completed", [user("why is shift - opening the shortcut menu?"), agent("Fixed.")]);
    expect(signals.corrections).toBe(0);
  });

  test("a clean single request is a success, and praise raises confidence", () => {
    expect(judge("completed", [user("refine PS-1"), agent("Refined.")]).verdict).toMatchObject({
      outcome: "success",
      confidence: "medium",
    });
    expect(judge("completed", [user("refine PS-1"), agent("Refined."), user("perfect, thanks")]).verdict).toMatchObject(
      {
        outcome: "success",
        confidence: "high",
      },
    );
  });

  test("many failing tool calls flag a possible loop", () => {
    const messages = [user("fix CI"), ...Array.from({ length: 20 }, () => tool("failed", "exit 1")), tool("completed")];
    expect(judge("completed", messages).verdict).toMatchObject({ outcome: "partial", failureMode: "stuck_or_looping" });
  });

  test("silent cancels are unclear, not failures", () => {
    expect(judge("cancelled", [user("do it"), agent("On it")]).verdict).toMatchObject({
      outcome: "unclear",
      failureMode: "user_cancelled",
    });
  });

  test("running sessions are not judged", () => {
    expect(judge("in_progress", [user("do it")]).verdict.outcome).toBe("in_progress");
  });
});

describe("digest", () => {
  const header = {
    id: "s1",
    title: "Long session",
    status: "completed",
    agent: "a",
    model: "m",
    createdAt: "2026-11-01",
  };

  test("keeps the opening request and the final turn when it has to cut", () => {
    const messages = Array.from({ length: 40 }, (_, index) => [
      user(`request ${index} ${"x".repeat(400)}`),
      agent(`reply ${index} ${"y".repeat(400)}`),
    ]).flat();
    const turns = segmentTurns(messages);
    const digest = renderDigest(header, extractSignals(turns), turns, 4000);
    expect(digest.length).toBeLessThanOrEqual(4000);
    expect(digest).toContain("request 0 ");
    expect(digest).toContain("reply 39 ");
    expect(digest).toMatch(/\[… \d+ turn\(s\) omitted …\]/);
  });

  test("shows tool failures with their errors", () => {
    const turns = segmentTurns([user("build"), tool("failed", "bun: command not found"), agent("Done")]);
    const digest = renderDigest(header, extractSignals(turns), turns);
    expect(digest).toContain("TOOLS: 1 calls, 1 failed");
    expect(digest).toContain("✗ bash: bun: command not found");
    expect(digest).toContain("AGENT (final): Done");
  });
});

describe("false positives seen in real sessions", () => {
  test("skill bodies injected as user messages are not the person's turns", () => {
    const { signals } = judge("completed", [
      user("check the performance track"),
      agent("Checking"),
      user(
        "Base directory for this skill: /repo/.claude/skills/create-ticket\n\nManage Planner tickets. No, wrong usage…",
      ),
      agent("Created the ticket."),
    ]);
    expect(signals).toMatchObject({ userTurns: 1, corrections: 0 });
  });

  test("a scheduling instruction that starts with 'stop' is not a correction", () => {
    expect(
      judge("completed", [user("update tickets"), agent("On it"), user("stop at midnight")]).signals.corrections,
    ).toBe(0);
    expect(judge("completed", [user("update tickets"), agent("On it"), user("stop!")]).signals.corrections).toBe(1);
  });
});
