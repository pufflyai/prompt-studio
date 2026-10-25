import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

const root = mkdtempSync(join(tmpdir(), "terminal-signal-probe-"));
const control = await startPackagedServe(root);
try {
  for (const runtime of [process.execPath, PACKAGED_BINARY_PATH]) {
    const url = new URL("/v1/terminal", control.baseUrl);
    url.protocol = "ws:";
    const socket = new WebSocket(url, { headers: runtimeAuthorization(control.descriptor) });
    let output = "";
    let sent = false;
    const exited = Promise.withResolvers<unknown>();
    socket.onopen = () => socket.send(JSON.stringify({type:"open",request:{
      command:[runtime,"-e",'process.once("SIGINT",()=>{console.log("INTERRUPTED");process.exit(130)});console.log("READY");setInterval(()=>{},1000)'],
      cwd:root, env:{BUN_BE_BUN:"1"}, cols:200, rows:40,
    }}));
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (message.type === "data") output += Buffer.from(message.chunk,"base64").toString();
      if (!sent && output.includes("READY")) {
        sent = true;
        socket.send(JSON.stringify({type:"write",data:Buffer.from("\u0003").toString("base64")}));
      }
      if (message.type === "exit" || message.type === "error") exited.resolve(message);
    };
    const outcome = await Promise.race([exited.promise,Bun.sleep(5000).then(()=>"no-exit")]);
    console.log(JSON.stringify({runtime,outcome,output}));
    socket.close();
  }
} finally {
  await stopProcess(control.child);
  rmSync(root,{recursive:true,force:true});
}
