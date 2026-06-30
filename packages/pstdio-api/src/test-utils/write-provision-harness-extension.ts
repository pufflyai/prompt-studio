import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Mirrors the bundled harness extensions: a harness plus a `workspace.provision` hook that
// syncs the project skill catalog into the agent dir. Lets app-level tests exercise the real
// provisioning path (awaited event -> ctx.workspaceFiles.syncDir) without spawning a CLI.
export const writeProvisionHarnessExtension = (
  root: string,
  options: { installName: string; localId: string; skillsDir: string },
) => {
  const sourcePath = join(root, options.installName);
  mkdirSync(sourcePath, { recursive: true });
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: options.installName,
      version: "1.0.0",
      displayName: options.installName,
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
      type: "module",
    }),
  );
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `export default {
  harnesses: {
    ${JSON.stringify(options.localId)}: {
      id: ${JSON.stringify(options.localId)},
      label: ${JSON.stringify(options.localId)},
      skills: { dir: ${JSON.stringify(options.skillsDir)} },
      capabilities: () => [],
      detect: () => ({ available: true }),
      start: () => ({ done: Promise.resolve({ status: "completed" }), stop: () => {} }),
      resume: () => ({ done: Promise.resolve({ status: "completed" }), stop: () => {} }),
    },
  },
  hooks: {
    provision: {
      eventId: "workspace.provision",
      async handler(ctx) {
        const skills = (await ctx.skills?.list?.()) ?? [];
        const files = skills.flatMap((skill) =>
          skill.files.map((file) => ({ path: skill.name + "/" + file.path, content: file.content })),
        );
        if (ctx.workspaceFiles) await ctx.workspaceFiles.syncDir(${JSON.stringify(options.skillsDir)}, files);
      },
    },
  },
};
`,
    "utf8",
  );
  return sourcePath;
};
