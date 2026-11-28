import { createHash } from "node:crypto";
import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

// Replaces the checkout with the downloaded source. Installed dependencies stay, so a
// reused environment skips most of the install on the next run.
export async function installSource(url: string, sha256: string, repo: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Source download failed with HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== sha256) throw new Error(`Source digest ${actual} does not match ${sha256}`);

  await mkdir(repo, { recursive: true });
  for (const entry of await readdir(repo))
    if (entry !== "node_modules") await rm(join(repo, entry), { recursive: true, force: true });
  const archive = `${repo}.tar.gz`;
  await Bun.write(archive, bytes);
  const tar = Bun.spawn(["tar", "-xzf", archive, "-C", repo], { stderr: "pipe" });
  const [code, stderr] = await Promise.all([tar.exited, new Response(tar.stderr).text()]);
  await rm(archive, { force: true });
  if (code !== 0) throw new Error(`Source extraction failed: ${stderr.trim()}`);
  await snapshot(repo);
  return bytes.length;
}

// Preserve the supplied HEAD and comparison refs. Commit working-tree edits as a
// child of that HEAD so immutable review checkouts contain the selected snapshot.
async function snapshot(repo: string) {
  const author = [
    "-c",
    "user.name=remote-tests",
    "-c",
    "user.email=remote-tests@localhost",
    "-c",
    "commit.gpgsign=false",
  ];
  const status = Bun.spawn(["git", "status", "--porcelain"], { cwd: repo, stdout: "pipe", stderr: "ignore" });
  const dirty = (await new Response(status.stdout).text()).trim();
  const initialized = (await status.exited) === 0;
  if (initialized && !dirty) return;
  for (const args of [
    ["init", "-q"],
    ["add", "-A"],
    [...author, "commit", "-q", "--allow-empty", "-m", "Uploaded source"],
  ]) {
    const git = Bun.spawn(["git", ...args], { cwd: repo, stdout: "ignore", stderr: "pipe" });
    const [exit, stderr] = await Promise.all([git.exited, new Response(git.stderr).text()]);
    if (exit !== 0) throw new Error(`git ${args.at(-1)} failed: ${stderr.trim()}`);
  }
}
