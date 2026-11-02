import { expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();

test(
  "packaged CLI forks saved conversations and keeps later replies independent",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-session-fork-"));
    let child: ChildProcess | undefined;
    try {
      const source = join(root, "fork-harness");
      const invocations = join(root, "invocations.jsonl");
      mkdirSync(source);
      writeFileSync(
        join(source, "package.json"),
        JSON.stringify({
          name: "fork-harness",
          publisher: "test",
          version: "1.0.0",
          type: "module",
          main: "./extension.ts",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      writeFileSync(
        join(source, "extension.ts"),
        `
      import { appendFileSync } from "node:fs";
      const histories = new Map();
      const run = (input, id = crypto.randomUUID()) => {
        appendFileSync(${JSON.stringify(invocations)}, JSON.stringify({ id, prompt: input.prompt }) + "\\n");
        const messages = structuredClone(histories.get(id) ?? []);
        const user = { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: input.prompt }] };
        const answer = { id: crypto.randomUUID(), role: "assistant", parts: [{ type: "text", text: "Reply: " + input.prompt }] };
        histories.set(id, [...messages, user, answer]);
        const offset = input.messageOffset ?? 0;
        input.events.push({ op: "add", path: "/messages/" + offset, value: user });
        input.events.push({ op: "add", path: "/messages/" + (offset + 1), value: answer });
        return { agentSessionId: id, done: Promise.resolve({ status: "completed" }), stop() {} };
      };
      export default { harnesses: [{
        id: "worker", ref: { kind: "harness", id: "worker" }, label: "Fork harness", capabilities: () => ["SessionFork"],
        detect: () => ({ available: true }), listModels: () => [],
        start: (_ctx, input) => run(input), resume: (_ctx, input) => run(input, input.agentSessionId),
        fork(_ctx, input) {
          const id = crypto.randomUUID();
          histories.set(id, structuredClone(histories.get(input.agentSessionId)));
          return { agentSessionId: id };
        },
        getMessages: (_ctx, input) => histories.get(input.agentSessionId) ?? [],
        recoverMessages: (_ctx, input) => ({ kind: "recovered", messages: input.knownMessages }),
      }] };
    `,
      );
      const started = await startPackagedServe(root, {
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "fork-harness" }]),
      });
      child = started.child;
      const request = async (path: string, method = "GET", body?: unknown) => {
        const response = await fetch(`${started.baseUrl}/v1${path}`, {
          method,
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
        return response.json();
      };
      const settle = async (id: string) => {
        for (let attempt = 0; attempt < 100; attempt++) {
          const session = await request(`/sessions/${id}`);
          if (session.status === "completed") return session;
          await Bun.sleep(20);
        }
        throw new Error("The conversation did not finish.");
      };
      const folder = join(root, "project");
      mkdirSync(folder);
      const project = await request("/projects", "POST", folderProjectInput({ name: "Fork" }, folder));
      const original = await request("/sessions", "POST", {
        project_id: project.id,
        title: "Explore",
        prompt: "Remember blue",
        agent: "test.fork-harness.harness.worker",
      });
      const saved = await settle(original.id);
      const history = await request(`/sessions/${original.id}/conversation`);
      const native = async (id: string) => (await request(`/sessions/${id}/conversation/sources`)).native;
      expect(await native(original.id)).toEqual(history.messages);
      const beforeFork = readFileSync(invocations, "utf8");
      const result = spawnSync(PACKAGED_BINARY_PATH, ["sessions", "fork", "--id", original.id], {
        encoding: "utf8",
        cwd: folder,
        env: {
          ...process.env,
          PSTDIO_HOME: root,
          PSTDIO_API_URL: started.baseUrl,
          PSTDIO_API_TOKEN: started.descriptor.token,
        },
      });
      expect(result.status, result.stderr).toBe(0);
      const fork = JSON.parse(result.stdout);
      expect(fork.id).not.toBe(original.id);
      expect(fork.agent_session_id).not.toBe(saved.agent_session_id);
      expect(fork).toMatchObject({
        original_session_id: original.id,
        workspace_id: saved.workspace_id,
        status: "completed",
      });
      expect((await request(`/sessions/${fork.id}/conversation`)).messages).toEqual(history.messages);
      expect(await native(fork.id)).toEqual(history.messages);
      expect(readFileSync(invocations, "utf8")).toBe(beforeFork);
      await request(`/sessions/${fork.id}/follow-up`, "POST", { prompt: "Try green" });
      await settle(fork.id);
      expect((await request(`/sessions/${original.id}/conversation`)).messages).toEqual(history.messages);
      expect(await native(original.id)).toEqual(history.messages);
      const copiedHistory = await native(fork.id);
      expect(copiedHistory).toHaveLength(history.messages.length + 2);
      expect(copiedHistory).toContainEqual(
        expect.objectContaining({ role: "assistant", parts: [{ type: "text", text: "Reply: Try green" }] }),
      );
      expect(readFileSync(invocations, "utf8").trim().split("\n")).toHaveLength(2);
      expect((await request(`/sessions/${fork.id}/conversation`)).messages).toContainEqual(
        expect.objectContaining({ role: "assistant", parts: [{ type: "text", text: "Reply: Try green" }] }),
      );
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
