import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessContext, JsonPatch, SessionMessage } from "@pstdio/sdk/extensions";
import { resolvePiCommand } from "./cli";
import { createPiHarness } from "./harness";
import { startPiProcess } from "./process";

export const piFixture = async (installed = false) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-pi-"));
  const requests: Array<{ messages: Array<{ role: string; content: unknown }> }> = [];
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      const body = (await request.json()) as (typeof requests)[number];
      requests.push(body);
      const lastUser = body.messages.filter((message) => message.role === "user").at(-1);
      const text = JSON.stringify(lastUser?.content);
      if (text.includes("failure"))
        return Response.json(
          { error: { message: "Fixture provider failure", type: "invalid_request_error" } },
          { status: 400 },
        );
      if (text.includes("wait"))
        return new Response(new ReadableStream({ start() {} }), { headers: { "Content-Type": "text/event-stream" } });
      const tool = text.includes("tool") && body.messages.at(-1)?.role !== "tool";
      const delta = tool
        ? {
            tool_calls: [
              {
                index: 0,
                id: "fixture-call",
                type: "function",
                function: { name: "read", arguments: JSON.stringify({ path: "hello.txt" }) },
              },
            ],
          }
        : { content: "Hello from Pi" };
      const event = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
      const output =
        event({
          id: "fixture",
          object: "chat.completion.chunk",
          choices: [{ index: 0, delta: { role: "assistant", ...delta }, finish_reason: null }],
        }) +
        event({
          id: "fixture",
          object: "chat.completion.chunk",
          choices: [{ index: 0, delta: {}, finish_reason: tool ? "tool_calls" : "stop" }],
          usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
        }) +
        "data: [DONE]\n\n";
      return new Response(output, { headers: { "Content-Type": "text/event-stream" } });
    },
  });
  const env = { PI_CODING_AGENT_DIR: join(root, "agent"), PI_SKIP_VERSION_CHECK: "1" };
  await Bun.write(
    join(root, "agent/models.json"),
    JSON.stringify({
      providers: {
        fixture: {
          baseUrl: `http://127.0.0.1:${server.port}/v1`,
          api: "openai-completions",
          apiKey: "fixture-only",
          models: [
            {
              id: "test",
              name: "Local fixture",
              reasoning: false,
              input: ["text", "image"],
              contextWindow: 32768,
              maxTokens: 1024,
            },
          ],
        },
      },
    }),
  );
  await Bun.write(join(root, "agent/settings.json"), JSON.stringify({ retry: { enabled: false } }));
  await Bun.write(join(root, "hello.txt"), "Hello file");
  const command = installed ? ["pi"] : resolvePiCommand({ which: () => null }).command;
  if (!installed) Object.assign(env, resolvePiCommand({ which: () => null }).env);
  const run: HarnessContext["process"]["run"] = async (input) => {
    const process = startPiProcess([], { command: input.command, env: { ...env, ...input.env }, cwd: input.cwd });
    process.child.stdin.end();
    const [chunks, exit] = await Promise.all([Array.fromAsync(process.child.stdout), process.exited]);
    return { stdout: Buffer.concat(chunks).toString(), stderr: process.diagnostics(), exitCode: exit.code ?? 1 };
  };
  const context = {
    extensionId: "pstdio.harness-pi",
    name: "harness-pi",
    projectId: "fixture-project",
    process: { run, runOrThrow: run, spawnDetached: async () => ({}) },
    logger: { info() {}, warn() {}, error() {} },
  } as unknown as HarnessContext;
  const harness = createPiHarness({ command, env });
  const sink = (initial: SessionMessage[] = []) => {
    let messages = initial;
    const patches: JsonPatch[] = [];
    return {
      patches,
      getMessages: () => messages,
      push(patch: JsonPatch) {
        patches.push(patch);
        messages = structuredClone(patch.value) as SessionMessage[];
      },
    };
  };
  return {
    root,
    context,
    harness,
    sink,
    requests,
    async close() {
      await harness.dispose!(context);
      server.stop(true);
      rmSync(root, { recursive: true, force: true });
    },
  };
};
