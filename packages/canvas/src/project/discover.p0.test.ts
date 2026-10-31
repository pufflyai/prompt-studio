import { afterEach, expect, test } from "bun:test";
import { discoverCanvases, listCanvasFiles } from "./discover";
import { createTestProject } from "./test-project";

const projects: { dispose: () => void }[] = [];
afterEach(() => {
  for (const project of projects.splice(0)) project.dispose();
});
const project = (files: Record<string, string>, git: boolean) => {
  const created = createTestProject(files, { git });
  projects.push(created);
  return created.root;
};

const files = {
  ".gitignore": "generated/\n",
  "status.canvas.tsx": "export const Ready = () => null;\n",
  "generated/copy.canvas.tsx": "export const Ready = () => null;\n",
  "dist/build.canvas.tsx": "export const Ready = () => null;\n",
  ".canvas/preview.tsx": "export default {};\n",
  "src/forms/.canvas/preview.tsx": "export default {};\n",
  "src/forms/text-field.canvas.tsx": `import { TextField } from "./text-field";

const meta = {
  title: "Design System/Forms/Text field",
  component: TextField,
  description: "Single-line input.",
  defaultTheme: "pstdio-dark",
};
export default meta;

export const WithLabel = { args: { label: "Name" } };
export const ReadOnly = { name: "Read only value", fullscreen: true, defaultTheme: "prompt-contrast-light" };
export function FullWidth() {
  return null;
}
export const sampleValue = "Ada";
const Invalid = { description: "Shows the error message." };
export { Invalid };
`,
};

test("lists the project's canvas files without the ones Git ignores", async () => {
  const root = project(files, true);
  expect(await listCanvasFiles(root)).toEqual([
    "dist/build.canvas.tsx",
    "src/forms/text-field.canvas.tsx",
    "status.canvas.tsx",
  ]);
});

test("outside Git, skips installed, built and Prompt Studio folders", async () => {
  const root = project({ ...files, ".pstdio/extension-storage/x.canvas.tsx": "" }, false);
  expect(await listCanvasFiles(root)).toEqual([
    "generated/copy.canvas.tsx",
    "src/forms/text-field.canvas.tsx",
    "status.canvas.tsx",
  ]);
});

test("reads titles, groups and frames, and finds the nearest preview file", async () => {
  const root = project(files, true);
  const canvases = Object.fromEntries((await discoverCanvases(root)).map((canvas) => [canvas.id, canvas]));

  expect(canvases["src/forms/text-field.canvas.tsx"]).toEqual({
    id: "src/forms/text-field.canvas.tsx",
    title: "Design System/Forms/Text field",
    group: "Design System/Forms",
    name: "Text field",
    description: "Single-line input.",
    preview: "src/forms/.canvas/preview.tsx",
    frames: [
      // A frame's own default theme wins over the canvas file's.
      {
        exportName: "WithLabel",
        name: "With label",
        description: undefined,
        fullscreen: undefined,
        defaultTheme: "pstdio-dark",
      },
      {
        exportName: "ReadOnly",
        name: "Read only value",
        description: undefined,
        fullscreen: true,
        defaultTheme: "prompt-contrast-light",
      },
      {
        exportName: "FullWidth",
        name: "Full width",
        description: undefined,
        fullscreen: undefined,
        defaultTheme: "pstdio-dark",
      },
      {
        exportName: "Invalid",
        name: "Invalid",
        description: "Shows the error message.",
        fullscreen: undefined,
        defaultTheme: "pstdio-dark",
      },
    ],
  });
  expect(canvases["status.canvas.tsx"]).toMatchObject({
    title: "status",
    group: "",
    name: "status",
    preview: ".canvas/preview.tsx",
    frames: [{ exportName: "Ready", name: "Ready" }],
  });
});
