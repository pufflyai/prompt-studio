import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const [kind, id = "chat-turn-compare", ...flags] = process.argv.slice(2);
const root = resolve(import.meta.dir, "..");
await mkdir(resolve(root, "out"), { recursive: true });
const extension = kind === "still" ? "png" : "mp4";
const command = kind === "still" ? "still" : "render";
const child = Bun.spawn(
  ["bunx", "--no-install", "remotion", command, "src/studio.tsx", id, `out/${id}.${extension}`, ...flags],
  { cwd: root, stdout: "inherit", stderr: "inherit" },
);
process.exit(await child.exited);
