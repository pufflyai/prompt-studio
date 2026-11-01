import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { CanvasEntry } from "./manifest";
import { reactBase } from "./react-base";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const monorepo = (files: Record<string, string>) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-canvas-react-")));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
};
const installed = (folder: string, name: string, version: string) => ({
  [`${folder}/node_modules/${name}/package.json`]: JSON.stringify({ name, version, main: "index.js" }),
  [`${folder}/node_modules/${name}/index.js`]: "module.exports = {};\n",
});
const canvas = (id: string): CanvasEntry => ({ id, title: id, group: "", name: id, frames: [] });

test("a monorepo without a root React uses the React most canvas files resolve, with react-dom beside it", () => {
  const root = monorepo({
    ...installed("packages", "react", "19.2.4"),
    ...installed("packages", "react-dom", "19.2.4"),
    // A tool that installs only react cannot render frames, so it must not decide.
    ...installed("tools/lint", "react", "19.2.4"),
  });
  const base = reactBase(root, [
    canvas("tools/lint/rule.canvas.tsx"),
    canvas("packages/ui/button.canvas.tsx"),
    canvas("packages/app/page.canvas.tsx"),
  ]);
  expect(Bun.resolveSync("react-dom/package.json", base)).toBe(
    join(root, "packages/node_modules/react-dom/package.json"),
  );
});

test("canvas files that resolve different React versions fail with both versions named", () => {
  const root = monorepo({
    ...installed("apps/web", "react", "19.2.4"),
    ...installed("apps/web", "react-dom", "19.2.4"),
    ...installed("apps/legacy", "react", "18.3.1"),
    ...installed("apps/legacy", "react-dom", "18.3.1"),
  });
  expect(() => reactBase(root, [canvas("apps/web/home.canvas.tsx"), canvas("apps/legacy/old.canvas.tsx")])).toThrow(
    /different React versions \((19\.2\.4, 18\.3\.1|18\.3\.1, 19\.2\.4)\)/,
  );
});

test("a project root with React decides", () => {
  const root = monorepo({ ...installed(".", "react", "19.2.4"), ...installed(".", "react-dom", "19.2.4") });
  expect(reactBase(root, [canvas("src/button.canvas.tsx")])).toBe(root);
});
