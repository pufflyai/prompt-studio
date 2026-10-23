import { expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect as expectEventually } from "@playwright/test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const registerCliSteeringSmokeTests = () => {
  test("packaged follow-up steers new input without queuing on rejection or uncertainty", async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-cli-steering-"));
    let child: ChildProcess | undefined;
    try {
      const sourcePath = join(root, "extension");
      mkdirSync(sourcePath);
      writeFileSync(
        join(sourcePath, "package.json"),
        JSON.stringify({
          name: "cli-steering",
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
        const start = (_ctx, input) => {
          let count = 0;
          const push = (id, text, files = []) => input.events.push({ op: "add", path: "/messages/" + count++, value: {
            id, role: "user", parts: [{ type: "text", text }, ...files.map(file => ({ type: "file", fileId: file.fileId, filename: file.fileName, mediaType: file.mimeType, size: file.sizeBytes, url: file.url }))]
          } });
          push("initial", input.prompt);
          let finish;
          return {
            agentSessionId: crypto.randomUUID(), done: new Promise(resolve => { finish = resolve; }),
            stop() { finish({ status: "cancelled" }); },
            steer: input.prompt === "unsupported" ? undefined : async live => {
              if (live.prompt === "reject") return { status: "rejected", reason: "Native refusal" };
              if (live.prompt === "uncertain") return { status: "uncertain", reason: "Acknowledgement missing" };
              push(live.deliveryId, live.prompt, live.attachments);
              return { status: "accepted" };
            },
          };
        };
        export default { harnesses: [{ id: "worker", ref: { kind: "harness", id: "worker" }, label: "Live worker", capabilities: () => [],
          start, resume() { throw new Error("Steering must not resume another turn"); }, listModels: () => []
        }] };
      `,
      );
      const runtime = await startPackagedServe(root);
      child = runtime.child;
      const request = async (path: string, body?: unknown) => {
        const response = await fetch(`${runtime.baseUrl}/v1${path}`, {
          method: body === undefined ? "GET" : "POST",
          headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        expect(response.ok, await response.clone().text()).toBe(true);
        return response.json();
      };
      const folder = join(root, "project");
      mkdirSync(folder);
      const project = await request("/projects", folderProjectInput({ name: "CLI steering" }, folder));
      await request(`/projects/${project.id}/extensions/installed/cli-steering/enable`, {
        displayName: "CLI steering",
        extensionId: "test.cli-steering",
        name: "cli-steering",
        manifest: { name: "cli-steering" },
        sourceKind: "local_path",
        sourcePath,
        sourceHash: null,
        sourceRef: null,
        version: null,
      });
      const session = await request("/sessions", {
        project_id: project.id,
        title: "Live input",
        prompt: "Start",
        agent: "test.cli-steering.harness.worker",
      });
      const queue = (id = session.id) => request(`/sessions/${id}/queued-follow-ups`);
      await expectEventually.poll(async () => (await queue()).steeringAvailable).toBe(true);
      const initial = await request(`/sessions/${session.id}`);
      const cli = (id: string, prompt: string, extra: string[] = []) =>
        spawnSync(PACKAGED_BINARY_PATH, ["sessions", "follow-up", "--id", id, "--prompt", prompt, ...extra], {
          cwd: folder,
          encoding: "utf8",
          env: {
            ...process.env,
            PSTDIO_HOME: root,
            PSTDIO_API_URL: runtime.baseUrl,
            PSTDIO_API_TOKEN: runtime.descriptor.token,
          },
        });

      const normal = cli(session.id, "Later");
      expect(normal.status, normal.stderr).toBe(0);
      expect((await queue()).requests).toMatchObject([{ prompt: "Later" }]);

      const notes = join(root, "notes.txt");
      writeFileSync(notes, "Check the parser");
      const accepted = cli(session.id, "Correction", ["--steer", "--attach", notes]);
      expect(accepted.status, accepted.stderr).toBe(0);
      const delivery = JSON.parse(accepted.stdout);
      expect(delivery.status).toBe("accepted");
      expect(typeof delivery.deliveryId).toBe("string");
      const conversation = await request(`/sessions/${session.id}/conversation`);
      expect(
        conversation.messages.filter((message: { id: string }) => message.id === delivery.deliveryId),
      ).toMatchObject([
        {
          role: "user",
          parts: [
            { type: "text", text: "Correction" },
            { type: "file", filename: "notes.txt" },
          ],
        },
      ]);
      expect((await queue()).requests).toMatchObject([{ prompt: "Later", steeringDelivery: null }]);
      expect((await request(`/sessions/${session.id}`)).last_request_started).toBe(initial.last_request_started);

      const rejected = cli(session.id, "reject", ["--steer"]);
      expect(rejected.status).toBe(1);
      expect(JSON.parse(rejected.stdout)).toMatchObject({ status: "rejected", reason: "delivery_failed" });
      expect((await queue()).requests).toMatchObject([{ prompt: "Later", steeringDelivery: null }]);

      const uncertain = cli(session.id, "uncertain", ["--steer"]);
      expect(uncertain.status).toBe(1);
      const held = JSON.parse(uncertain.stdout);
      expect(held.status).toBe("uncertain");
      expect(typeof held.deliveryId).toBe("string");
      expect((await queue()).requests).toMatchObject([
        { prompt: "Later", steeringDelivery: null },
        { prompt: "uncertain", steeringDelivery: { id: held.deliveryId } },
      ]);

      for (const prompt of [undefined, "unsupported"]) {
        const unavailable = await request("/sessions", {
          project_id: project.id,
          title: "Unavailable",
          prompt,
          agent: "test.cli-steering.harness.worker",
        });
        if (prompt)
          await expectEventually
            .poll(async () => (await request(`/sessions/${unavailable.id}`)).agent_session_id)
            .toBeTruthy();
        const result = cli(unavailable.id, "Correction", ["--steer"]);
        expect(result.status, result.stderr).toBe(1);
        expect(result.stderr.length).toBeGreaterThan(0);
        expect((await queue(unavailable.id)).requests).toEqual([]);
      }
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  });
};
