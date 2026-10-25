import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = mkdtempSync(join(tmpdir(), "native-signal-"));
try {
  for (const mode of ["compiled-child", "compiled-child-console"]) {
    const script = join(root, "child.ts");
    const executable = join(root, "probe.exe");
    await Bun.write(script, `
      import {spawn} from "node:child_process";
      if(process.argv.includes("--probe-child")) {setInterval(()=>{},1000)} else {
      ${mode.includes("console") ? `const {bindCliOutput}=await import(${JSON.stringify(resolve(import.meta.dir,"../../packages/pstdio/src/features/cli-output.ts"))});bindCliOutput();` : ""}
      process.once("SIGINT",()=>{process.stderr.write("INTERRUPTED\\n");process.exit(130)});
      const subprocess=spawn(process.execPath,["--probe-child"],{detached:true,windowsHide:true,stdio:["ignore","pipe","pipe"]});
      process.once("exit",()=>subprocess.kill());
      await Bun.sleep(250);
      console.log("READY");setInterval(()=>{},1000);
      }
    `);
    const compiled = mode.startsWith("compiled");
    if (compiled) {
      const build=Bun.spawn([process.execPath,"build",script,"--compile","--outfile",executable],{stdout:"inherit",stderr:"inherit"});
      if (await build.exited) throw new Error("Probe compilation failed");
    }
    let output="";
    const ready=Promise.withResolvers<void>();
    const child=Bun.spawn(compiled ? [executable] : [process.execPath,script],{
      windowsHide:true,
      terminal:{cols:200,rows:40,data(_terminal,data){output+=new TextDecoder().decode(data);if(output.includes("READY"))ready.resolve();}},
    });
    try {
      await Promise.race([ready.promise,child.exited.then(()=>{throw new Error(output)})]);
      child.terminal!.write(Buffer.from("\u0003"));
      const outcome=await Promise.race([child.exited,Bun.sleep(1500).then(()=>"no-exit")]);
      console.log(JSON.stringify({mode,outcome,output}));
    } finally {
      child.kill();await child.exited;child.terminal!.close();
    }
  }
} finally {rmSync(root,{recursive:true,force:true});}
