import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const VERSION_HEADER = /^## \d+\.\d+\.\d+(?:-[^\s]+)?\s*$/;
const DATE_LINE = /^_\d{4}-\d{2}-\d{2}_$/;
const UNCOMMITTED_SHA = "0000000000000000000000000000000000000000";

const todayIso = () => new Date().toISOString().slice(0, 10);

const blameDate = (file: string, line: number) => {
  const result = spawnSync("git", ["blame", "-L", `${line},${line}`, "--porcelain", file], {
    encoding: "utf-8",
  });
  if (result.status !== 0) return null;
  const sha = result.stdout.slice(0, 40);
  if (sha === UNCOMMITTED_SHA) return null;
  const match = result.stdout.match(/^author-time (\d+)$/m);
  if (!match) return null;
  return new Date(Number(match[1]) * 1000).toISOString().slice(0, 10);
};

const findChangelogs = async () => {
  const found: string[] = [];
  for (const root of ["packages", "extensions"] as const) {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const path = join(root, entry.name, "CHANGELOG.md");
      if (await Bun.file(path).exists()) found.push(path);
    }
  }
  return found;
};

const stampFile = async (file: string) => {
  const text = await Bun.file(file).text();
  const lines = text.split("\n");
  const out: string[] = [];
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out.push(line);
    if (!VERSION_HEADER.test(line)) continue;

    const peek1 = lines[i + 1] ?? "";
    const peek2 = lines[i + 2] ?? "";
    if (DATE_LINE.test(peek1) || DATE_LINE.test(peek2)) continue;

    const date = blameDate(file, i + 1) ?? todayIso();
    out.push("");
    out.push(`_${date}_`);
    changed = true;
  }

  if (!changed) return false;
  await Bun.write(file, out.join("\n"));
  return true;
};

const main = async () => {
  const files = await findChangelogs();
  const stamped: string[] = [];
  for (const file of files) {
    if (await stampFile(file)) stamped.push(file);
  }
  if (stamped.length > 0) {
    console.log(`stamped dates in:\n${stamped.map((f) => `  ${f}`).join("\n")}`);
  }
};

if (import.meta.main) {
  await main();
}
