import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const registerLiveQuestionSmokeTests = () => {
  for (const scenario of [
    { name: "answer", native: [["Hi"]], host: [["Blue"]] },
    { name: "skip", native: [], host: [] },
    { name: "command answer", native: [["Hi"]], host: [["Blue"]] },
    { name: "command skip", native: [], host: [] },
  ]) {
    test(`packaged host delivers a correlated ${scenario.name} to the live installed harness`, async () => {
      const root = mkdtempSync(join(tmpdir(), "packaged-live-question-"));
      const evidence = join(root, "reply.json");
      const hostEvidence = join(root, "host-reply.json");
      let child: ChildProcess | undefined;
      try {
        const sourcePath = join(root, "question-extension");
        const imageSrc =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i8AAAAASUVORK5CYII=";
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
        const harness = {
          id: "worker", ref: { kind: "harness", id: "worker" }, label: "Worker", capabilities: () => ["Attachments"],
          start(_ctx, input) {
            let finish;
            const done = new Promise(resolve => { finish = resolve; });
            const part = { type: "tool", tool: "question", callId: "request-1", status: "pending", state: { input: { delivery: "async", questions: [{ id: "greeting", question: "Which greeting?", options: [{ label: "Hi" }] }] } } };
            const image = { type: "tool", tool: "view_image", callId: "image-1", status: "completed", state: { input: { path: "/tmp/preview.png" }, output: [{ type: "image", source: "/tmp/preview.png", src: ${JSON.stringify(imageSrc)}, mimeType: "image/png" }] } };
            input.events.push({ op: "add", path: "/messages/0", value: { id: "question", role: "assistant", parts: [part, image] } });
            const hostPart = { ...part, callId: "request-2" };
            input.events.push({ op: "add", path: "/messages/1", value: { id: "host-question", role: "assistant", parts: [hostPart] } });
            void input.questions.ask({ id: "host-question", toolUseId: "request-2", questions: [{ question: "Which color?", options: [{ label: "Blue" }] }] }).then(async response => {
              writeFileSync(${JSON.stringify(hostEvidence)}, JSON.stringify(response));
              await new Promise(resolve => setTimeout(resolve, 50));
              input.events.push({ op: "replace", path: "/messages/1", value: { id: "host-question", role: "assistant", parts: [{ ...hostPart, status: "completed", state: { output: response.answers.flat().join(", ") } }] } });
              finish({ status: "completed" });
            });
            return { agentSessionId: "native-thread", done, stop() { throw new Error("Reply stopped the run"); },
              async replyQuestion(response) {
                if (response.callId === "broken-provider") throw new Error("Provider failed");
                if (response.callId !== "request-1") throw Object.assign(new Error("Stale request"), { questionRejected: true });
                writeFileSync(${JSON.stringify(evidence)}, JSON.stringify(response));
                input.events.push({ op: "replace", path: "/messages/0", value: { id: "question", role: "assistant", parts: [{ ...part, status: "completed", state: { ...part.state, output: { answers: response.answers } } }, image] } });
              }
            };
          },
          prepareOperation(_ctx, input, operation) {
            return { execution: "exclusive", invoke: async channels => ({ kind: "started", session: harness.start(_ctx, { ...input, ...channels, prompt: operation.text }) }) };
          },
          resume() { throw new Error("Reply replaced the run"); }, getMessages() { return []; },
          recoverMessages(_ctx, input) { return { kind: "recovered", messages: input.knownMessages }; }
        }; export default { harnesses: [harness] };
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
          ...(scenario.name.startsWith("command")
            ? { operation: { kind: "command", text: "/plan Ask" } }
            : { prompt: "Ask" }),
          agent: "test.question-smoke.harness.worker",
        });
        for (let attempt = 0; attempt < 50; attempt++) {
          const conversation = await request(`/sessions/${session.id}/conversation`);
          if (
            conversation.messages.some((message: { id: string }) => message.id === "question") &&
            (await request(`/sessions/${session.id}`)).status === "awaiting_input"
          )
            break;
          await Bun.sleep(20);
        }
        const response = await request(`/sessions/${session.id}/follow-up`, "POST", {
          prompt: "Hi",
          model: "next-model",
          question_response: { callId: "request-1", answers: scenario.native },
        });
        expect(response.follow_up.status).toBe("dispatched");
        expect(JSON.parse(readFileSync(evidence, "utf8"))).toEqual({ callId: "request-1", answers: scenario.native });
        expect((await request(`/sessions/${session.id}`)).status).toBe("awaiting_input");
        expect((await request(`/sessions/${session.id}`)).last_selected_model).toBe("next-model");
        await expect(
          request(`/sessions/${session.id}/follow-up`, "POST", {
            prompt: "Hi",
            question_response: { callId: "broken-provider", answers: [["Hi"]] },
          }),
        ).rejects.toThrow("500");
        await expect(
          request(`/sessions/${session.id}/follow-up`, "POST", {
            prompt: "Blue",
            question_response: { callId: "expired-request", answers: [["Blue"]] },
          }),
        ).rejects.toThrow("400");
        const uploaded = await fetch(`${started.baseUrl}/v1/projects/${project.id}/session-attachments`, {
          method: "POST",
          headers: {
            ...runtimeAuthorization(started.descriptor),
            "content-type": "text/plain",
            "x-file-name": "notes.txt",
          },
          body: "notes",
        });
        expect(uploaded.status).toBe(201);
        const file = await uploaded.json();
        await expect(
          request(`/sessions/${session.id}/follow-up`, "POST", {
            prompt: "Blue",
            question_response: { callId: "request-2", answers: scenario.host },
            attachments: [{ file_id: file.file_id }],
          }),
        ).rejects.toThrow("400");
        const hostReply = await request(`/sessions/${session.id}/follow-up`, "POST", {
          prompt: "Blue",
          question_response: { callId: "request-2", answers: scenario.host },
        });
        expect(hostReply.follow_up.status).toBe("dispatched");
        expect((await request(`/sessions/${session.id}/conversation`)).messages[1].parts[0]).toMatchObject({
          status: "completed",
        });
        for (
          let attempt = 0;
          attempt < 50 && (await request(`/sessions/${session.id}`)).status !== "completed";
          attempt++
        )
          await Bun.sleep(20);
        expect(JSON.parse(readFileSync(hostEvidence, "utf8"))).toEqual({ callId: "request-2", answers: scenario.host });
        expect((await request(`/sessions/${session.id}`)).agent_session_id).toBe("native-thread");
        expect((await request(`/sessions/${session.id}/conversation`)).messages[0].parts[0]).toMatchObject({
          status: "completed",
          state: { input: { delivery: "async" }, output: { answers: scenario.native } },
        });
        expect((await request(`/sessions/${session.id}/conversation`)).messages[0].parts[1]).toMatchObject({
          tool: "view_image",
          state: { output: [{ type: "image", source: "/tmp/preview.png", src: imageSrc }] },
        });
      } finally {
        if (child) await stopProcess(child);
        rmSync(root, { recursive: true, force: true });
      }
    }, 30_000);
  }
};
