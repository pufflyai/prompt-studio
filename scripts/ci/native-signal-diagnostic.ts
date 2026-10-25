import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "native-signal-"));
try {
  for (const runtime of [process.execPath, Bun.which("node")!]) {
    for (const mode of ["buffer", "hidden", "hidden-buffer", "once", "detached-child", "inherited-child"]) {
      const script = join(root, "child.ts");
      await Bun.write(script, `import {spawn} from "node:child_process";
        process.${mode === "once" ? "once" : "on"}("SIGINT", () => { console.log("INTERRUPTED"); process.exit(130); });
        ${mode.endsWith("child") ? `const subprocess = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {detached:${mode === "detached-child"},windowsHide:true,stdio:["ignore","pipe","pipe"]}); process.on("exit",()=>subprocess.kill());` : ""}
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
