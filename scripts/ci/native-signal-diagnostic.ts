import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "native-signal-"));
try {
  await Bun.write(join(root,"package.json"),JSON.stringify({dependencies:{"playwright-core":"1.60.0"}}));
  const install = Bun.spawn([process.execPath,"install"],{cwd:root,stdout:"inherit",stderr:"inherit"});
  if (await install.exited) throw new Error("Playwright probe installation failed");
  for (const runtime of [process.execPath]) {
    for (const mode of ["playwright-import", "five-pipes", "readline", "browser", "browser-normal", "browser-rearm"]) {
      const script = join(root, "child.ts");
      await Bun.write(script, `import {spawn} from "node:child_process";
        import {dlopen,ptr} from "bun:ffi";
        const kernel=dlopen("kernel32.dll",{GetStdHandle:{args:["u32"],returns:"u64"},GetConsoleMode:{args:["u64","ptr"],returns:"bool"}});
        const modeBuffer=new Uint32Array(1); const showMode=()=>{kernel.symbols.GetConsoleMode(kernel.symbols.GetStdHandle(0xfffffff6),ptr(modeBuffer)); console.log("MODE",modeBuffer[0],process.stdin.isRaw)};
        let browser;
        const interrupted=async()=>{console.log("INTERRUPTED");await browser?.close();process.exit(130)};
        process.once("SIGINT",interrupted);
        showMode();
        const {chromium}=await import("playwright-core");
        showMode();
        ${mode === "five-pipes" || mode === "readline" ? `const subprocess=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:["ignore","pipe","pipe","pipe","pipe"]});process.on("exit",()=>subprocess.kill());${mode === "readline" ? 'const {createInterface}=await import("node:readline");createInterface({input:subprocess.stdout});createInterface({input:subprocess.stderr});' : ''}` : ""}
        ${mode.startsWith("browser") ? `browser=await chromium.launchPersistentContext(${JSON.stringify(join(root,mode))},{channel:"msedge",headless:true,handleSIGINT:false,handleSIGTERM:false,handleSIGHUP:false});` : ""}
        showMode();
        ${mode === "browser-normal" ? 'process.stdin.setRawMode(false);showMode();' : ""}
        ${mode === "browser-rearm" ? 'process.off("SIGINT",interrupted);process.once("SIGINT",interrupted);' : ""}
        console.log("READY"); setInterval(() => {}, 1000);`);
      let output = "";
      const ready = Promise.withResolvers<void>();
      const child = Bun.spawn([runtime, script], {
        windowsHide: mode.startsWith("hidden"),
        terminal: { cols: 100, rows: 30, data(_terminal, data) {
          output += new TextDecoder().decode(data);
          if (output.includes("READY")) ready.resolve();
        } },
      });
      try {
        await Promise.race([ready.promise, child.exited.then(() => {throw new Error(output);})]);
        child.terminal!.write(mode.includes("buffer") ? Buffer.from("\u0003") : "\u0003");
        const outcome = await Promise.race([child.exited, Bun.sleep(1500).then(() => "no-exit")]);
        console.log(JSON.stringify({ runtime, mode, outcome, output }));
      } finally {
        child.kill();
        await child.exited;
        child.terminal!.close();
      }
    }
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
