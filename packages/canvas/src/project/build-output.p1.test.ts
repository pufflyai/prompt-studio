import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { buildCanvases, resolveOut } from "./build";
import type { CanvasBuildManifest } from "./manifest";
import { createTestProject, sampleProject } from "./test-project";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});
const project = (files: Record<string, string> = sampleProject) => {
  const created = createTestProject(files);
  cleanups.push(created.dispose);
  return created.root;
};
const moduleFile = (root: string, manifest: CanvasBuildManifest, id: string) =>
  join(resolveOut(root), manifest.frames.modules[manifest.frames.sources[id]!.script]!.file);
const decode = (path: string) => gunzipSync(Buffer.from(readFileSync(path, "utf8"), "base64")).toString();

test("imported images and fonts are inlined, because frames cannot fetch relative files", async () => {
  // Large enough that Bun emits the font as a file instead of inlining it itself.
  const font = Buffer.alloc(64 * 1024, 7).toString("latin1");
  const root = project({
    "src/logo.png": "\x89PNG\r\n\x1a\nlogo",
    "src/brand.woff2": font,
    "src/brand.css": "@font-face { font-family: Brand; src: url(./brand.woff2); }\n.brand { font-family: Brand; }\n",
    "src/brand.canvas.tsx": `import "./brand.css";\nimport logo from "./logo.png";\nexport const Logo = () => <img src={logo} className="brand" />;\n`,
  });
  const { manifest } = await buildCanvases({ root });
  const out = resolveOut(root);
  const script = manifest.frames.modules[manifest.frames.sources["src/brand.canvas.tsx"]!.script]!;
  const styles = (script.css ?? []).map((name) => decode(join(out, manifest.frames.modules[name]!.file))).join("");

  expect(decode(join(out, script.file))).toContain('"data:image/png;base64,');
  expect(styles).toMatch(/url\("?data:font\/woff2;base64,/);
  expect(styles).not.toContain("./brand");
});

test("a rebuild leaves unchanged module files untouched while it writes changed ones", async () => {
  const root = project();
  const first = (await buildCanvases({ root })).manifest;
  const card = moduleFile(root, first, "src/card.canvas.tsx");
  const written = statSync(card).mtimeMs;

  utimesSync(join(root, "src/button.tsx"), new Date(), new Date(Date.now() + 1_000));
  writeFileSync(
    join(root, "src/button.tsx"),
    readFileSync(join(root, "src/button.tsx"), "utf8").replace("{props.label}", "{props.label}!"),
  );
  const second = (await buildCanvases({ root })).manifest;

  expect(moduleFile(root, second, "src/card.canvas.tsx")).toBe(card);
  expect(statSync(card).mtimeMs).toBe(written);
  expect(moduleFile(root, second, "src/button.canvas.tsx")).not.toBe(moduleFile(root, first, "src/button.canvas.tsx"));
});

test("builds into one output folder take turns, so neither removes the other's modules", async () => {
  const root = project();
  const [first, second] = await Promise.all([
    buildCanvases({ root, force: true }),
    buildCanvases({ root, force: true }),
  ]);
  const out = resolveOut(root);
  for (const { manifest } of [first, second])
    for (const module of Object.values(manifest.frames.modules)) expect(existsSync(join(out, module.file))).toBe(true);
  expect(existsSync(join(out, "build.lock"))).toBe(false);
});

test("a build waits for a running builder and takes over the lock of one that exited", async () => {
  const root = project();
  const out = resolveOut(root);
  mkdirSync(out, { recursive: true });

  writeFileSync(join(out, "build.lock"), "99999999");
  expect((await buildCanvases({ root })).built).toBe(true);

  const holder = Bun.spawn(["sleep", "30"]);
  cleanups.push(() => holder.kill());
  writeFileSync(join(out, "build.lock"), String(holder.pid));
  let done = false;
  const waiting = buildCanvases({ root, force: true }).then(() => {
    done = true;
  });
  await Bun.sleep(400);
  expect(done).toBe(false);
  holder.kill();
  await holder.exited;
  await waiting;
  expect(done).toBe(true);
});

test("work folders left by a killed build are removed", async () => {
  const root = project();
  const out = resolveOut(root);
  mkdirSync(join(out, ".work-killed", "entries"), { recursive: true });
  await buildCanvases({ root });
  expect(existsSync(join(out, ".work-killed"))).toBe(false);
});
