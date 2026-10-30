import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessContext, HarnessSession, SessionMessage } from "@pstdio/sdk/extensions";
import { detectClaude } from "./detection";
import { createClaudeCodeHarness } from "./harness";
import { recoverClaudeMessages } from "./history-reconciliation";
import { recordingSink } from "./mocks/controlled-child";
import { createSteeringApi } from "./mocks/steering-api";
import { discoverClaudeModels } from "./models";
import { resumeClaudeCodeSession, startClaudeCodeSession } from "./spawn";

// Runs the harness against the Claude Code CLI on PATH. CI installs the minimum supported version and,
// before a release, the latest one. Nothing here needs a Claude login.
const enabled = process.env.INSTALLED_CLI_TESTS === "1";

const run: HarnessContext["process"]["run"] = async (input) => {
  const [command, ...args] = input.command;
  const result = spawnSync(command, args, { encoding: "utf8", env: { ...process.env, ...input.env } });
  return { exitCode: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
};
const context = {
  process: { run, runOrThrow: run, spawnDetached: async () => ({ pid: 0 }) },
  logger: { warn: () => {}, info: () => {}, error: () => {} },
} as unknown as HarnessContext;

describe.if(enabled)("installed Claude Code CLI", () => {
  test("steers foreground work on start and resume and recovers identical input with attachments", async () => {
    const api = createSteeringApi();
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), "claude-steering-cli-")));
    const harness = createClaudeCodeHarness();
    let previous: HarnessSession | undefined;
    let history: SessionMessage[] = [];
    try {
      for (const mode of ["start", "resume"] as const) {
        api.reset();
        const recording = recordingSink(history);
        let toolStarted!: () => void;
        const tool = new Promise<void>((resolve) => {
          toolStarted = resolve;
        });
        const events = {
          ...recording.sink,
          push: (patch: Parameters<typeof recording.sink.push>[0]) => {
            recording.sink.push(patch);
            if (
              recording.messages.some((message) =>
                message.parts.some((part) => part.type === "tool" && part.status === "pending"),
              )
            )
              toolStarted();
          },
        };
        const input = {
          prompt: "Run the foreground command.",
          cwd,
          env: api.env,
          model: "haiku",
          params: { thinking: "low" },
          events,
        };
        const session =
          mode === "start"
            ? await startClaudeCodeSession(input)
            : resumeClaudeCodeSession({
                ...input,
                agentSessionId: previous!.agentSessionId!,
                messageOffset: history.length,
              });
        previous = session;
        await tool;
        const deliveries = [crypto.randomUUID(), crypto.randomUUID()].map((deliveryId) => ({
          deliveryId,
          prompt: "Use this correction.",
          attachments: [
            {
              fileId: "file",
              fileName: "note.txt",
              localPath: join(cwd, "note.txt"),
              mimeType: "text/plain",
              sizeBytes: 4,
              url: "/files/file",
            },
          ],
        }));
        const accepted = await Promise.all(deliveries.map((delivery) => session.steer!(delivery)));
        expect(accepted).toEqual([{ status: "accepted" }, { status: "accepted" }]);
        const checkpoint = structuredClone(recording.messages);
        expect(await session.done).toEqual({ status: "completed" });
        const nativeMessages = await harness.getMessages!(context, { agentSessionId: session.agentSessionId!, cwd });
        for (const knownMessages of [checkpoint, recording.messages]) {
          const recovered = recoverClaudeMessages({ knownMessages, nativeMessages });
          expect(recovered.kind).toBe("recovered");
          if (recovered.kind === "recovered") {
            const nativeUsers = nativeMessages.filter((message) => message.role === "user");
            expect(
              recovered.messages.filter((message) => message.role === "user").map((message) => message.id),
            ).toEqual(nativeUsers.map((message) => message.id));
            for (const delivery of deliveries)
              expect(recovered.messages.find((message) => message.id === delivery.deliveryId)?.parts).toEqual(
                recording.messages.find((message) => message.id === delivery.deliveryId)?.parts,
              );
          }
        }
        history = structuredClone(recording.messages);
        expect(api.requests.at(-1)).toContain("Use this correction.");
        expect(await session.steer!(deliveries[0])).toMatchObject({ status: "rejected" });
      }
    } finally {
      await previous?.stop();
      api.close();
    }
  }, 120_000);

  test("is detected as supported", async () => {
    expect(await detectClaude(context)).toMatchObject({ available: true });
  });

  test("lists its models with effort levels", async () => {
    const models = await discoverClaudeModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models.some((model) => model.paramOverrides?.thinking)).toBe(true);
  });

  // An unknown flag stops the CLI before it reports a session, so a session ID proves it accepts every argument.
  test("accepts the harness arguments and reports its session", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "claude-cli-"));
    const session = await startClaudeCodeSession({
      prompt: "Reply with the word ready.",
      cwd,
      params: { thinking: "low", permission_mode: "plan" },
      events: recordingSink().sink,
    });
    expect(session.agentSessionId).toMatch(/\S/);
    await session.done;
  }, 120_000);
});
