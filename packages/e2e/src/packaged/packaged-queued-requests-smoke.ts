import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { expectPackagedQueuedEditorCancellation } from "./packaged-queued-editor-smoke";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const registerQueuedRequestSmokeTests = () => {
  test("packaged queued requests retain settings, combine, and steer once into active work", async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-queued-requests-"));
    let child: ChildProcess | undefined;
    try {
      const sourcePath = join(root, "queue-extension");
      mkdirSync(sourcePath);
      writeFileSync(
        join(sourcePath, "package.json"),
        JSON.stringify({
          name: "queue-smoke",
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
        const harness={id:"worker",ref:{kind:"harness",id:"worker"},label:"Queue",capabilities:()=>[],
          params:{thinking:{type:"select",defaultValue:"high",options:[{label:"High",value:"high"},{label:"Low",value:"low"}]}},listModels:()=>[{id:"one"},{id:"two"}],
          start(_ctx,input){let finish;let index=0;const done=new Promise(resolve=>{finish=resolve;});
            const add=message=>input.events.push({op:"add",path:"/messages/"+index++,value:message});
            add({id:"initial",role:"user",parts:[{type:"text",text:input.prompt}]});
            return {agentSessionId:"native",done,stop(){finish({status:"completed"});},async steer(delivery){
              add({id:delivery.deliveryId,role:"user",parts:[{type:"text",text:delivery.prompt}]});return {status:"accepted"};
            }};
          },resume(){throw new Error("Steering must keep the current run");}
        };
        const queuedHarness={...harness,id:"queued-worker",ref:{kind:"harness",id:"queued-worker"},
          start(...args){const {steer,...handle}=harness.start(...args);return handle;}
        };
        export default {harnesses:[harness,queuedHarness]};
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
        const text = await response.text();
        if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text}`);
        return JSON.parse(text);
      };
      const folder = join(root, "project");
      mkdirSync(folder);
      const project = await request("/projects", "POST", folderProjectInput({ name: "Queued requests" }, folder));
      await request(`/projects/${project.id}/extensions/installed/queue-smoke/enable`, "POST", {
        displayName: "Queue",
        extensionId: "test.queue-smoke",
        name: "queue-smoke",
        manifest: { name: "queue-smoke" },
        sourceKind: "local_path",
        sourcePath,
        sourceHash: null,
        sourceRef: null,
        version: null,
      });
      const session = await request("/sessions", "POST", {
        project_id: project.id,
        title: "Queue",
        agent: "test.queue-smoke.harness.worker",
        prompt: "Original work",
        model: "one",
        params: { thinking: "high" },
      });
      for (let attempt = 0; attempt < 50; attempt++) {
        if ((await request(`/sessions/${session.id}/conversation`)).messages.length) break;
        await Bun.sleep(20);
      }
      const path = `/sessions/${session.id}/queued-follow-ups`;
      for (const prompt of ["First", "Second", "Other"])
        expect(
          (
            await request(`/sessions/${session.id}/follow-up`, "POST", {
              prompt,
              model: "one",
              params: { thinking: "high" },
            })
          ).follow_up.status,
        ).toBe("queued");
      await expectPackagedQueuedEditorCancellation(
        started.baseUrl,
        runtimeAuthorization(started.descriptor),
        project.id,
        session.id,
      );
      const queue = await request(path);
      const [first, second, other] = queue.requests;
      expect(first.params).toEqual({ thinking: "high" });
      expect(queue.steeringAvailable).toBe(true);
      const edited = (
        await request(`${path}/${first.queuePosition}`, "PATCH", {
          prompt: "Correction",
          expectedRevision: first.revision,
          model: "one",
          params: { thinking: "high" },
          attachments: [],
        })
      ).request;
      const combined = (
        await request(`${path}/${second.queuePosition}/combine`, "POST", {
          sourcePosition: first.queuePosition,
          sourceRevision: edited.revision,
          targetRevision: second.revision,
        })
      ).request;
      expect(combined.prompt).toBe("Correction\n\nSecond");
      const outcome = await request(`${path}/${second.queuePosition}/steer`, "POST", {
        expectedRevision: combined.revision,
        expectedRunStartedAt: queue.activeRunStartedAt,
      });
      expect(outcome.status).toBe("accepted");
      expect((await request(path)).requests).toEqual([other]);
      const conversation = await request(`/sessions/${session.id}/conversation`);
      expect(conversation.messages.filter((message: { id: string }) => message.id === outcome.deliveryId)).toHaveLength(
        1,
      );
      expect((await request(`/sessions/${session.id}`)).last_request_started).toBe(queue.activeRunStartedAt);
      expect(
        (
          await request(`${path}/${second.queuePosition}/steer`, "POST", {
            expectedRevision: combined.revision,
            expectedRunStartedAt: queue.activeRunStartedAt,
          })
        ).status,
      ).toBe("rejected");
      const queuedSession = await request("/sessions", "POST", {
        project_id: project.id,
        title: "Queue without live input",
        agent: "test.queue-smoke.harness.queued-worker",
        prompt: "Original work",
        model: "one",
        params: { thinking: "high" },
      });
      for (let attempt = 0; attempt < 50; attempt++) {
        if ((await request(`/sessions/${queuedSession.id}/conversation`)).messages.length) break;
        await Bun.sleep(20);
      }
      await request(`/sessions/${queuedSession.id}/follow-up`, "POST", { prompt: "First" });
      const unavailable = await request(`/sessions/${queuedSession.id}/queued-follow-ups`);
      expect(unavailable.activeRunStartedAt).toBeString();
      expect(unavailable.steeringAvailable).toBe(false);
      await expectPackagedQueuedEditorCancellation(
        started.baseUrl,
        runtimeAuthorization(started.descriptor),
        project.id,
        queuedSession.id,
        false,
      );
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  });
};
