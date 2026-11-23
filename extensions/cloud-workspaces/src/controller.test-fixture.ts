import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function writeControllerFixture(root: string, source: string) {
  const script = join(root, "controller.ts");
  await writeFile(script, source);
  // The host starts the controller as an executable. Windows cannot launch a shebang script.
  const binary = join(root, process.platform === "win32" ? "pocketcoder.exe" : "pocketcoder");
  const compiler = Bun.spawn([process.execPath, "build", script, "--compile", "--outfile", binary], {
    stdout: "ignore",
    stderr: "pipe",
  });
  const [exitCode, stderr] = await Promise.all([compiler.exited, new Response(compiler.stderr).text()]);
  if (exitCode !== 0) throw new Error(`Could not compile the controller fixture: ${stderr}`);
  return binary;
}
