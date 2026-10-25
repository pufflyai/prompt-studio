import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HarnessQuestionChannel } from "@pstdio/sdk/extensions";
import { MINIMUM_VERSION } from "./detection";
import { controlledChild, recordingSink, waitForStreamIo } from "./mocks/controlled-child";
import { startClaudeCodeSession } from "./spawn";

// Real stream output from the oldest supported and the latest Claude Code, made by scripts/record-cli-output.ts.
const recordedDir = join(import.meta.dir, "mocks/recorded");
const versions = [...new Set(readdirSync(recordedDir).map((name) => name.slice(0, name.indexOf("-"))))];
const recorded = (version: string, scenario: string) =>
  readFileSync(join(recordedDir, `${version}-${scenario}.jsonl`), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);

const replay = async (emit: (event: object) => void, events: Record<string, unknown>[], afterResult: () => void) => {
  for (const event of events) {
    emit(event);
    await waitForStreamIo();
    if (event.type === "result") afterResult();
  }
};

test("has recorded output from the minimum supported Claude Code version", () => {
  expect(versions).toContain(MINIMUM_VERSION);
});

describe.each(versions)("Claude Code %s", (version) => {
  test("keeps the run open until its background task finishes", async () => {
    const { child, stdinEnded, emit } = controlledChild();
    const { patches, sink } = recordingSink();
    const session = startClaudeCodeSession(
      { prompt: "Start a background task", events: sink },
      { spawnProcess: () => child },
    );
    const events = recorded(version, "background-task");
    const results = events.filter((event) => event.type === "result").length;
    const ended: boolean[] = [];
    await replay(emit, events, () => ended.push(stdinEnded()));

    // The first turn ends while the task runs. Only the turn after the task finishes ends the run.
    expect(results).toBeGreaterThan(1);
    expect(ended).toEqual([...Array(results - 1).fill(false), true]);
    child.exit();
    expect(await (await session).done).toEqual({ status: "completed" });
    expect(patches.some((patch) => JSON.stringify(patch.value).includes("background command finished"))).toBe(true);
  });

  test("asks the person Claude's question and returns the answer", async () => {
    const { child, stdinEnded, emit, written } = controlledChild();
    const { patches, sink } = recordingSink();
    const asked: string[] = [];
    const questions: HarnessQuestionChannel = {
      ask: async (request) => {
        asked.push(...request.questions.map((question) => question.question));
        return { answers: [["Red"]] };
      },
    };
    const session = startClaudeCodeSession(
      { prompt: "Ask me", events: sink, questions },
      { spawnProcess: () => child },
    );
    await replay(emit, recorded(version, "question"), () => {});

    expect(asked).toHaveLength(1);
    const reply = written().find((message) => message.type === "control_response");
    expect(reply?.response.response).toMatchObject({
      behavior: "allow",
      updatedInput: { answers: { [asked[0]]: "Red" } },
    });
    expect(stdinEnded()).toBe(true);
    child.exit();
    expect(await (await session).done).toEqual({ status: "completed" });
    expect(patches.some((patch) => JSON.stringify(patch.value).includes("Red"))).toBe(true);
  });
});
