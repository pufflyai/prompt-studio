import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionMessage } from "pstdio-api-contracts";
import { toolResultBytes } from "pstdio-api-contracts";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();

test(
  "packaged sessions bound a 76 MB failed tool result and reopen its saved history",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-tool-result-"));
    let child: ChildProcess | undefined;
    try {
      const source = join(root, "large-result");
      mkdirSync(source);
      writeFileSync(
        join(source, "package.json"),
        JSON.stringify({
          name: "large-result",
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
      export default { harnesses: [{
        id: "worker", ref: { kind: "harness", id: "worker" }, label: "Large result", capabilities: () => [],
        async start(_ctx, input) {
          const output = "START" + "x".repeat(76_000_000) + "END";
          const index = input.events.getMessages().length;
          input.events.push({ op: "add", path: "/messages/" + index, value: { id: "tool", role: "assistant", parts: [
            { type: "tool", tool: "shell", callId: "call", status: "failed", state: { output, errorText: output, metadata: { copy: output } } }
          ] } });
          input.events.push({ op: "add", path: "/messages/" + (index + 1), value: { id: "later", role: "assistant", parts: [{ type: "text", text: "Later reply" }] } });
          return { agentSessionId: "native-large", done: Promise.resolve({ status: "completed" }), stop() {} };
        },
        resume() { throw new Error("This fixture does not resume"); },
        getMessages() { return []; },
        recoverMessages(_ctx, input) { return { kind: "recovered", messages: input.knownMessages }; }
      }] };
    `,
      );
      const env = { PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "large-result" }]) };
      let started = await startPackagedServe(root, env);
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
      const folder = join(root, "project");
      mkdirSync(folder);
      const project = await request("/projects", "POST", folderProjectInput({ name: "Bounded output" }, folder));
      const session = await request("/sessions", "POST", {
        project_id: project.id,
        title: "Large tool result",
        prompt: "Print output",
        agent: "test.large-result.harness.worker",
      });
      for (
        let attempt = 0;
        attempt < 100 && (await request(`/sessions/${session.id}`)).status !== "completed";
        attempt++
      )
        await Bun.sleep(20);
      expect((await request(`/sessions/${session.id}`)).status).toBe("completed");
      const read = async () => (await request(`/sessions/${session.id}/conversation`)).messages as SessionMessage[];
      const before = await read();
      const part = before.flatMap((message) => message.parts).find((part) => part.type === "tool");
      if (!part || part.type !== "tool") throw new Error("Missing tool output");
      expect(part.status).toBe("failed");
      expect(toolResultBytes(part)).toBeLessThanOrEqual(262144);
      expect(part.state?.output).toContain("START");
      expect(part.state?.output).toContain("END");
      expect(before.at(-1)?.id).toBe("later");
      await stopProcess(child);
      child = undefined;
      started = await startPackagedServe(root, env);
      child = started.child;
      expect(await read()).toEqual(before);
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
