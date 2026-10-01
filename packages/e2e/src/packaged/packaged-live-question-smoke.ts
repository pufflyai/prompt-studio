import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const registerLiveQuestionSmokeTests = () => {
  test("packaged host delivers a correlated question reply to the live installed harness", async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-live-question-"));
    const evidence = join(root, "reply.json");
    let child: ChildProcess | undefined;
    try {
      const sourcePath = join(root, "question-extension");
      mkdirSync(sourcePath);
      writeFileSync(
        join(sourcePath, "package.json"),
        JSON.stringify({
          name: "question-smoke",
          publisher: "test",
          version: "1.0.0",
          type: "module",
          main: "./extension.ts",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      writeFileSync(
        join(sourcePath, "extension.ts"),
        `
        import { writeFileSync } from "node:fs";
        export default { harnesses: [{
          id: "worker", ref: { kind: "harness", id: "worker" }, label: "Worker", capabilities: () => [],
          start(_ctx, input) {
            let finish;
            const done = new Promise(resolve => { finish = resolve; });
            const part = { type: "tool", tool: "question", callId: "request-1", status: "pending", state: { input: { questions: [{ id: "greeting", question: "Which greeting?", options: [{ label: "Hi" }] }] } } };
            input.events.push({ op: "add", path: "/messages/0", value: { id: "question", role: "assistant", parts: [part] } });
            return { agentSessionId: "native-thread", done, stop() { throw new Error("Reply stopped the run"); },
              async replyQuestion(response) {
                if (response.callId !== "request-1") throw new Error("Stale request");
                writeFileSync(${JSON.stringify(evidence)}, JSON.stringify(response));
                input.events.push({ op: "replace", path: "/messages/0", value: { id: "question", role: "assistant", parts: [{ ...part, status: "completed", state: { ...part.state, output: response.answers[0].join(", ") } }] } });
                finish({ status: "completed" });
              }
            };
          },
          resume() { throw new Error("Reply replaced the run"); }, getMessages() { return []; },
          recoverMessages(_ctx, input) { return { kind: "recovered", messages: input.knownMessages }; }
        }] };
      `,
      );
      const started = await startPackagedServe(root);
      child = started.child;
      const request = async (path: string, method = "GET", body?: unknown) => {
        const response = await fetch(`${started.baseUrl}/v1${path}`, {
          method,
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const content = await response.text();
        if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${content}`);
        return JSON.parse(content);
      };
      const folder = join(root, "project");
      mkdirSync(folder);
      const project = await request("/projects", "POST", folderProjectInput({ name: "Question" }, folder));
      await request(`/projects/${project.id}/extensions/installed/question-smoke/enable`, "POST", {
        displayName: "Question",
        extensionId: "test.question-smoke",
        name: "question-smoke",
        manifest: { name: "question-smoke" },
        sourceKind: "local_path",
        sourcePath,
        sourceHash: null,
        sourceRef: null,
        version: null,
      });
      const session = await request("/sessions", "POST", {
        project_id: project.id,
        title: "Ask",
        prompt: "Ask",
        agent: "test.question-smoke.harness.worker",
      });
      for (let attempt = 0; attempt < 50; attempt++) {
        const conversation = await request(`/sessions/${session.id}/conversation`);
        if (conversation.messages.some((message: { id: string }) => message.id === "question")) break;
        await Bun.sleep(20);
      }
      const response = await request(`/sessions/${session.id}/follow-up`, "POST", {
        prompt: "Hi",
        question_response: { callId: "request-1", answers: [["Hi"]] },
      });
      expect(response.follow_up.status).toBe("dispatched");
      expect(JSON.parse(readFileSync(evidence, "utf8"))).toEqual({ callId: "request-1", answers: [["Hi"]] });
      for (
        let attempt = 0;
        attempt < 50 && (await request(`/sessions/${session.id}`)).status !== "completed";
        attempt++
      )
        await Bun.sleep(20);
      expect((await request(`/sessions/${session.id}`)).agent_session_id).toBe("native-thread");
      expect((await request(`/sessions/${session.id}/conversation`)).messages[0].parts[0]).toMatchObject({
        status: "completed",
        state: { output: "Hi" },
      });
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
};
