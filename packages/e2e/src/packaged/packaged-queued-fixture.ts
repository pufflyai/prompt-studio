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
        getCommandState(){return {slashCommands:true,commands:[{name:"/plan",description:"Plan"}],modes:[]};},
        prepareOperation(){return {execution:"exclusive",invoke:async()=>({kind:"completed",message:"Native result"})};},
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
        id:"interact",ref:{kind:"command",id:"interact"},title:"Interact with session",params:{sessionId:{type:"string",required:true}},
        async run(ctx,input){
          const id=input.sessionId;
          const conversation=await ctx.sessions.getConversation(id);
          const sources=await ctx.sessions.getConversationSources(id);
          const queued=await ctx.sessions.getQueuedMessages(id);
          const events=[];const controller=new AbortController();
          await ctx.sessions.stream(id,event=>{events.push(event.event);if(event.event==="patch")controller.abort();},{signal:controller.signal});
          const retention=await ctx.sessions.retainResources(id);retention.close();
          await ctx.sessions.followup({sessionId:id,prompt:"Extension queued",harness:{harnessId:"test.queue-smoke.harness.worker",model:"two",params:{thinking:"low"}}});
          const pending=(await ctx.sessions.getQueuedFollowUps(id)).requests;
          const last=pending[pending.length-1];
          const moved=await ctx.sessions.moveQueuedFollowUp(id,last.queuePosition,{direction:"up",expectedRevision:last.revision});
          const current=(await ctx.sessions.getQueuedFollowUps(id)).requests.find(item=>item.queuePosition===moved.queuePosition);
          await ctx.sessions.removeQueuedFollowUp(id,current.queuePosition,current.revision);
          const file=await ctx.sessions.uploadAttachment({name:"extension.txt",data:new TextEncoder().encode("Extension attachment")});
          const attachment=new TextDecoder().decode(await ctx.sessions.readAttachment(file.fileId));
          await ctx.sessions.deleteAttachment(file.fileId);
          const harness={harnessId:"test.queue-smoke.harness.worker"};
          const draft=await ctx.sessions.getDraftHarnessCommands({harness});
          const native=await ctx.sessions.getHarnessCommands(id);
          const idle=await ctx.sessions.create({title:"Extension idle",harness,operation:{kind:"command",text:"/plan"}});
          await ctx.sessions.stream(idle.id,()=>{});
          await ctx.sessions.rename(idle.id,"Renamed by extension");
          const operation=await ctx.sessions.invokeHarnessOperation(idle.id,{kind:"command",text:"/plan"},harness.harnessId);
          await ctx.sessions.stream(idle.id,()=>{});
          await ctx.sessions.updateStatus(idle.id,"completed");
          await ctx.sessions.archive(idle.id);
          const activity=await ctx.sessions.listActivity(idle.id);
          await ctx.sessions.delete(idle.id);
          return {messages:conversation.messages.length,sources,queued:queued.messages.length,events,attachment,
            draft:draft.commands[0].name,native:native.commands[0].name,operation,
            resolved:await ctx.sessions.resolveSessionId({harnessId:harness.harnessId,agentSessionId:"native"}),
            archived:activity.items.some(item=>item.eventType==="session_archived"),deleted:await ctx.sessions.get(idle.id)};
        }
      },{
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
