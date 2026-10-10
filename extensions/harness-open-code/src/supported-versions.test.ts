import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SessionMessage } from "@pstdio/sdk/extensions";
import { MINIMUM_VERSION } from "./detection";
import { pollOpencodeMessages } from "./opencode-session-poller";
import { recordingSink } from "./opencode-session-poller.test-helpers";
import type { OpencodeSessionMessage } from "./opencode-types";

// Real session messages from the oldest supported and the latest OpenCode, made by scripts/record-cli-output.ts.
const recordedDir = join(import.meta.dir, "mocks/recorded");
const versions = [...new Set(readdirSync(recordedDir).map((name) => name.slice(0, name.indexOf("-"))))];
const recorded = (version: string) =>
  JSON.parse(readFileSync(join(recordedDir, `${version}-shell-turn.json`), "utf8")) as OpencodeSessionMessage[];

test("has recorded messages from the minimum supported OpenCode version", () => {
  expect(versions).toContain(MINIMUM_VERSION);
});

describe.each(versions)("OpenCode %s", (version) => {
  test("shows a turn that runs a shell command and replies", async () => {
    const { sink } = recordingSink();
    const result = await pollOpencodeMessages({
      loadMessages: async () => recorded(version),
      sessionId: "recorded",
      cwd: "/workspace",
      events: sink,
      baselineCount: 0,
      messageComplete: Promise.resolve(),
    });

    expect(result).toEqual({ status: "completed" });
    const parts = sink.getMessages().flatMap((message: SessionMessage) => message.parts);
    expect(parts).toContainEqual(
      expect.objectContaining({ type: "tool", tool: "bash", state: expect.objectContaining({ status: "completed" }) }),
    );
    expect(parts).toContainEqual(expect.objectContaining({ type: "text", text: expect.stringMatching(/\bdone\b/i) }));
  });
});
