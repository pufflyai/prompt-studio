import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

// A small React project: Button and Card are independent, so a change to one leaves the other's
// modules alone.
export const sampleProject: Record<string, string> = {
  "src/button.css": ".button { color: rebeccapurple; }\n",
  "src/button.tsx": `import "./button.css";
export const Button = (props: { label: string }) => <button className="button">{props.label}</button>;
`,
  "src/button.canvas.tsx": `import { Button } from "./button";

export default { title: "Components/Button", component: Button, description: "Primary actions." };

export const Primary = { args: { label: "Save" }, description: "The default action." };
export const Loading = () => <Button label="Saving…" />;
`,
  "src/card.tsx": `export const Card = (props: { title: string }) => <section>{props.title}</section>;
`,
  "src/card.canvas.tsx": `import { Card } from "./card";

export default { title: "Layout/Card", component: Card, fullscreen: true };

export const Default = { args: { title: "Usage this month" } };
`,
  ".canvas/preview.tsx": `export default {
  decorators: [(Frame: () => unknown, context: { theme: string }) => <div data-theme={context.theme}>{Frame() as never}</div>],
};
`,
};

/** Creates a throwaway project that resolves React from this package's dependencies. */
export const createTestProject = (files: Record<string, string>, options: { git?: boolean } = {}) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-canvas-")));
  symlinkSync(resolve(import.meta.dir, "../../node_modules"), join(root, "node_modules"), "dir");
  writeProjectFiles(root, files);
  if (options.git) Bun.spawnSync(["git", "init", "--quiet"], { cwd: root });
  return { root, dispose: () => rmSync(root, { recursive: true, force: true }) };
};

export const writeProjectFiles = (root: string, files: Record<string, string>) => {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
};
