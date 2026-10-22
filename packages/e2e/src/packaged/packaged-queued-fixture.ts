import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const logQueuedPhase = (scenario: string, phase: string) => {
  console.log(`[queued smoke ${new Date().toISOString()}] ${scenario}: ${phase}`);
};

export const createPackagedQueueFixture = async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-queued-requests-"));
  let host: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
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
            add({id:delivery.deliveryId,role:"user",parts:[{type:"text",text:delivery.prompt},
              ...delivery.attachments.map(file=>({type:"file",fileId:file.fileId,url:file.url,
                filename:file.fileName,mediaType:file.mimeType??undefined,size:file.sizeBytes}))]});return {status:"accepted"};
          }};
        },resume(){throw new Error("Steering must keep the current run");}
      };
      const queuedHarness={...harness,id:"queued-worker",ref:{kind:"harness",id:"queued-worker"},
        start(...args){const {steer,...handle}=harness.start(...args);return handle;}
      };
      export default {harnesses:[harness,queuedHarness],commands:[{
        id:"stop",ref:{kind:"command",id:"stop"},title:"Stop session",params:{sessionId:{type:"string",required:true}},
        async run(ctx,input){await ctx.sessions.stop(input.sessionId);return {
          session:await ctx.sessions.get(input.sessionId),queue:await ctx.sessions.getQueuedFollowUps(input.sessionId)
        };}
      }]};
    `,
    );

    logQueuedPhase("setup", "start packaged host");
    const started = await startPackagedServe(root);
    host = started;
    logQueuedPhase("setup", "host ready; create project and enable harness");
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

    const createSession = async (harness = "worker") => {
      const session = await request("/sessions", "POST", {
        project_id: project.id,
        title: `Queue ${harness}`,
        agent: `test.queue-smoke.harness.${harness}`,
        prompt: "Original work",
        model: "one",
        params: { thinking: "high" },
      });
      while (!(await request(`/sessions/${session.id}/conversation`)).messages.length) await Bun.sleep(20);
      return session;
    };
    logQueuedPhase("setup", "project and harness ready");
    return {
      ...started,
      projectId: project.id as string,
      request,
      createSession,
      async close() {
        await stopProcess(started.child);
        rmSync(root, { recursive: true, force: true });
      },
    };
  } catch (error) {
    if (host) await stopProcess(host.child);
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
};
