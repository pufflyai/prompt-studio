import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const verifyProviderPackageConsumer = (root: string, sdkArchive: string) => {
  const run = (cwd: string, args: string[]) => {
    const result = Bun.spawnSync(["bun", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
    if (result.exitCode !== 0)
      throw new Error(`Provider package check: ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  };
  const provider = join(root, "provider");
  const consumer = join(root, "provider-consumer");
  mkdirSync(provider);
  mkdirSync(consumer);
  writeFileSync(
    join(provider, "package.json"),
    JSON.stringify({
      name: "review-provider",
      publisher: "verify",
      version: "1.0.0",
      type: "module",
      main: "./extension.ts",
      exports: { ".": "./extension.ts", "./contracts": "./contracts.ts" },
      files: ["*.ts"],
      engines: { pstdio: "1.0.0-alpha.10" },
      dependencies: { "@pstdio/sdk": `file:${sdkArchive}` },
    }),
  );
  writeFileSync(
    join(provider, "extension.ts"),
    `import { defineCommand, defineExtension, definePage, defineView, params, workbenchModes } from "@pstdio/sdk/extensions";
export const save = defineCommand({ id: "save", title: "Save", params: { text: params.text({ required: true }) }, run: async (_ctx, input) => ({ text: input.text }) });
const view = defineView({ id: "content", title: "Content", body: { kind: "controls", query: async () => ({ params: [] }) } });
export const page = definePage({ id: "notes", title: "Notes", path: "notes", mode: workbenchModes.project, main: { kind: "view", view: view.ref, cardinality: "one" }, slots: [{ id: "inspector", region: "side", item: { kind: "view", view: view.ref, presence: "closed" } }] });
export default defineExtension({ commands: [save], views: [view], pages: [page] });\n`,
  );
  writeFileSync(
    join(provider, "contracts.ts"),
    `import { qualifyRef } from "@pstdio/sdk/extensions";
import { page, save } from "./extension";
export const notes = qualifyRef("verify.review-provider", page.ref);
export const inspector = qualifyRef("verify.review-provider", page.panels.inspector);
export const saveNote = qualifyRef("verify.review-provider", save.ref);\n`,
  );
  run(provider, ["install"]);
  const archive = join(root, "provider.tgz");
  run(provider, ["pm", "pack", "--filename", archive]);
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: { "review-provider": `file:${archive}`, "@pstdio/sdk": `file:${sdkArchive}`, typescript: "6.0.2" },
    }),
  );
  writeFileSync(
    join(consumer, "consumer.ts"),
    `import { notes, inspector, saveNote } from "review-provider/contracts";
import { defineExtension, defineNavigationItem, workbenchModes, type CommandRef } from "@pstdio/sdk/extensions";
export const saved: CommandRef<{ text: string }, { text: string }> = saveNote;
// @ts-expect-error Qualification must preserve command result types.
export const wrong: CommandRef<{ text: string }, { revision: number }> = saveNote;
export default defineExtension({ navigationItems: [defineNavigationItem({ id: "open", label: "Open provider", owner: workbenchModes.project, action: { kind: "compound", targets: [{ kind: "page", page: notes }, { kind: "panel", panel: inspector }] } })] });
if (notes.extensionId !== "verify.review-provider" || inspector.page.extensionId !== notes.extensionId || saveNote.extensionId !== notes.extensionId) throw new Error("Consumer lost provider ownership");\n`,
  );
  writeFileSync(
    join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        types: [],
        lib: ["ES2022", "DOM"],
      },
      include: ["consumer.ts"],
    }),
  );
  run(consumer, ["install"]);
  run(consumer, ["node_modules/typescript/bin/tsc", "--noEmit"]);
  run(consumer, ["consumer.ts"]);
  console.log("Verified provider page, panel, and typed command refs through separately installed packages.");
};
